import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { locais } from '../db/schema'
import { LocalCreate, LocalUpdate } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { exigirMasterParaEscrita } from '../middleware/master-write'

export const locaisRouter = new Hono<any>()

locaisRouter.use('*', authMiddleware)
locaisRouter.use('*', exigirMasterParaEscrita)

locaisRouter.get('/', async (c) => {
  const db = c.get('db')
  const data = await db.select().from(locais).all()
  return c.json(data)
})

locaisRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(locais).where(eq(locais.id, id)).get()
  
  if (!data) return c.json({ error: 'Local não encontrado' }, 404)
  return c.json(data)
})

locaisRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = LocalCreate.parse(body)
    
    const id = crypto.randomUUID()
    const result = await db.insert(locais).values({ id, ...parsed }).returning().get()
    return c.json(result, 201)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})

locaisRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const parsed = LocalUpdate.parse(body)
    
    const existing = await db.select().from(locais).where(eq(locais.id, id)).get()
    if (!existing) return c.json({ error: 'Local não encontrado' }, 404)

    const updated = await db.update(locais)
      .set({ ...parsed, updatedAt: new Date().toISOString() })
      .where(eq(locais.id, id))
      .returning().get()
      
    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})
