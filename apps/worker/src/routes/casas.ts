import { Hono } from 'hono'
import { eq, inArray } from 'drizzle-orm'
import { casas } from '../db/schema'
import { CreateCasaSchema, UpdateCasaSchema } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { eMasterSistema, obterEscoposTerritoriaisVisiveis, podeAdministrarEscopo, regionaisAdministradas } from '../security/permissoes'
import { executarOperacaoComAudit } from '../services/auditoria'

export const casasRouter = new Hono<any>()

casasRouter.use('*', authMiddleware)
casasRouter.use('*', async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
    await next()
    return
  }

  const contexto = c.get('contextoPermissoes')
  if (!contexto || (!eMasterSistema(contexto) && regionaisAdministradas(contexto).size === 0)) {
    return c.json({ error: 'Acesso não autorizado para administrar estrutura', code: 'FORBIDDEN' }, 403)
  }

  await next()
})

casasRouter.get('/', async (c) => {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')
  const visiveis = await obterEscoposTerritoriaisVisiveis(db, contexto)

  if (visiveis.tudo) {
    return c.json(await db.select().from(casas).all())
  }

  const ids = Array.from(visiveis.casasIds)
  if (ids.length === 0) return c.json([])

  const LIMITE_IDS_D1 = 90
  const data: Array<typeof casas.$inferSelect> = []

  for (let i = 0; i < ids.length; i += LIMITE_IDS_D1) {
    const lote = ids.slice(i, i + LIMITE_IDS_D1)
    const parcial = await db.select().from(casas).where(inArray(casas.id, lote)).all()
    data.push(...parcial)
  }

  data.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
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
    
    if (!(await podeAdministrarEscopo(db, c.get('contextoPermissoes'), 'SETOR', parsed.setorId))) {
      return c.json({ error: 'Acesso não autorizado para administrar este escopo', code: 'FORBIDDEN' }, 403)
    }

    const id = crypto.randomUUID()
    await executarOperacaoComAudit(
      db,
      (qdb) => [qdb.insert(casas).values({ id, ...parsed })],
      {
        acao: 'CASA_CRIADA',
        atorMembroId: c.get('membroId') || null,
        recursoTipo: 'CASA',
        recursoId: id,
        escopoTipo: 'CASA',
        escopoId: id,
        contexto: { setorId: parsed.setorId },
      }
    )
    const result = await db.select().from(casas).where(eq(casas.id, id)).get()
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

    const contexto = c.get('contextoPermissoes')
    const setorFinal = parsed.setorId ?? existing.setorId
    const [podeAtual, podeFinal] = await Promise.all([
      podeAdministrarEscopo(db, contexto, 'SETOR', existing.setorId),
      podeAdministrarEscopo(db, contexto, 'SETOR', setorFinal),
    ])
    if (!podeAtual || !podeFinal) {
      return c.json({ error: 'Acesso não autorizado para administrar este escopo', code: 'FORBIDDEN' }, 403)
    }

    await executarOperacaoComAudit(
      db,
      (qdb) => [
        qdb.update(casas)
          .set({ ...parsed, updatedAt: new Date().toISOString() })
          .where(eq(casas.id, id))
      ],
      {
        acao: 'CASA_ATUALIZADA',
        atorMembroId: c.get('membroId') || null,
        recursoTipo: 'CASA',
        recursoId: id,
        escopoTipo: 'CASA',
        escopoId: id,
        contexto: { camposAlterados: Object.keys(parsed) },
      }
    )
    const updated = await db.select().from(casas).where(eq(casas.id, id)).get()
    return c.json(updated)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Setor vinculado não existe' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})
