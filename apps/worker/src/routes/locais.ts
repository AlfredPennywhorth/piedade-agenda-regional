import { Hono } from 'hono'
import { eq, isNull, or } from 'drizzle-orm'
import { locais } from '../db/schema'
import { LocalCreate, LocalUpdate } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { exigirMasterParaEscrita } from '../middleware/master-write'
import { executarOperacaoComAudit } from '../services/auditoria'

export const locaisRouter = new Hono<any>()

locaisRouter.use('*', authMiddleware)

locaisRouter.get('/', async (c) => {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const data = await db.select().from(locais).where(or(isNull(locais.proprietarioMembroId), eq(locais.proprietarioMembroId, membroId))).all()
  return c.json(data)
})

locaisRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(locais).where(eq(locais.id, id)).get()
  
  if (!data || (data.proprietarioMembroId && data.proprietarioMembroId !== c.get('membroId'))) return c.json({ error: 'Local não encontrado' }, 404)
  return c.json(data)
})

// Local particular: não entra no cadastro institucional e só seu proprietário o administra.
locaisRouter.post('/particulares', async c => {
  const db = c.get('db')
  const proprietarioMembroId = c.get('membroId')
  if (!proprietarioMembroId) return c.json({ error: 'Sessão não autenticada' }, 401)
  try {
    const parsed = LocalCreate.parse(await c.req.json())
    const id = crypto.randomUUID()
    await executarOperacaoComAudit(db, qdb => [qdb.insert(locais).values({
      id, ...parsed, proprietarioMembroId,
    })], {
      acao: 'LOCAL_PARTICULAR_CRIADO',
      atorMembroId: proprietarioMembroId, recursoTipo: 'LOCAL', recursoId: id,
      escopoTipo: 'PESSOAL', escopoId: proprietarioMembroId,
      contexto: { cidade: parsed.cidade, uf: parsed.uf },
    })
    return c.json(await db.select().from(locais).where(eq(locais.id, id)).get(), 201)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})

locaisRouter.post('/', exigirMasterParaEscrita, async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = LocalCreate.parse(body)
    
    const id = crypto.randomUUID()
    const atorMembroId = c.get('membroId') || null
    await executarOperacaoComAudit(
      db,
      (qdb) => [qdb.insert(locais).values({ id, ...parsed })],
      {
        acao: 'LOCAL_CRIADO',
        atorMembroId,
        recursoTipo: 'LOCAL',
        recursoId: id,
        escopoTipo: 'GLOBAL',
        escopoId: null,
        contexto: { nome: parsed.nome, cidade: parsed.cidade, uf: parsed.uf },
      }
    )
    const result = await db.select().from(locais).where(eq(locais.id, id)).get()
    return c.json(result, 201)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})

locaisRouter.patch('/:id', exigirMasterParaEscrita, async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const parsed = LocalUpdate.parse(body)
    
    const existing = await db.select().from(locais).where(eq(locais.id, id)).get()
    if (!existing || existing.proprietarioMembroId) return c.json({ error: 'Local institucional não encontrado' }, 404)

    const atorMembroId = c.get('membroId') || null
    await executarOperacaoComAudit(
      db,
      (qdb) => [
        qdb.update(locais)
          .set({ ...parsed, updatedAt: new Date().toISOString() })
          .where(eq(locais.id, id))
      ],
      {
        acao: 'LOCAL_ATUALIZADO',
        atorMembroId,
        recursoTipo: 'LOCAL',
        recursoId: id,
        escopoTipo: 'GLOBAL',
        escopoId: null,
        contexto: { camposAlterados: Object.keys(parsed) },
      }
    )
    const updated = await db.select().from(locais).where(eq(locais.id, id)).get()
    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})
