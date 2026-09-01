import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { membros, vinculosFuncionais } from '../db/schema'
import { CreateMembroSchema, UpdateMembroSchema } from '@piedade/shared'

export const membrosRouter = new Hono<any>()

membrosRouter.get('/', async (c) => {
  const db = c.get('db')
  const data = await db.select().from(membros).all()
  return c.json(data)
})

membrosRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(membros).where(eq(membros.id, id)).get()
  
  if (!data) return c.json({ error: 'Membro não encontrado' }, 404)
  return c.json(data)
})

membrosRouter.get('/:id/vinculos', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  
  const membroExists = await db.select().from(membros).where(eq(membros.id, id)).get()
  if (!membroExists) return c.json({ error: 'Membro não encontrado' }, 404)

  const data = await db.select().from(vinculosFuncionais).where(eq(vinculosFuncionais.membroId, id)).all()
  return c.json(data)
})

membrosRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = CreateMembroSchema.parse(body)
    
    const id = crypto.randomUUID()
    const result = await db.insert(membros).values({ id, ...parsed }).returning().get()
    return c.json(result, 201)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Casa vinculada não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

membrosRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const parsed = UpdateMembroSchema.parse(body)
    
    const existing = await db.select().from(membros).where(eq(membros.id, id)).get()
    if (!existing) return c.json({ error: 'Membro não encontrado' }, 404)

    const updated = await db.update(membros)
      .set({ ...parsed, updatedAt: new Date().toISOString() })
      .where(eq(membros.id, id))
      .returning().get()
      
    return c.json(updated)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Casa vinculada não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})
