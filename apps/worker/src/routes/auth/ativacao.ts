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

  const { token, codigoCarteirinha, celular, pin } = result.data
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

  if (membro.celular !== celular || membro.codigoCarteirinha !== codigoCarteirinha) {
    await db.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      contaAcessoId: conta.id,
      membroId: membro.id,
      tipo: 'ATIVACAO',
      sucesso: false,
      motivo: 'Dados cadastrais não conferem',
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
    tx.insert(schema.tentativasAcesso).select(
      tx
        .select({
          id: sql`${crypto.randomUUID()}`.as('id'),
          contaAcessoId: sql`${conta.id}`.as('conta_acesso_id'),
          membroId: sql`${membro.id}`.as('membro_id'),
          tipo: sql`'ATIVACAO'`.as('tipo'),
          sucesso: sql`1`.as('sucesso'),
          motivo: sql`NULL`.as('motivo'),
          createdAt: sql`${agora}`.as('created_at'),
        })
        .from(schema.contasAcesso)
        .where(
          and(
            eq(schema.contasAcesso.id, conta.id),
            eq(schema.contasAcesso.status, 'ATIVA'),
            eq(schema.contasAcesso.pinSalt, salt)
          )
        )
    ),
    tx.insert(schema.sessoes).select(
      tx
        .select({
          id: sql`${sessionId}`.as('id'),
          contaAcessoId: sql`${conta.id}`.as('conta_acesso_id'),
          membroId: sql`${membro.id}`.as('membro_id'),
          tokenHash: sql`${hashedSessionToken}`.as('token_hash'),
          expiraEm: sql`${expiraEmSessao}`.as('expira_em'),
          revogadoEm: sql`NULL`.as('revogado_em'),
          ultimoAcessoEm: sql`NULL`.as('ultimo_acesso_em'),
          userAgent: sql`${c.req.header('User-Agent') || null}`.as('user_agent'),
          createdAt: sql`${agora}`.as('created_at'),
        })
        .from(schema.contasAcesso)
        .where(
          and(
            eq(schema.contasAcesso.id, conta.id),
            eq(schema.contasAcesso.status, 'ATIVA'),
            eq(schema.contasAcesso.pinSalt, salt)
          )
        )
    ),
  ])

  const alteracoesClaim = resultados?.[0]?.meta?.changes ?? resultados?.[0]?.changes ?? 0

  if (alteracoesClaim !== 1) {
    // As inserções de auditoria e sessão são condicionadas ao salt gravado
    // pelo vencedor do claim; concorrentes perdedores não produzem sessão.
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
