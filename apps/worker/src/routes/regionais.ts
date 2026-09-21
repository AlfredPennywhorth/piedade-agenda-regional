import { Hono } from 'hono'
import { eq, inArray } from 'drizzle-orm'
import * as schema from '../db/schema'
import { CreateRegionalSchema, UpdateRegionalSchema } from '@piedade/shared'
import { authMiddleware, Variables } from '../middleware/auth'
import { eMaster, regionaisAdministradas } from '../security/autorizacao'
import { executeAtomic } from '../db/batch'

export const regionaisRouter = new Hono<{ Variables: Variables }>()

regionaisRouter.use('*', authMiddleware)

regionaisRouter.get('/', async c => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')

  if (eMaster(contexto)) {
    return c.json(await db.select().from(schema.regionais).all())
  }

  const ids = Array.from(regionaisAdministradas(contexto))
  if (ids.length === 0) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }

  return c.json(
    await db.select().from(schema.regionais).where(inArray(schema.regionais.id, ids)).all()
  )
})

regionaisRouter.get('/:id', async c => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const id = c.req.param('id')

  if (!eMaster(contexto) && !regionaisAdministradas(contexto).has(id)) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }

  const data = await db.select().from(schema.regionais)
    .where(eq(schema.regionais.id, id)).get()
  if (!data) return c.json({ error: 'Regional não encontrada' }, 404)
  return c.json(data)
})

regionaisRouter.post('/', async c => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  if (!eMaster(contexto)) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }

  try {
    const parsed = CreateRegionalSchema.parse(await c.req.json())
    const id = crypto.randomUUID()
    const agora = new Date().toISOString()

    await executeAtomic(db, tx => [
      tx.insert(schema.regionais).values({ id, ...parsed }),
      tx.insert(schema.auditoriaLogs).values({
        id: crypto.randomUUID(),
        acao: 'REGIONAL_CRIADA',
        atorMembroId: c.get('membroId'),
        atorContaAcessoId: c.get('contaAcessoId'),
        recursoTipo: 'REGIONAL',
        recursoId: id,
        escopoTipo: 'GLOBAL',
        escopoId: null,
        contexto: JSON.stringify({ camposAlterados: Object.keys(parsed) }),
        criadoEm: agora,
      }),
    ])

    const result = await db.select().from(schema.regionais)
      .where(eq(schema.regionais.id, id)).get()
    return c.json(result, 201)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})

regionaisRouter.patch('/:id', async c => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  if (!eMaster(contexto)) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }

  const id = c.req.param('id')
  try {
    const parsed = UpdateRegionalSchema.parse(await c.req.json())
    const existing = await db.select().from(schema.regionais)
      .where(eq(schema.regionais.id, id)).get()
    if (!existing) return c.json({ error: 'Regional não encontrada' }, 404)

    const agora = new Date().toISOString()
    await executeAtomic(db, tx => [
      tx.update(schema.regionais)
        .set({ ...parsed, updatedAt: agora })
        .where(eq(schema.regionais.id, id)),
      tx.insert(schema.auditoriaLogs).values({
        id: crypto.randomUUID(),
        acao: 'REGIONAL_ALTERADA',
        atorMembroId: c.get('membroId'),
        atorContaAcessoId: c.get('contaAcessoId'),
        recursoTipo: 'REGIONAL',
        recursoId: id,
        escopoTipo: 'GLOBAL',
        escopoId: null,
        contexto: JSON.stringify({ camposAlterados: Object.keys(parsed) }),
        criadoEm: agora,
      }),
    ])

    const updated = await db.select().from(schema.regionais)
      .where(eq(schema.regionais.id, id)).get()
    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})
