import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { setores } from '../db/schema'
import { CreateSetorSchema, UpdateSetorSchema } from '@piedade/shared'

export const setoresRouter = new Hono<any>()

setoresRouter.get('/', async (c) => {
  const db = c.get('db')
  const data = await db.select().from(setores).all()
  return c.json(data)
})

setoresRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(setores).where(eq(setores.id, id)).get()
  
  if (!data) return c.json({ error: 'Setor não encontrado' }, 404)
  return c.json(data)
})

setoresRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = CreateSetorSchema.parse(body)
    
    const id = crypto.randomUUID()
    const result = await db.insert(setores).values({ id, ...parsed }).returning().get()
    return c.json(result, 201)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Administração vinculada não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

setoresRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const parsed = UpdateSetorSchema.parse(body)
    
    const existing = await db.select().from(setores).where(eq(setores.id, id)).get()
    if (!existing) return c.json({ error: 'Setor não encontrado' }, 404)

    const updated = await db.update(setores)
      .set({ ...parsed, updatedAt: new Date().toISOString() })
      .where(eq(setores.id, id))
      .returning().get()
      
    return c.json(updated)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Administração vinculada não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})
