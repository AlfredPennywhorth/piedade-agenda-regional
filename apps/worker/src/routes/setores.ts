import { Hono } from 'hono'
import { eq, inArray } from 'drizzle-orm'
import * as schema from '../db/schema'
import { CreateSetorSchema, UpdateSetorSchema } from '@piedade/shared'
import { authMiddleware, Variables } from '../middleware/auth'
import { eMaster, podeAdministrarRegional, regionaisAdministradas } from '../security/autorizacao'
import { executeAtomic } from '../db/batch'

export const setoresRouter = new Hono<{ Variables: Variables }>()

setoresRouter.use('*', authMiddleware)

async function regionalDaAdministracao(db: any, administracaoId: string) {
  const item = await db.select({ regionalId: schema.administracoes.regionalId })
    .from(schema.administracoes)
    .where(eq(schema.administracoes.id, administracaoId))
    .get()
  return item?.regionalId ?? null
}

setoresRouter.get('/', async c => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  if (eMaster(contexto)) return c.json(await db.select().from(schema.setores).all())

  const ids = Array.from(regionaisAdministradas(contexto))
  if (ids.length === 0) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }

  const rows = await db.select({ setor: schema.setores })
    .from(schema.setores)
    .innerJoin(schema.administracoes, eq(schema.setores.administracaoId, schema.administracoes.id))
    .where(inArray(schema.administracoes.regionalId, ids))
    .all()
  return c.json(rows.map((row: any) => row.setor))
})

setoresRouter.get('/:id', async c => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(schema.setores)
    .where(eq(schema.setores.id, id)).get()
  if (!data) return c.json({ error: 'Setor não encontrado' }, 404)

  const regionalId = await regionalDaAdministracao(db, data.administracaoId)
  if (!regionalId || !podeAdministrarRegional(c.get('contextoPermissoes'), regionalId)) {
    return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
  }
  return c.json(data)
})

setoresRouter.post('/', async c => {
  const db = c.get('db')
  try {
    const parsed = CreateSetorSchema.parse(await c.req.json())
    const regionalId = await regionalDaAdministracao(db, parsed.administracaoId)
    if (!regionalId) return c.json({ error: 'Administração vinculada não existe' }, 400)
    if (!podeAdministrarRegional(c.get('contextoPermissoes'), regionalId)) {
      return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
    }

    const id = crypto.randomUUID()
    const agora = new Date().toISOString()
    await executeAtomic(db, tx => [
      tx.insert(schema.setores).values({ id, ...parsed }),
      tx.insert(schema.auditoriaLogs).values({
        id: crypto.randomUUID(),
        acao: 'SETOR_CRIADO',
        atorMembroId: c.get('membroId'),
        atorContaAcessoId: c.get('contaAcessoId'),
        recursoTipo: 'SETOR',
        recursoId: id,
        escopoTipo: 'REGIONAL',
        escopoId: regionalId,
        contexto: JSON.stringify({ camposAlterados: Object.keys(parsed) }),
        criadoEm: agora,
      }),
    ])
    const result = await db.select().from(schema.setores)
      .where(eq(schema.setores.id, id)).get()
    return c.json(result, 201)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})

setoresRouter.patch('/:id', async c => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const parsed = UpdateSetorSchema.parse(await c.req.json())
    const existing = await db.select().from(schema.setores)
      .where(eq(schema.setores.id, id)).get()
    if (!existing) return c.json({ error: 'Setor não encontrado' }, 404)

    const regionalAtual = await regionalDaAdministracao(db, existing.administracaoId)
    const administracaoNova = parsed.administracaoId ?? existing.administracaoId
    const regionalNova = await regionalDaAdministracao(db, administracaoNova)
    const contexto = c.get('contextoPermissoes')
    if (
      !regionalAtual ||
      !regionalNova ||
      !podeAdministrarRegional(contexto, regionalAtual) ||
      !podeAdministrarRegional(contexto, regionalNova)
    ) {
      return c.json({ error: 'Acesso não autorizado', code: 'FORBIDDEN' }, 403)
    }

    const agora = new Date().toISOString()
    await executeAtomic(db, tx => [
      tx.update(schema.setores).set({ ...parsed, updatedAt: agora })
        .where(eq(schema.setores.id, id)),
      tx.insert(schema.auditoriaLogs).values({
        id: crypto.randomUUID(),
        acao: 'SETOR_ALTERADO',
        atorMembroId: c.get('membroId'),
        atorContaAcessoId: c.get('contaAcessoId'),
        recursoTipo: 'SETOR',
        recursoId: id,
        escopoTipo: 'REGIONAL',
        escopoId: regionalNova,
        contexto: JSON.stringify({ camposAlterados: Object.keys(parsed) }),
        criadoEm: agora,
      }),
    ])
    const updated = await db.select().from(schema.setores)
      .where(eq(schema.setores.id, id)).get()
    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})
