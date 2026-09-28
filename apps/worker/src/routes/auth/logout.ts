import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { authMiddleware, Variables } from '../../middleware/auth'
import { hashToken } from '../../security/tokens'
import { executeAtomic } from '../../db/batch'

export const logoutApp = new Hono<{ Variables: Variables }>()

logoutApp.use('*', authMiddleware)

logoutApp.post('/', async c => {
  const authHeader = c.req.header('Authorization')!
  const token = authHeader.substring(7)
  const hashedToken = await hashToken(token)
  const db = c.get('db')

  if (!db) {
    return c.json({ error: 'Banco de dados indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  const membroId = c.get('membroId')
  const contaAcessoId = c.get('contaAcessoId')
  const agora = new Date().toISOString()

  await executeAtomic(db, tx => [
    tx
      .update(schema.sessoes)
      .set({ revogadoEm: agora })
      .where(eq(schema.sessoes.tokenHash, hashedToken)),
    tx.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      contaAcessoId,
      membroId,
      tipo: 'LOGOUT',
      sucesso: true,
    }),
  ])

  return c.json({ message: 'Logout realizado com sucesso' }, 200)
})
