import { Hono } from 'hono'
import { eq, inArray } from 'drizzle-orm'
import * as schema from '../db/schema'
import { CreateAdministracaoSchema, UpdateAdministracaoSchema } from '@piedade/shared'
import { authMiddleware, Variables } from '../middleware/auth'
import { eMaster, podeAdministrarRegional, regionaisAdministradas } from '../security/autorizacao'
import { executeAtomic } from '../db/batch'

export const administracoesRouter = new Hono<{ Variables: Variables }>()

administracoesRouter.use('*', authMiddleware)

administracoesRouter.get('/', async c => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  if (eMaster(contexto)) {
    return c.json(await db.select().from(schema.administracoes).all())
  }

  const ids = Array.from(regionaisAdministradas(contexto))
  if (ids.length === 0) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }
  return c.json(
    await db.select().from(schema.administracoes)
      .where(inArray(schema.administracoes.regionalId, ids)).all()
  )
})

administracoesRouter.get('/:id', async c => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(schema.administracoes)
    .where(eq(schema.administracoes.id, id)).get()

  if (!data) return c.json({ error: 'Administração não encontrada' }, 404)
  if (!podeAdministrarRegional(c.get('contextoPermissoes'), data.regionalId)) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }
  return c.json(data)
})

administracoesRouter.post('/', async c => {
  const db = c.get('db')
  try {
    const parsed = CreateAdministracaoSchema.parse(await c.req.json())
    if (!podeAdministrarRegional(c.get('contextoPermissoes'), parsed.regionalId)) {
      return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
    }

    const id = crypto.randomUUID()
    const agora = new Date().toISOString()
    await executeAtomic(db, tx => [
      tx.insert(schema.administracoes).values({ id, ...parsed }),
      tx.insert(schema.auditoriaLogs).values({
        id: crypto.randomUUID(),
        acao: 'ADMINISTRACAO_CRIADA',
        atorMembroId: c.get('membroId'),
        atorContaAcessoId: c.get('contaAcessoId'),
        recursoTipo: 'ADMINISTRACAO',
        recursoId: id,
        escopoTipo: 'REGIONAL',
        escopoId: parsed.regionalId,
        contexto: JSON.stringify({ camposAlterados: Object.keys(parsed) }),
        criadoEm: agora,
      }),
    ])
    const result = await db.select().from(schema.administracoes)
      .where(eq(schema.administracoes.id, id)).get()
    return c.json(result, 201)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Regional vinculada não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

administracoesRouter.patch('/:id', async c => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const parsed = UpdateAdministracaoSchema.parse(await c.req.json())
    const existing = await db.select().from(schema.administracoes)
      .where(eq(schema.administracoes.id, id)).get()
    if (!existing) return c.json({ error: 'Administração não encontrada' }, 404)

    const contexto = c.get('contextoPermissoes')
    const regionalNova = parsed.regionalId ?? existing.regionalId
    if (
      !podeAdministrarRegional(contexto, existing.regionalId) ||
      !podeAdministrarRegional(contexto, regionalNova)
    ) {
      return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
    }

    const agora = new Date().toISOString()
    await executeAtomic(db, tx => [
      tx.update(schema.administracoes)
        .set({ ...parsed, updatedAt: agora })
        .where(eq(schema.administracoes.id, id)),
      tx.insert(schema.auditoriaLogs).values({
        id: crypto.randomUUID(),
        acao: 'ADMINISTRACAO_ALTERADA',
        atorMembroId: c.get('membroId'),
        atorContaAcessoId: c.get('contaAcessoId'),
        recursoTipo: 'ADMINISTRACAO',
        recursoId: id,
        escopoTipo: 'REGIONAL',
        escopoId: regionalNova,
        contexto: JSON.stringify({ camposAlterados: Object.keys(parsed) }),
        criadoEm: agora,
      }),
    ])

    const updated = await db.select().from(schema.administracoes)
      .where(eq(schema.administracoes.id, id)).get()
    return c.json(updated)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Regional vinculada não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})
