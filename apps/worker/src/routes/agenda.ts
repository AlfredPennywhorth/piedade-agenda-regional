import { Hono } from 'hono'
import { eq, and, asc } from 'drizzle-orm'
import { eventos, convocacoes, convocacaoDestinatarios, locais } from '../db/schema'
import { authMiddleware, Variables } from '../middleware/auth'

export const agendaRouter = new Hono<{ Variables: Variables }>()

agendaRouter.use('*', authMiddleware)

agendaRouter.get('/', async (c) => {
  const db = c.get('db')
  const membroId = c.get('membroId')

  if (!db || !membroId) {
    return c.json({ error: 'Sessão ou banco indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  try {
    const records = await db.select({
      evento: eventos,
      convocacao: convocacoes,
      local: locais
    })
    .from(eventos)
    .innerJoin(convocacoes, eq(eventos.id, convocacoes.eventoId))
    .innerJoin(convocacaoDestinatarios, eq(convocacoes.id, convocacaoDestinatarios.convocacaoId))
    .leftJoin(locais, eq(eventos.localId, locais.id))
    .where(
      and(
        eq(convocacaoDestinatarios.membroId, membroId),
        eq(convocacoes.status, 'PUBLICADA'),
        eq(eventos.ativo, true),
        eq(convocacoes.ativo, true)
      )
    )
    .orderBy(asc(eventos.inicioEm))
    .all()

    return c.json(records, 200)
  } catch (error: any) {
    return c.json({ error: error.message || 'Falha ao consultar agenda' }, 500)
  }
})
