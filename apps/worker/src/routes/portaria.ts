import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { eventos, convocacoes, convocacaoDestinatarios, membros, casas, rsvp, checkins } from '../db/schema'
import { authMiddleware, Variables } from '../middleware/auth'
import { eOperadorPortariaAutorizado } from '../security/permissoes'
import { PortariaEventosQuerySchema, getSaoPauloDateString } from '@piedade/shared'

export const portariaRouter = new Hono<{ Variables: Variables }>()

portariaRouter.use('*', authMiddleware)

// GET /api/v1/portaria/eventos
portariaRouter.get('/eventos', async (c) => {
  const db = c.get('db')
  const membroSessaoId = c.get('membroId')

  if (!db || !membroSessaoId) {
    return c.json({ error: 'Sessão ou banco indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  try {
    const rawData = c.req.query('data')
    const parsedQuery = PortariaEventosQuerySchema.parse({ data: rawData })
    
    let targetDateStr = parsedQuery.data
    if (!targetDateStr) {
      // Formato YYYY-MM-DD usando o fuso horário de São Paulo
      const formatter = new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      targetDateStr = formatter.format(new Date())
    }

    const candidateEvents = await db
      .select()
      .from(eventos)
      .where(eq(eventos.ativo, true))
      .all()

    const authorizedEvents = []

    for (const evento of candidateEvents) {
      // Filtrar pela data paulista com helper
      try {
        if (getSaoPauloDateString(evento.inicioEm) !== targetDateStr) {
          continue
        }
      } catch {
        continue
      }

      const isAuthorized = await eOperadorPortariaAutorizado(db, membroSessaoId, evento)
      if (isAuthorized) {
        authorizedEvents.push({
          id: evento.id,
          titulo: evento.titulo,
          inicioEm: evento.inicioEm,
          fimEm: evento.fimEm,
          modalidade: evento.modalidade
        })
      }
    }

    authorizedEvents.sort((a, b) => a.inicioEm.localeCompare(b.inicioEm))

    return c.json({ data: authorizedEvents }, 200)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'issues' in err) {
      return c.json({ error: 'Payload inválido', details: (err as { issues: unknown }).issues }, 400)
    }
    const message = err instanceof Error ? err.message : 'Erro ao carregar eventos da portaria'
    return c.json({ error: message }, 400)
  }
})

// GET /api/v1/portaria/eventos/:eventoId/participantes
portariaRouter.get('/eventos/:eventoId/participantes', async (c) => {
  const db = c.get('db')
  const membroSessaoId = c.get('membroId')
  const eventoId = c.req.param('eventoId')

  if (!db || !membroSessaoId) {
    return c.json({ error: 'Sessão ou banco indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  // 1. Busca o evento
  const evento = await db
    .select()
    .from(eventos)
    .where(and(eq(eventos.id, eventoId), eq(eventos.ativo, true)))
    .get()

  if (!evento) {
    return c.json({ error: 'Evento não encontrado ou inativo', code: 'NOT_FOUND' }, 404)
  }

  // 2. Valida se o operador é OPERADOR_PORTARIA autorizado no escopo do evento
  const autorizado = await eOperadorPortariaAutorizado(db, membroSessaoId, evento)
  if (!autorizado) {
    return c.json({ error: 'Operador não autorizado para operar portaria neste evento', code: 'FORBIDDEN' }, 403)
  }

  // 3. Consulta todos os destinatários de convocações PUBLICADAS para o evento
  const registros = await db
    .select({
      destinatario: convocacaoDestinatarios,
      convocacao: convocacoes,
      membro: membros,
      casa: casas,
      rsvp: rsvp,
      checkin: checkins
    })
    .from(convocacaoDestinatarios)
    .innerJoin(convocacoes, eq(convocacaoDestinatarios.convocacaoId, convocacoes.id))
    .innerJoin(membros, eq(convocacaoDestinatarios.membroId, membros.id))
    .leftJoin(casas, eq(membros.casaId, casas.id))
    .leftJoin(rsvp, eq(convocacaoDestinatarios.id, rsvp.convocacaoDestinatarioId))
    .leftJoin(
      checkins,
      and(
        eq(checkins.eventoId, eventoId),
        eq(checkins.membroId, membros.id),
        eq(checkins.status, 'ATIVO')
      )
    )
    .where(
      and(
        eq(convocacoes.eventoId, eventoId),
        eq(convocacoes.status, 'PUBLICADA'),
        eq(convocacoes.ativo, true)
      )
    )
    .all()

  // 4. Desduplicação por pessoa (membro.id) para que a listagem operacional apresente cada participante uma única vez
  const mapaMembros = new Map<string, any>()

  for (const reg of registros) {
    if (!mapaMembros.has(reg.membro.id)) {
      mapaMembros.set(reg.membro.id, {
        convocacaoDestinatarioId: reg.destinatario.id,
        membro: {
          id: reg.membro.id,
          nome: reg.membro.nome,
          casaNome: reg.casa ? reg.casa.nome : null
        },
        rsvpResposta: reg.rsvp ? reg.rsvp.resposta : null,
        checkin: reg.checkin ? {
          id: reg.checkin.id,
          dataHoraCheckin: reg.checkin.dataHoraCheckin,
          forma: reg.checkin.forma,
          operadorMembroId: reg.checkin.operadorMembroId
        } : null
      })
    }
  }

  const participantes = Array.from(mapaMembros.values())

  return c.json({
    evento: {
      id: evento.id,
      titulo: evento.titulo,
      inicioEm: evento.inicioEm,
      fimEm: evento.fimEm
    },
    totalParticipantes: participantes.length,
    participantes
  }, 200)
})
