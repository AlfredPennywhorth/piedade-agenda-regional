import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { authMiddleware, Variables } from '../../middleware/auth'

export const meApp = new Hono<{ Variables: Variables }>()

meApp.use('*', authMiddleware)

meApp.get('/', async (c) => {
  const membroId = c.get('membroId')
  const db = c.get('db')
  if (!db) {
    return c.json({ error: 'Banco de dados indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  const [membro] = await db
    .select()
    .from(schema.membros)
    .where(eq(schema.membros.id, membroId))
    .limit(1)

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
