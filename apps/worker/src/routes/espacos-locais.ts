import { Hono } from 'hono'
import { and, eq, isNull, or } from 'drizzle-orm'
import { espacosLocal, locais } from '../db/schema'
import { EspacoLocalCreate, EspacoLocalUpdate } from '@piedade/shared'
import { authMiddleware } from '../middleware/auth'
import { exigirMasterParaEscrita } from '../middleware/master-write'
import { executarOperacaoComAudit } from '../services/auditoria'

export const espacosLocaisRouter = new Hono<any>()

espacosLocaisRouter.use('*', authMiddleware)

espacosLocaisRouter.get('/', async c => {
  const db = c.get('db')
  const localId = c.req.query('localId')
  const ativo = c.req.query('ativo')
  const conditions = [or(isNull(espacosLocal.proprietarioMembroId), eq(espacosLocal.proprietarioMembroId, c.get('membroId')))]
  if (localId) conditions.push(eq(espacosLocal.localId, localId))
  if (ativo !== undefined) conditions.push(eq(espacosLocal.ativo, ativo === 'true'))

  const query = db.select().from(espacosLocal)
  const data = conditions.length ? await query.where(and(...conditions)).all() : await query.all()
  data.sort((a: typeof espacosLocal.$inferSelect, b: typeof espacosLocal.$inferSelect) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }) || a.id.localeCompare(b.id)
  )
  return c.json(data)
})

espacosLocaisRouter.get('/:id', async c => {
  const db = c.get('db')
  const item = await db.select().from(espacosLocal).where(eq(espacosLocal.id, c.req.param('id'))).get()
  if (!item || (item.proprietarioMembroId && item.proprietarioMembroId !== c.get('membroId'))) return c.json({ error: 'Espaço não encontrado' }, 404)
  return c.json(item)
})

espacosLocaisRouter.post('/particulares', async c => {
  const db = c.get('db')
  const proprietarioMembroId = c.get('membroId')
  if (!proprietarioMembroId) return c.json({ error: 'Sessão não autenticada' }, 401)
  try {
    const parsed = EspacoLocalCreate.parse(await c.req.json())
    const local = await db.select().from(locais).where(and(eq(locais.id, parsed.localId), eq(locais.proprietarioMembroId, proprietarioMembroId))).get()
    if (!local) return c.json({ error: 'Local particular não encontrado' }, 404)
    const id = crypto.randomUUID()
    await executarOperacaoComAudit(db, qdb => [qdb.insert(espacosLocal).values({
      id, ...parsed, proprietarioMembroId,
    })], {
      acao: 'ESPACO_PARTICULAR_CRIADO',
      atorMembroId: proprietarioMembroId, recursoTipo: 'ESPACO_LOCAL', recursoId: id,
      escopoTipo: 'PESSOAL', escopoId: proprietarioMembroId,
      contexto: { localId: parsed.localId },
    })
    return c.json(await db.select().from(espacosLocal).where(eq(espacosLocal.id,id)).get(), 201)
  } catch (err: any) {
    if (String(err.message).includes('UNIQUE constraint')) return c.json({ error: 'Espaço já cadastrado neste local' }, 409)
    return c.json({ error: err.issues || err.message }, 400)
  }
})

espacosLocaisRouter.post('/', exigirMasterParaEscrita, async c => {
  const db = c.get('db')
  try {
    const parsed = EspacoLocalCreate.parse(await c.req.json())
    const local = await db.select().from(locais).where(eq(locais.id, parsed.localId)).get()
    if (!local || local.proprietarioMembroId) return c.json({ error: 'Local institucional não encontrado' }, 404)
    const id = crypto.randomUUID()
    await executarOperacaoComAudit(
      db,
      qdb => [qdb.insert(espacosLocal).values({ id, ...parsed })],
      {
        acao: 'ESPACO_LOCAL_CRIADO',
        atorMembroId: c.get('membroId') || null,
        recursoTipo: 'ESPACO_LOCAL',
        recursoId: id,
        escopoTipo: 'GLOBAL',
        escopoId: null,
        contexto: { localId: parsed.localId, nome: parsed.nome },
      }
    )
    return c.json(await db.select().from(espacosLocal).where(eq(espacosLocal.id, id)).get(), 201)
  } catch (err: any) {
    if (err.message?.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Local vinculado não existe' }, 400)
    }
    if (err.message?.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Já existe um espaço ativo com este nome neste Local' }, 409)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

espacosLocaisRouter.patch('/:id', exigirMasterParaEscrita, async c => {
  const db = c.get('db')
  try {
    const id = c.req.param('id')
    const existing = await db.select().from(espacosLocal).where(eq(espacosLocal.id, id)).get()
    if (!existing || existing.proprietarioMembroId) return c.json({ error: 'Espaço institucional não encontrado' }, 404)
    const parsed = EspacoLocalUpdate.parse(await c.req.json())
    if (parsed.localId && parsed.localId !== existing.localId) {
      return c.json(
        { error: 'O Local de um Espaço não pode ser alterado. Cadastre um novo Espaço no Local correto.', code: 'ESPACO_LOCAL_IMUTAVEL' },
        409
      )
    }
    await executarOperacaoComAudit(
      db,
      qdb => [
        qdb.update(espacosLocal)
          .set({ ...parsed, updatedAt: new Date().toISOString() })
          .where(eq(espacosLocal.id, id))
      ],
      {
        acao: 'ESPACO_LOCAL_ATUALIZADO',
        atorMembroId: c.get('membroId') || null,
        recursoTipo: 'ESPACO_LOCAL',
        recursoId: id,
        escopoTipo: 'GLOBAL',
        escopoId: null,
        contexto: { localId: parsed.localId ?? existing.localId, camposAlterados: Object.keys(parsed) },
      }
    )
    return c.json(await db.select().from(espacosLocal).where(eq(espacosLocal.id, id)).get())
  } catch (err: any) {
    if (err.message?.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Local vinculado não existe' }, 400)
    }
    if (err.message?.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Já existe um espaço ativo com este nome neste Local' }, 409)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})
