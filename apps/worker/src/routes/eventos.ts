import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { eventos } from '../db/schema'
import { EventoCreate, EventoUpdate } from '@piedade/shared'
import { executarOperacaoComAudit, extrairEscopoDoEvento, AuditLogData } from '../services/auditoria'

export const eventosRouter = new Hono<any>()

eventosRouter.get('/', async (c) => {
  const db = c.get('db')
  // Basic filtering for S04
  const ativo = c.req.query('ativo')
  const modalidade = c.req.query('modalidade')

  const conditions = []
  if (ativo !== undefined) {
    conditions.push(eq(eventos.ativo, ativo === 'true'))
  }
  if (modalidade !== undefined) {
    conditions.push(eq(eventos.modalidade, modalidade))
  }

  const query = db.select().from(eventos)
  const data = conditions.length > 0 
    ? await query.where(and(...conditions)).all()
    : await query.all()

  return c.json(data)
})

eventosRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(eventos).where(eq(eventos.id, id)).get()
  
  if (!data) return c.json({ error: 'Evento não encontrado' }, 404)
  return c.json(data)
})

eventosRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = EventoCreate.parse(body)
    
    const id = crypto.randomUUID()

    const { escopoTipo, escopoId } = extrairEscopoDoEvento(parsed)
    const atorMembroId = c.get('membroId') || parsed.organizadorMembroId || c.req.header('x-membro-id') || null

    const auditData: AuditLogData = {
      acao: 'EVENTO_CRIADO',
      atorMembroId,
      recursoTipo: 'EVENTO',
      recursoId: id,
      escopoTipo,
      escopoId,
      contexto: {
        titulo: parsed.titulo,
        modalidade: parsed.modalidade,
        escopoTipo: escopoTipo || '',
        escopoId: escopoId || '',
      },
      ip: c.req.header('x-forwarded-for') || null,
      userAgent: c.req.header('user-agent') || null,
    }

    await executarOperacaoComAudit(
      db,
      (qdb) => [qdb.insert(eventos).values({ id, ...parsed })],
      auditData
    )

    const result = await db.select().from(eventos).where(eq(eventos.id, id)).get()
    return c.json(result, 201)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Local ou Escopo vinculado não existe' }, 400)
    }
    if (err.message && err.message.includes('CHECK constraint failed')) {
      return c.json({ error: 'Violação de regra de negócio no banco (ex: escopo único)' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

eventosRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const parsed = EventoUpdate.parse(body)
    
    const existing = await db.select().from(eventos).where(eq(eventos.id, id)).get()
    if (!existing) return c.json({ error: 'Evento não encontrado' }, 404)

    // Validar estado final mesclado (existente + patch) com EventoCreate
    const merged = { ...existing, ...parsed }
    EventoCreate.parse(merged)

    // PMO Rule: Ao alterar uma ocorrência individual, preservar serie_recorrencia_id e marcar recorrencia_excecao = true.
    const isExcecao = existing.serieRecorrenciaId !== null ? true : existing.recorrenciaExcecao
    const nowIso = new Date().toISOString()

    const { escopoTipo, escopoId } = extrairEscopoDoEvento(existing)
    const atorMembroId = c.get('membroId') || existing.organizadorMembroId || c.req.header('x-membro-id') || null

    const auditData: AuditLogData = {
      acao: 'EVENTO_ATUALIZADO',
      atorMembroId,
      recursoTipo: 'EVENTO',
      recursoId: id,
      escopoTipo,
      escopoId,
      contexto: {
        titulo: existing.titulo,
        modalidade: existing.modalidade,
        camposAlterados: Object.keys(parsed),
      },
      ip: c.req.header('x-forwarded-for') || null,
      userAgent: c.req.header('user-agent') || null,
    }

    await executarOperacaoComAudit(
      db,
      (qdb) => [
        qdb.update(eventos)
          .set({ ...parsed, recorrenciaExcecao: isExcecao, updatedAt: nowIso })
          .where(eq(eventos.id, id))
      ],
      auditData
    )

    const updated = await db.select().from(eventos).where(eq(eventos.id, id)).get()
    return c.json(updated)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Local ou Escopo vinculado não existe' }, 400)
    }
    if (err.message && err.message.includes('CHECK constraint failed')) {
      return c.json({ error: 'Violação de regra de negócio no banco (ex: escopo único)' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

