import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../../db/schema'
import { authMiddleware, Variables } from '../../middleware/auth'
import { hashToken } from '../../security/tokens'

export const logoutApp = new Hono<{ Bindings: { DB: D1Database }, Variables: Variables }>()

logoutApp.use('*', authMiddleware)

logoutApp.post('/', async (c) => {
  const authHeader = c.req.header('Authorization')!
  const token = authHeader.substring(7)
  const hashedToken = await hashToken(token)

  const db = drizzle(c.env.DB, { schema })
  const membroId = c.get('membroId')
  const agora = new Date().toISOString()

  await db.batch([
    db.update(schema.sessoes)
      .set({ revogadoEm: agora })
      .where(eq(schema.sessoes.tokenHash, hashedToken)),
    db.insert(schema.tentativasAcesso).values({
      id: crypto.randomUUID(),
      membroId,
      tipo: 'LOGOUT',
      sucesso: true
    })
  ])

  return c.json({ message: 'Logout realizado com sucesso' }, 200)
})
