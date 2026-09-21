import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { funcoes } from '../db/schema'
import { CreateFuncaoSchema, UpdateFuncaoSchema } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'

export const funcoesRouter = new Hono<any>()

funcoesRouter.use('*', authMiddleware)

funcoesRouter.get('/', async (c) => {
  const db = c.get('db')
  const data = await db.select().from(funcoes).all()
  return c.json(data)
})

funcoesRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(funcoes).where(eq(funcoes.id, id)).get()
  
  if (!data) return c.json({ error: 'Função não encontrada' }, 404)
  return c.json(data)
})

funcoesRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = CreateFuncaoSchema.parse(body)
    
    const id = crypto.randomUUID()
    const result = await db.insert(funcoes).values({ id, ...parsed }).returning().get()
    return c.json(result, 201)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})

funcoesRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const parsed = UpdateFuncaoSchema.parse(body)
    
    const existing = await db.select().from(funcoes).where(eq(funcoes.id, id)).get()
    if (!existing) return c.json({ error: 'Função não encontrada' }, 404)

    const updated = await db.update(funcoes)
      .set({ ...parsed, updatedAt: new Date().toISOString() })
      .where(eq(funcoes.id, id))
      .returning().get()
      
    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})
