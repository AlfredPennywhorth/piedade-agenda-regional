import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { eventos, eventoRefeicoes } from '../db/schema'
import { EventoRefeicaoCreate } from '@piedade/shared'

export const eventoRefeicoesRouter = new Hono<any>()

eventoRefeicoesRouter.get('/:eventoId/refeicoes', async (c) => {
  const db = c.get('db')
  const eventoId = c.req.param('eventoId')
  
  const evento = await db.select().from(eventos).where(eq(eventos.id, eventoId)).get()
  if (!evento) return c.json({ error: 'Evento não encontrado' }, 404)

  const refeicoes = await db.select().from(eventoRefeicoes)
    .where(and(
      eq(eventoRefeicoes.eventoId, eventoId),
      eq(eventoRefeicoes.ativo, true)
    )).all()

  return c.json(refeicoes)
})

eventoRefeicoesRouter.post('/:eventoId/refeicoes', async (c) => {
  const db = c.get('db')
  const eventoId = c.req.param('eventoId')
  
  try {
    const body = await c.req.json()
    const parsed = EventoRefeicaoCreate.parse(body)
    
    const evento = await db.select().from(eventos).where(eq(eventos.id, eventoId)).get()
    if (!evento) return c.json({ error: 'Evento não encontrado' }, 404)

    // Soft inactive: Upsert
    const existing = await db.select().from(eventoRefeicoes)
      .where(and(
        eq(eventoRefeicoes.eventoId, eventoId),
        eq(eventoRefeicoes.tipo, parsed.tipo)
      )).get()

    if (existing) {
      if (existing.ativo) {
        return c.json(existing, 200) // Idempotent
      } else {
        const updated = await db.update(eventoRefeicoes)
          .set({ ativo: true, updatedAt: new Date().toISOString() })
          .where(eq(eventoRefeicoes.id, existing.id))
          .returning().get()
        return c.json(updated, 200)
      }
    } else {
      const id = crypto.randomUUID()
      const result = await db.insert(eventoRefeicoes)
        .values({ id, eventoId, tipo: parsed.tipo })
        .returning().get()
      return c.json(result, 201)
    }
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})

eventoRefeicoesRouter.patch('/:eventoId/refeicoes/:refeicaoId', async (c) => {
  const db = c.get('db')
  const eventoId = c.req.param('eventoId')
  const refeicaoId = c.req.param('refeicaoId')
  
  try {
    const body = await c.req.json()
    const ativo = body.ativo

    if (typeof ativo !== 'boolean') {
        return c.json({ error: 'Campo ativo é obrigatório e deve ser booleano' }, 400)
    }
    
    const evento = await db.select().from(eventos).where(eq(eventos.id, eventoId)).get()
    if (!evento) return c.json({ error: 'Evento não encontrado' }, 404)

    const existing = await db.select().from(eventoRefeicoes)
      .where(and(
        eq(eventoRefeicoes.id, refeicaoId),
        eq(eventoRefeicoes.eventoId, eventoId)
      )).get()

    if (!existing) return c.json({ error: 'Refeição não encontrada' }, 404)

    const updated = await db.update(eventoRefeicoes)
      .set({ ativo, updatedAt: new Date().toISOString() })
      .where(eq(eventoRefeicoes.id, refeicaoId))
      .returning().get()
      
    return c.json(updated)
  } catch (err: any) {
    return c.json({ error: err.issues || err.message }, 400)
  }
})
