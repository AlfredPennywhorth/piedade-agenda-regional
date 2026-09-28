import { Hono } from 'hono'
import { eq, inArray } from 'drizzle-orm'
import { regionais } from '../db/schema'
import { CreateRegionalSchema, UpdateRegionalSchema } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { exigirMasterParaEscrita } from '../middleware/master-write'
import { obterEscoposTerritoriaisVisiveis } from '../security/permissoes'
import { executarOperacaoComAudit } from '../services/auditoria'

export const regionaisRouter = new Hono<any>()

regionaisRouter.use('*', authMiddleware)
regionaisRouter.use('*', exigirMasterParaEscrita)

regionaisRouter.get('/', async (c) => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const visiveis = await obterEscoposTerritoriaisVisiveis(db, contexto)

  if (visiveis.tudo) {
    return c.json(await db.select().from(regionais).all())
  }

  const ids = Array.from(visiveis.regionaisIds)
  if (ids.length === 0) return c.json([])

  const data = await db.select().from(regionais).where(inArray(regionais.id, ids)).all()
  return c.json(data)
})

regionaisRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(regionais).where(eq(regionais.id, id)).get()
  
  if (!data) return c.json({ error: 'Regional não encontrada' }, 404)

  const contexto = c.get('contextoPermissoes')
  const visiveis = await obterEscoposTerritoriaisVisiveis(db, contexto)
  if (!visiveis.tudo && !visiveis.regionaisIds.has(id)) {
    return c.json({ error: 'Acesso não autorizado para este escopo', code: 'FORBIDDEN' }, 403)
  }

  return c.json(data)
})

regionaisRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = CreateRegionalSchema.parse(body)
    
    // Fallback caso crypto n exista localmente em dev sem polyfill, no worker nativo crypto.randomUUID() está ok
    const id = crypto.randomUUID()
    await executarOperacaoComAudit(
      db,
      (qdb) => [qdb.insert(regionais).values({ id, ...parsed })],
      {
        acao: 'REGIONAL_CRIADA',
        atorMembroId: c.get('membroId') || null,
        recursoTipo: 'REGIONAL',
        recursoId: id,
        escopoTipo: 'REGIONAL',
        escopoId: id,
        contexto: { campos: ['nome', 'codigo', 'ativo'] },
      }
    )
    const result = await db.select().from(regionais).where(eq(regionais.id, id)).get()
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

    await executarOperacaoComAudit(
      db,
      (qdb) => [
        qdb.update(regionais)
          .set({ ...parsed, updatedAt: new Date().toISOString() })
          .where(eq(regionais.id, id))
      ],
      {
        acao: 'REGIONAL_ATUALIZADA',
        atorMembroId: c.get('membroId') || null,
        recursoTipo: 'REGIONAL',
        recursoId: id,
        escopoTipo: 'REGIONAL',
        escopoId: id,
        contexto: { camposAlterados: Object.keys(parsed) },
      }
    )
    const updated = await db.select().from(regionais).where(eq(regionais.id, id)).get()
    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})
