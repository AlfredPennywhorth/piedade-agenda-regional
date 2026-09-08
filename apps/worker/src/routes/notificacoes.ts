import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and } from 'drizzle-orm'
import { PushSubscriptionSchema } from '@piedade/shared'
import { pushSubscriptions } from '../db/schema'
import { authMiddleware } from './auth/middleware'

export const notificacoesRouter = new Hono<{ Variables: { db: any; membroId: string } }>()

notificacoesRouter.use('*', authMiddleware)

notificacoesRouter.post('/subscribe', zValidator('json', PushSubscriptionSchema), async c => {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const payload = c.req.valid('json')
  
  const userAgent = c.req.header('user-agent') || null
  const id = crypto.randomUUID()

  // Upsert on endpoint
  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, payload.endpoint))
    .get()

  if (existing) {
    if (existing.membroId !== membroId) {
      // Outro membro tentando usar o mesmo endpoint (muito improvável, mas previne roubo de subscription)
      return c.json({ error: 'Endpoint já associado a outro membro' }, 403)
    }

    await db
      .update(pushSubscriptions)
      .set({
        p256dh: payload.keys.p256dh,
        auth: payload.keys.auth,
        userAgent,
        ativo: true,
        updatedAt: new Date().toISOString()
      })
      .where(eq(pushSubscriptions.id, existing.id))
      .run()

    return c.json({ id: existing.id, status: 'updated' })
  }

  await db
    .insert(pushSubscriptions)
    .values({
      id,
      membroId,
      endpoint: payload.endpoint,
      p256dh: payload.keys.p256dh,
      auth: payload.keys.auth,
      userAgent,
      ativo: true
    })
    .run()

  return c.json({ id, status: 'created' }, 201)
})

notificacoesRouter.delete('/unsubscribe', async c => {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const { endpoint } = await c.req.json().catch(() => ({ endpoint: null }))

  if (!endpoint) {
    return c.json({ error: 'Endpoint é obrigatório para unsubscribe' }, 400)
  }

  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.endpoint, endpoint),
        eq(pushSubscriptions.membroId, membroId)
      )
    )
    .get()

  if (!existing) {
    return c.json({ error: 'Subscription não encontrada' }, 404)
  }

  await db
    .update(pushSubscriptions)
    .set({
      ativo: false,
      updatedAt: new Date().toISOString()
    })
    .where(eq(pushSubscriptions.id, existing.id))
    .run()

  return c.json({ status: 'unsubscribed' })
})
