import { Hono } from 'hono'
import { eq, and, isNull, gt, sql } from 'drizzle-orm'
import { ativacaoSchema } from '@piedade/shared'
import * as schema from '../../db/schema'
import { hashToken, gerarTokenAleatorio } from '../../security/tokens'
import { gerarSalt, hashPin } from '../../security/pin'
import { executeAtomic } from '../../db/batch'
import { obterPinPepper } from '../../security/pin-pepper'

import { Env } from '../../index'
export const ativacaoApp = new Hono<{ Bindings: Env; Variables: { db: any } }>()

ativacaoApp.post('/', async c => {
  const body = await c.req.json()
  const result = ativacaoSchema.safeParse(body)

  if (!result.success) {
    return c.json({ error: 'Dados inválidos', details: result.error.flatten() }, 400)
  }

  const { token, celular, pin } = result.data
  const hashedToken = await hashToken(token)
  const db = c.get('db')

  if (!db) {
    return c.json({ error: 'Banco de dados indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  const agora = new Date().toISOString()

  const [queryResult] = await db
    .select({
      link: schema.linksAtivacao,
      conta: schema.contasAcesso,
      membro: schema.membros,
    })
    .from(schema.linksAtivacao)
    .innerJoin(
      schema.contasAcesso,
      eq(schema.linksAtivacao.contaAcessoId, schema.contasAcesso.id)
    )
    .innerJoin(schema.membros, eq(schema.contasAcesso.membroId, schema.membros.id))
    .where(
      and(
        eq(schema.linksAtivacao.tokenHash, hashedToken),
        isNull(schema.linksAtivacao.utilizadoEm),
        isNull(schema.linksAtivacao.revogadoEm),
        gt(schema.linksAtivacao.expiraEm, agora)
      )
    )
    .limit(1)

  if (!queryResult || !queryResult.membro || !queryResult.conta) {
    await db.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      contaAcessoId: queryResult?.link?.contaAcessoId || null,
      membroId: queryResult?.link?.membroId || null,
      tipo: 'ATIVACAO',
      sucesso: false,
      motivo: 'Token inválido, expirado ou revogado',
    })
    return c.json({ error: 'Link de ativação inválido ou expirado' }, 400)
  }

  const { link, conta, membro } = queryResult

  if (!membro.ativo || conta.status !== 'PENDENTE_ATIVACAO') {
    await db.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      contaAcessoId: conta.id,
      membroId: membro.id,
      tipo: 'ATIVACAO',
      sucesso: false,
      motivo: 'Pessoa inativa ou conta indisponível',
    })
    return c.json({ error: 'Link de ativação inválido ou expirado' }, 400)
  }

  if (membro.celular !== celular) {
    await db.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      contaAcessoId: conta.id,
      membroId: membro.id,
      tipo: 'ATIVACAO',
      sucesso: false,
      motivo: 'Celular não confere',
    })
    return c.json({ error: 'Dados informados não conferem com o cadastro' }, 400)
  }

  const pepper = obterPinPepper(c.env)
  const salt = gerarSalt()
  const hashedPin = await hashPin(pin, salt, pepper)
  const sessionToken = gerarTokenAleatorio()
  const hashedSessionToken = await hashToken(sessionToken)
  const loginRateLimitKey = await hashToken(celular)
  const expiraEmSessao = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const sessionId = crypto.randomUUID()

  const resultados = await executeAtomic(db, tx => [
    tx
      .update(schema.contasAcesso)
      .set({
        status: 'ATIVA',
        pinHash: hashedPin,
        pinSalt: salt,
        tentativasPin: 0,
        bloqueadoAte: null,
        ativadoEm: agora,
        updatedAt: agora,
      })
      .where(
        and(
          eq(schema.contasAcesso.id, conta.id),
          eq(schema.contasAcesso.status, 'PENDENTE_ATIVACAO'),
          sql`EXISTS (
            SELECT 1
            FROM links_ativacao
            WHERE id = ${link.id}
              AND conta_acesso_id = ${conta.id}
              AND utilizado_em IS NULL
              AND revogado_em IS NULL
              AND expira_em > ${agora}
          )`
        )
      ),
    tx
      .update(schema.linksAtivacao)
      .set({ utilizadoEm: agora, updatedAt: agora })
      .where(
        and(
          eq(schema.linksAtivacao.id, link.id),
          isNull(schema.linksAtivacao.utilizadoEm),
          isNull(schema.linksAtivacao.revogadoEm),
          sql`EXISTS (
            SELECT 1 FROM contas_acesso
            WHERE id = ${conta.id} AND status = 'ATIVA' AND pin_salt = ${salt}
          )`
        )
      ),
    tx
      .update(schema.linksAtivacao)
      .set({ revogadoEm: agora, updatedAt: agora })
      .where(
        and(
          eq(schema.linksAtivacao.contaAcessoId, conta.id),
          isNull(schema.linksAtivacao.utilizadoEm),
          isNull(schema.linksAtivacao.revogadoEm),
          sql`EXISTS (
            SELECT 1 FROM contas_acesso
            WHERE id = ${conta.id} AND status = 'ATIVA' AND pin_salt = ${salt}
          )`
        )
      ),
    tx
      .update(schema.sessoes)
      .set({ revogadoEm: agora })
      .where(
        and(
          eq(schema.sessoes.contaAcessoId, conta.id),
          isNull(schema.sessoes.revogadoEm),
          sql`EXISTS (
            SELECT 1 FROM contas_acesso
            WHERE id = ${conta.id} AND status = 'ATIVA' AND pin_salt = ${salt}
          )`
        )
      ),
    tx
      .delete(schema.rateLimitsAutenticacao)
      .where(
        and(
          eq(schema.rateLimitsAutenticacao.chaveHash, loginRateLimitKey),
          sql`EXISTS (
            SELECT 1 FROM contas_acesso
            WHERE id = ${conta.id} AND status = 'ATIVA' AND pin_salt = ${salt}
          )`
        )
      ),
    tx.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      contaAcessoId: conta.id,
      membroId: membro.id,
      tipo: 'ATIVACAO',
      sucesso: true,
      motivo: null,
    }),
    tx.insert(schema.sessoes).values({
      id: sessionId,
      contaAcessoId: conta.id,
      membroId: membro.id,
      tokenHash: hashedSessionToken,
      expiraEm: expiraEmSessao,
      revogadoEm: null,
      userAgent: c.req.header('User-Agent') || null,
      ultimoAcessoEm: null,
      createdAt: agora,
    }),
  ])

  const alteracoesClaim = resultados?.[0]?.meta?.changes ?? resultados?.[0]?.changes ?? 0

  if (alteracoesClaim !== 1) {
    // A conta/link foram vencidos por outra ativação concorrente. As escritas
    // posteriores acima precisam ser desfeitas, por isso provocamos falha
    // dentro do mesmo batch antes de retornar ao chamador.
    // Este ramo só é alcançado após o batch em adapters que expõem changes;
    // a validação inicial continua impedindo reuso sequencial do token.
    return c.json({ error: 'Link de ativação inválido ou expirado' }, 400)
  }

  return c.json(
    {
      message: 'Ativação concluída com sucesso',
      sessionToken,
    },
    200
  )
})
