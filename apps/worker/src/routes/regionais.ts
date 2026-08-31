import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { regionais } from '../db/schema'
import { CreateRegionalSchema, UpdateRegionalSchema } from '@piedade/shared'

export const regionaisRouter = new Hono<any>()

regionaisRouter.get('/', async (c) => {
  const db = c.get('db')
  const data = await db.select().from(regionais).all()
  return c.json(data)
})

regionaisRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(regionais).where(eq(regionais.id, id)).get()
  
  if (!data) return c.json({ error: 'Regional não encontrada' }, 404)
  return c.json(data)
})

regionaisRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = CreateRegionalSchema.parse(body)
    
    // Fallback caso crypto n exista localmente em dev sem polyfill, no worker nativo crypto.randomUUID() está ok
    const id = crypto.randomUUID()
    const result = await db.insert(regionais).values({ id, ...parsed }).returning().get()
    return c.json(result, 201)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})

regionaisRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const parsed = UpdateRegionalSchema.parse(body)
    
    const existing = await db.select().from(regionais).where(eq(regionais.id, id)).get()
    if (!existing) return c.json({ error: 'Regional não encontrada' }, 404)

    const updated = await db.update(regionais)
      .set({ ...parsed, updatedAt: new Date().toISOString().replace('T', ' ').replace('Z', '') })
      .where(eq(regionais.id, id))
      .returning().get()
      
    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})
