import { Hono } from 'hono'
import { eq, inArray } from 'drizzle-orm'
import { casas } from '../db/schema'
import { CreateCasaSchema, UpdateCasaSchema } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { exigirMasterParaEscrita } from '../middleware/master-write'
import { obterEscoposTerritoriaisVisiveis } from '../security/permissoes'

export const casasRouter = new Hono<any>()

casasRouter.use('*', authMiddleware)
casasRouter.use('*', exigirMasterParaEscrita)

casasRouter.get('/', async (c) => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const visiveis = await obterEscoposTerritoriaisVisiveis(db, contexto)

  if (visiveis.tudo) {
    return c.json(await db.select().from(casas).all())
  }

  const ids = Array.from(visiveis.casasIds)
  if (ids.length === 0) return c.json([])

  const data = await db.select().from(casas).where(inArray(casas.id, ids)).all()
  return c.json(data)
})

casasRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(casas).where(eq(casas.id, id)).get()
  
  if (!data) return c.json({ error: 'Casa de oração não encontrada' }, 404)

  const contexto = c.get('contextoPermissoes')
  const visiveis = await obterEscoposTerritoriaisVisiveis(db, contexto)
  if (!visiveis.tudo && !visiveis.casasIds.has(id)) {
    return c.json({ error: 'Acesso não autorizado para este escopo', code: 'FORBIDDEN' }, 403)
  }

  return c.json(data)
})

casasRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = CreateCasaSchema.parse(body)
    
    const id = crypto.randomUUID()
    const result = await db.insert(casas).values({ id, ...parsed }).returning().get()
    return c.json(result, 201)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Setor vinculado não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

casasRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const parsed = UpdateCasaSchema.parse(body)
    
    const existing = await db.select().from(casas).where(eq(casas.id, id)).get()
    if (!existing) return c.json({ error: 'Casa de oração não encontrada' }, 404)

    const updated = await db.update(casas)
      .set({ ...parsed, updatedAt: new Date().toISOString() })
      .where(eq(casas.id, id))
      .returning().get()
      
    return c.json(updated)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Setor vinculado não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})
