import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { eq, and, isNull } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../../db/schema'
import { hashToken, gerarTokenAleatorio } from '../../security/tokens'

// AVISO: Estas rotas não possuem autorização administrativa completa ainda.
// Elas servem como infraestrutura para a S03 e devem ser protegidas futuramente (S04+).
export const adminMembrosApp = new Hono<{ Bindings: { DB: D1Database } }>()

adminMembrosApp.post('/:id/link-ativacao', async (c) => {
  const membroId = c.req.param('id')
  const db = drizzle(c.env.DB, { schema })
  const agora = new Date()

  const membro = await db.query.membros.findFirst({
    where: eq(schema.membros.id, membroId)
  })

  if (!membro || !membro.ativo) {
    return c.json({ error: 'Membro não encontrado ou inativo' }, 404)
  }

  const token = gerarTokenAleatorio()
  const hashedToken = await hashToken(token)
  const expiraEm = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 dias

  await db.insert(schema.linksAtivacao).values({
    id: crypto.randomUUID(),
    membroId,
    tokenHash: hashedToken,
    expiraEm,
    createdAt: agora.toISOString(),
    updatedAt: agora.toISOString()
  })

  return c.json({
    message: 'Link de ativação gerado (Apenas S03)',
    token, // Token puro só retorna nesta resposta
    expiraEm,
    membroId
  }, 201)
})

adminMembrosApp.post('/:id/reset-autenticacao', async (c) => {
  const membroId = c.req.param('id')
  const db = drizzle(c.env.DB, { schema })
  const agora = new Date().toISOString()

  const membro = await db.query.membros.findFirst({
    where: eq(schema.membros.id, membroId)
  })

  if (!membro) {
    return c.json({ error: 'Membro não encontrado' }, 404)
  }

  // Revoga sessoes ativas, links e remove PIN
  await db.batch([
    db.update(schema.sessoes)
      .set({ revogadoEm: agora })
      .where(
        and(
          eq(schema.sessoes.membroId, membroId),
          isNull(schema.sessoes.revogadoEm)
        )
      ),
    db.update(schema.linksAtivacao)
      .set({ revogadoEm: agora, updatedAt: agora })
      .where(
        and(
          eq(schema.linksAtivacao.membroId, membroId),
          isNull(schema.linksAtivacao.utilizadoEm),
          isNull(schema.linksAtivacao.revogadoEm)
        )
      ),
    db.update(schema.membros)
      .set({
        autenticacaoAtiva: false,
        pinHash: null,
        pinSalt: null,
        tentativasPin: 0,
        bloqueadoAte: null,
        updatedAt: agora
      })
      .where(eq(schema.membros.id, membroId)),
    db.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      membroId,
      tipo: 'RECUPERACAO_ADMIN',
      sucesso: true
    })
  ])

  return c.json({ message: 'Autenticação do membro resetada com sucesso' }, 200)
})
