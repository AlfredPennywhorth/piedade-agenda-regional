import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { administracoes } from '../db/schema'
import { CreateAdministracaoSchema, UpdateAdministracaoSchema } from '@piedade/shared'

export const administracoesRouter = new Hono<any>()

administracoesRouter.get('/', async (c) => {
  const db = c.get('db')
  const data = await db.select().from(administracoes).all()
  return c.json(data)
})

administracoesRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(administracoes).where(eq(administracoes.id, id)).get()
  
  if (!data) return c.json({ error: 'Administração não encontrada' }, 404)
  return c.json(data)
})

administracoesRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = CreateAdministracaoSchema.parse(body)
    
    const id = crypto.randomUUID()
    const result = await db.insert(administracoes).values({ id, ...parsed }).returning().get()
    return c.json(result, 201)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Regional vinculada não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

administracoesRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const parsed = UpdateAdministracaoSchema.parse(body)
    
    const existing = await db.select().from(administracoes).where(eq(administracoes.id, id)).get()
    if (!existing) return c.json({ error: 'Administração não encontrada' }, 404)

    const updated = await db.update(administracoes)
      .set({ ...parsed, updatedAt: new Date().toISOString() })
      .where(eq(administracoes.id, id))
      .returning().get()
      
    return c.json(updated)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Regional vinculada não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})
