import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { gruposTrabalho } from '../db/schema'
import { CreateGrupoTrabalhoSchema, UpdateGrupoTrabalhoSchema } from '@piedade/shared'

export const gruposTrabalhoRouter = new Hono<any>()

gruposTrabalhoRouter.get('/', async (c) => {
  const db = c.get('db')
  const data = await db.select().from(gruposTrabalho).all()
  return c.json(data)
})

gruposTrabalhoRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(gruposTrabalho).where(eq(gruposTrabalho.id, id)).get()
  
  if (!data) return c.json({ error: 'Grupo de Trabalho não encontrado' }, 404)
  return c.json(data)
})

gruposTrabalhoRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = CreateGrupoTrabalhoSchema.parse(body)
    
    const id = crypto.randomUUID()
    const result = await db.insert(gruposTrabalho).values({ id, ...parsed }).returning().get()
    return c.json(result, 201)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'O escopo vinculado (Regional/Administração/Setor) não existe' }, 400)
    }
    if (err.message && err.message.includes('CHECK constraint failed: check_escopo_unico')) {
      return c.json({ error: 'O banco de dados rejeitou os escopos. Deve existir exatamente 1 escopo.' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

gruposTrabalhoRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const parsed = UpdateGrupoTrabalhoSchema.parse(body)
    
    const existing = await db.select().from(gruposTrabalho).where(eq(gruposTrabalho.id, id)).get()
    if (!existing) return c.json({ error: 'Grupo de Trabalho não encontrado' }, 404)

    const updated = await db.update(gruposTrabalho)
      .set({ ...parsed, updatedAt: new Date().toISOString().replace('T', ' ').replace('Z', '') })
      .where(eq(gruposTrabalho.id, id))
      .returning().get()
      
    return c.json(updated)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'O escopo vinculado (Regional/Administração/Setor) não existe' }, 400)
    }
    if (err.message && err.message.includes('CHECK constraint failed: check_escopo_unico')) {
      return c.json({ error: 'O banco de dados rejeitou os escopos. Deve existir exatamente 1 escopo.' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})
