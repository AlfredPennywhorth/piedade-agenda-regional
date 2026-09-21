import { Hono } from 'hono'
import { eq, and, isNull } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { hashToken, gerarTokenAleatorio } from '../../security/tokens'
import { executeAtomic } from '../../db/batch'

// AVISO: Estas rotas ainda dependem do hardening de autorização da PR-SEC-01.
// O acesso permanece condicionado a enableAdminRoutes = true no createApp.
export const adminMembrosApp = new Hono<{ Variables: { db: any } }>()

const VALIDADE_LINK_MS = 7 * 24 * 60 * 60 * 1000

adminMembrosApp.post('/:id/link-ativacao', async c => {
  const membroId = c.req.param('id')
  const db = c.get('db')

  if (!db) {
    return c.json({ error: 'Banco de dados indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  const [membro] = await db
    .select()
    .from(schema.membros)
    .where(eq(schema.membros.id, membroId))
    .limit(1)

  if (!membro || !membro.ativo) {
    return c.json({ error: 'Membro não encontrado ou inativo' }, 404)
  }

  const [contaExistente] = await db
    .select()
    .from(schema.contasAcesso)
    .where(eq(schema.contasAcesso.membroId, membroId))
    .limit(1)

  if (contaExistente?.status === 'BLOQUEADA' || contaExistente?.status === 'DESATIVADA') {
    return c.json({ error: 'Conta indisponível para ativação', code: 'CONTA_INDISPONIVEL' }, 409)
  }

  const agora = new Date()
  const agoraIso = agora.toISOString()
  const contaAcessoId = contaExistente?.id ?? crypto.randomUUID()
  const token = gerarTokenAleatorio()
  const hashedToken = await hashToken(token)
  const expiraEm = new Date(agora.getTime() + VALIDADE_LINK_MS).toISOString()

  await executeAtomic(db, tx => {
    const queries = []

    if (!contaExistente) {
      queries.push(
        tx.insert(schema.contasAcesso).values({
          id: contaAcessoId,
          membroId,
          status: 'PENDENTE_ATIVACAO',
          createdAt: agoraIso,
          updatedAt: agoraIso,
        })
      )
    }

    queries.push(
      tx
        .update(schema.linksAtivacao)
        .set({ revogadoEm: agoraIso, updatedAt: agoraIso })
        .where(
          and(
            eq(schema.linksAtivacao.contaAcessoId, contaAcessoId),
            isNull(schema.linksAtivacao.utilizadoEm),
            isNull(schema.linksAtivacao.revogadoEm)
          )
        )
    )

    queries.push(
      tx.insert(schema.linksAtivacao).values({
        id: crypto.randomUUID(),
        contaAcessoId,
        membroId,
        tokenHash: hashedToken,
        expiraEm,
        createdAt: agoraIso,
        updatedAt: agoraIso,
      })
    )

    return queries
  })

  return c.json(
    {
      message: 'Link de ativação gerado',
      token,
      expiraEm,
      membroId,
    },
    201
  )
})

adminMembrosApp.post('/:id/reset-autenticacao', async c => {
  const membroId = c.req.param('id')
  const db = c.get('db')

  if (!db) {
    return c.json({ error: 'Banco de dados indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  const [conta] = await db
    .select()
    .from(schema.contasAcesso)
    .where(eq(schema.contasAcesso.membroId, membroId))
    .limit(1)

  if (!conta) {
    return c.json({ error: 'Conta de acesso não encontrada' }, 404)
  }

  if (conta.status === 'BLOQUEADA' || conta.status === 'DESATIVADA') {
    return c.json({ error: 'Conta indisponível para redefinição', code: 'CONTA_INDISPONIVEL' }, 409)
  }

  const agora = new Date()
  const agoraIso = agora.toISOString()
  const token = gerarTokenAleatorio()
  const hashedToken = await hashToken(token)
  const expiraEm = new Date(agora.getTime() + VALIDADE_LINK_MS).toISOString()

  await executeAtomic(db, tx => [
    tx
      .update(schema.sessoes)
      .set({ revogadoEm: agoraIso })
      .where(
        and(
          eq(schema.sessoes.contaAcessoId, conta.id),
          isNull(schema.sessoes.revogadoEm)
        )
      ),
    tx
      .update(schema.linksAtivacao)
      .set({ revogadoEm: agoraIso, updatedAt: agoraIso })
      .where(
        and(
          eq(schema.linksAtivacao.contaAcessoId, conta.id),
          isNull(schema.linksAtivacao.utilizadoEm),
          isNull(schema.linksAtivacao.revogadoEm)
        )
      ),
    tx
      .update(schema.contasAcesso)
      .set({
        status: 'PENDENTE_ATIVACAO',
        pinHash: null,
        pinSalt: null,
        tentativasPin: 0,
        bloqueadoAte: null,
        updatedAt: agoraIso,
      })
      .where(eq(schema.contasAcesso.id, conta.id)),
    tx.insert(schema.linksAtivacao).values({
      id: crypto.randomUUID(),
      contaAcessoId: conta.id,
      membroId,
      tokenHash: hashedToken,
      expiraEm,
      createdAt: agoraIso,
      updatedAt: agoraIso,
    }),
    tx.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      contaAcessoId: conta.id,
      membroId,
      tipo: 'RECUPERACAO_ADMIN',
      sucesso: true,
    }),
  ])

  return c.json(
    {
      message: 'Link de redefinição gerado e sessões revogadas',
      token,
      expiraEm,
      membroId,
    },
    200
  )
})
