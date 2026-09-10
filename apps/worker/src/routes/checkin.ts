import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { checkins, convocacaoDestinatarios, convocacoes, eventos, membros } from '../db/schema'
import { CheckinQrSchema, CheckinManualSchema } from '@piedade/shared'
import { authMiddleware, Variables } from '../middleware/auth'
import { eOperadorPortariaAutorizado } from '../security/permissoes'

export const checkinRouter = new Hono<{ Variables: Variables }>()

checkinRouter.use('*', authMiddleware)

// POST /api/v1/checkin/qr
checkinRouter.post('/qr', async (c) => {
  const db = c.get('db')
  const operadorMembroId = c.get('membroId')

  if (!db || !operadorMembroId) {
    return c.json({ error: 'Sessão ou banco indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  try {
    const body = await c.req.json()
    const parsed = CheckinQrSchema.parse(body)
    const destinatarioId = parsed.qrToken.trim()

    // 1. Busca o destinatario e a convocação vinculada
    const dest = await db
      .select({
        destinatario: convocacaoDestinatarios,
        convocacao: convocacoes,
        evento: eventos
      })
      .from(convocacaoDestinatarios)
      .innerJoin(convocacoes, eq(convocacaoDestinatarios.convocacaoId, convocacoes.id))
      .innerJoin(eventos, eq(convocacoes.eventoId, eventos.id))
      .where(eq(convocacaoDestinatarios.id, destinatarioId))
      .get()

    if (!dest) {
      return c.json({ error: 'Destinatário de QR Code inválido ou não encontrado', code: 'NOT_FOUND' }, 404)
    }

    if (dest.convocacao.status !== 'PUBLICADA' || !dest.convocacao.ativo || !dest.evento.ativo) {
      return c.json({ error: 'Convocação não está publicada', code: 'BAD_REQUEST' }, 400)
    }

    // 2. Valida autorização do operador de portaria no escopo do evento
    const autorizado = await eOperadorPortariaAutorizado(db, operadorMembroId, dest.evento)
    if (!autorizado) {
      return c.json({ error: 'Operador não autorizado para operar portaria neste evento', code: 'FORBIDDEN' }, 403)
    }

    // 3. Deriva membroId e eventoId
    const membroId = dest.destinatario.membroId
    const eventoId = dest.evento.id

    // 4. Verifica unicidade por (eventoId, membroId)
    const checkinExistente = await db
      .select()
      .from(checkins)
      .where(and(eq(checkins.eventoId, eventoId), eq(checkins.membroId, membroId)))
      .get()

    if (checkinExistente) {
      return c.json({
        message: 'Presença já registrada previamente',
        jaRegistrado: true,
        checkin: checkinExistente
      }, 409)
    }

    // 5. Registra o check-in
    const nowIso = new Date().toISOString()
    const newCheckin = {
      id: crypto.randomUUID(),
      convocacaoDestinatarioId: dest.destinatario.id,
      eventoId,
      membroId,
      forma: 'QR',
      operadorMembroId,
      dataHoraCheckin: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    }

    await db.insert(checkins).values(newCheckin)

    return c.json(newCheckin, 201)
  } catch (err: any) {
    if (err.issues) {
      return c.json({ error: 'Payload inválido', details: err.issues }, 400)
    }
    return c.json({ error: err.message || 'Erro ao registrar check-in QR' }, 400)
  }
})

// POST /api/v1/checkin/manual
checkinRouter.post('/manual', async (c) => {
  const db = c.get('db')
  const operadorMembroId = c.get('membroId')

  if (!db || !operadorMembroId) {
    return c.json({ error: 'Sessão ou banco indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  try {
    const body = await c.req.json()
    const parsed = CheckinManualSchema.parse(body)
    const destinatarioId = parsed.convocacaoDestinatarioId

    const dest = await db
      .select({
        destinatario: convocacaoDestinatarios,
        convocacao: convocacoes,
        evento: eventos
      })
      .from(convocacaoDestinatarios)
      .innerJoin(convocacoes, eq(convocacaoDestinatarios.convocacaoId, convocacoes.id))
      .innerJoin(eventos, eq(convocacoes.eventoId, eventos.id))
      .where(eq(convocacaoDestinatarios.id, destinatarioId))
      .get()

    if (!dest) {
      return c.json({ error: 'Destinatário da convocação não encontrado', code: 'NOT_FOUND' }, 404)
    }

    if (dest.convocacao.status !== 'PUBLICADA' || !dest.convocacao.ativo || !dest.evento.ativo) {
      return c.json({ error: 'Convocação não está publicada', code: 'BAD_REQUEST' }, 400)
    }

    const autorizado = await eOperadorPortariaAutorizado(db, operadorMembroId, dest.evento)
    if (!autorizado) {
      return c.json({ error: 'Operador não autorizado para operar portaria neste evento', code: 'FORBIDDEN' }, 403)
    }

    const membroId = dest.destinatario.membroId
    const eventoId = dest.evento.id

    const checkinExistente = await db
      .select()
      .from(checkins)
      .where(and(eq(checkins.eventoId, eventoId), eq(checkins.membroId, membroId)))
      .get()

    if (checkinExistente) {
      return c.json({
        message: 'Presença já registrada previamente',
        jaRegistrado: true,
        checkin: checkinExistente
      }, 409)
    }

    const nowIso = new Date().toISOString()
    const newCheckin = {
      id: crypto.randomUUID(),
      convocacaoDestinatarioId: dest.destinatario.id,
      eventoId,
      membroId,
      forma: 'MANUAL',
      operadorMembroId,
      dataHoraCheckin: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    }

    await db.insert(checkins).values(newCheckin)

    return c.json(newCheckin, 201)
  } catch (err: any) {
    if (err.issues) {
      return c.json({ error: 'Payload inválido', details: err.issues }, 400)
    }
    return c.json({ error: err.message || 'Erro ao registrar check-in manual' }, 400)
  }
})

// GET /api/v1/checkin/destinatarios/:destinatarioId/presenca
checkinRouter.get('/destinatarios/:destinatarioId/presenca', async (c) => {
  const db = c.get('db')
  const membroSessaoId = c.get('membroId')
  const destinatarioId = c.req.param('destinatarioId')

  if (!db || !membroSessaoId) {
    return c.json({ error: 'Sessão ou banco indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  const dest = await db
    .select({
      destinatario: convocacaoDestinatarios,
      convocacao: convocacoes,
      evento: eventos
    })
    .from(convocacaoDestinatarios)
    .innerJoin(convocacoes, eq(convocacaoDestinatarios.convocacaoId, convocacoes.id))
    .innerJoin(eventos, eq(convocacoes.eventoId, eventos.id))
    .where(eq(convocacaoDestinatarios.id, destinatarioId))
    .get()

  if (!dest) {
    return c.json({ error: 'Destinatário da convocação não encontrado' }, 404)
  }

  // Permissão: Próprio membro OU operador de portaria autorizado no escopo do evento
  const eProprioMembro = dest.destinatario.membroId === membroSessaoId
  const eOperador = await eOperadorPortariaAutorizado(db, membroSessaoId, dest.evento)

  if (!eProprioMembro && !eOperador) {
    return c.json({ error: 'Acesso negado para consultar presença de outro membro', code: 'FORBIDDEN' }, 403)
  }

  const checkin = await db
    .select()
    .from(checkins)
    .where(
      and(
        eq(checkins.eventoId, dest.evento.id),
        eq(checkins.membroId, dest.destinatario.membroId)
      )
    )
    .get()

  return c.json({
    destinatarioId: dest.destinatario.id,
    eventoId: dest.evento.id,
    membroId: dest.destinatario.membroId,
    possuiPresenca: !!checkin,
    checkin: checkin || null
  }, 200)
})
