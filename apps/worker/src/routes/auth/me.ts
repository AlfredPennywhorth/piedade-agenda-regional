import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../../db/schema'
import { authMiddleware, Variables } from '../../middleware/auth'

export const meApp = new Hono<{ Bindings: { DB: D1Database }, Variables: Variables }>()

meApp.use('*', authMiddleware)

meApp.get('/', async (c) => {
  const membroId = c.get('membroId')
  const db = drizzle(c.env.DB, { schema })

  const membro = await db.query.membros.findFirst({
    where: eq(schema.membros.id, membroId)
  })

  if (!membro) {
    return c.json({ error: 'Membro não encontrado' }, 404)
  }

  // Não retornamos pinHash, pinSalt nem dataNascimento
  return c.json({
    id: membro.id,
    nome: membro.nome,
    casaId: membro.casaId,
    ativo: membro.ativo,
    autenticacaoAtiva: membro.autenticacaoAtiva,
    ativadoEm: membro.ativadoEm
  }, 200)
})

meApp.get('/vinculos', async (c) => {
  const contextoPermissoes = c.get('contextoPermissoes')
  return c.json(contextoPermissoes, 200)
})
