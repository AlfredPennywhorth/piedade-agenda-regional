import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { rsvp, convocacoes, convocacaoDestinatarios, eventos } from '../db/schema'
import { authMiddleware, Variables } from '../middleware/auth'
import { RsvpUpsert } from '@piedade/shared'
import { executeAtomic } from '../db/batch'
import { criarAuditQuery, extrairEscopoDoEvento } from '../services/auditoria'

export const rsvpRouter = new Hono<{ Variables: Variables }>()

rsvpRouter.use('*', authMiddleware)

rsvpRouter.get('/:destinatarioId', async (c) => {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const destinatarioId = c.req.param('destinatarioId')

  if (!db || !membroId) {
    return c.json({ error: 'Sessão ou banco indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  try {
    // Busca destinatário garantindo que pertence ao membro autenticado
    const destinatario = await db.select().from(convocacaoDestinatarios)
      .where(and(
        eq(convocacaoDestinatarios.id, destinatarioId),
        eq(convocacaoDestinatarios.membroId, membroId)
      ))
      .get()

    if (!destinatario) {
      return c.json({ error: 'Destinatário não encontrado' }, 404)
    }

    const rsvpRecord = await db.select().from(rsvp)
      .where(eq(rsvp.convocacaoDestinatarioId, destinatarioId))
      .get()

    if (!rsvpRecord) {
      return c.json({ error: 'RSVP não encontrado' }, 404)
    }

    return c.json(rsvpRecord, 200)
  } catch (error: any) {
    return c.json({ error: error.message || 'Falha ao buscar RSVP' }, 500)
  }
})

rsvpRouter.put('/:destinatarioId', async (c) => {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const destinatarioId = c.req.param('destinatarioId')

  if (!db || !membroId) {
    return c.json({ error: 'Sessão ou banco indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  try {
    const body = await c.req.json()
    const parsed = RsvpUpsert.parse(body)

    // Busca destinatário garantindo que pertence ao membro + infos da convocação e evento
    const record = await db.select({
      destinatarioId: convocacaoDestinatarios.id,
      convocacaoStatus: convocacoes.status,
      eventoId: eventos.id,
      eventoInicio: eventos.inicioEm,
      possuiManha: eventos.possuiManha,
      possuiTarde: eventos.possuiTarde,
      possuiNoite: eventos.possuiNoite,
      regionalId: eventos.regionalId,
      administracaoId: eventos.administracaoId,
      setorId: eventos.setorId,
      casaId: eventos.casaId,
      grupoTrabalhoId: eventos.grupoTrabalhoId,
    })
    .from(convocacaoDestinatarios)
    .innerJoin(convocacoes, eq(convocacaoDestinatarios.convocacaoId, convocacoes.id))
    .innerJoin(eventos, eq(convocacoes.eventoId, eventos.id))
    .where(and(
      eq(convocacaoDestinatarios.id, destinatarioId),
      eq(convocacaoDestinatarios.membroId, membroId)
    ))
    .get()

    if (!record) {
      return c.json({ error: 'Destinatário não encontrado' }, 404) // Proteção de recurso
    }

    if (record.convocacaoStatus !== 'PUBLICADA') {
      return c.json({ error: 'Convocação não está publicada' }, 400)
    }

    const nowIso = new Date().toISOString()

    if (record.eventoInicio <= nowIso) {
      return c.json({ error: 'O evento já iniciou. Não é possível alterar a resposta.' }, 400)
    }

    // Validações S09 (Worker-side)
    let finalPeriodos: string[] | null = null

    if (parsed.resposta === 'PARTICIPAREI') {
      const periodosConfigurados: string[] = []
      if (record.possuiManha) periodosConfigurados.push('MANHA')
      if (record.possuiTarde) periodosConfigurados.push('TARDE')
      if (record.possuiNoite) periodosConfigurados.push('NOITE')

      if (periodosConfigurados.length === 0) {
        finalPeriodos = null
      } else if (periodosConfigurados.length === 1) {
        finalPeriodos = periodosConfigurados
      } else {
        if (!parsed.periodosParticipacao || parsed.periodosParticipacao.length === 0) {
          return c.json({ error: 'É necessário selecionar pelo menos um período de participação.' }, 400)
        }
        for (const p of parsed.periodosParticipacao) {
          if (!periodosConfigurados.includes(p)) {
             return c.json({ error: `O período ${p} não está configurado para este evento.` }, 400)
          }
        }
        finalPeriodos = parsed.periodosParticipacao
      }
    }

    // Precisamos do ID do RSVP. Vamos buscar se existe.
    const existingRsvp = await db.select().from(rsvp)
      .where(eq(rsvp.convocacaoDestinatarioId, destinatarioId)).get()
    
    const rsvpId = existingRsvp ? existingRsvp.id : crypto.randomUUID()

    const { escopoTipo, escopoId } = extrairEscopoDoEvento(record)
    
    // Execute de forma atômica (D1 Batch ou Transaction local)
    await executeAtomic(db, (tx) => {
      const txQueries = []
      
      const txRsvp = tx.insert(rsvp)
        .values({
          id: rsvpId,
          convocacaoDestinatarioId: destinatarioId,
          resposta: parsed.resposta,
          justificativa: parsed.justificativa,
          periodosParticipacao: finalPeriodos,
          respondidoEm: existingRsvp ? existingRsvp.respondidoEm : nowIso,
          atualizadoEm: nowIso,
          createdAt: existingRsvp ? existingRsvp.createdAt : nowIso,
          updatedAt: nowIso
        })
        .onConflictDoUpdate({
          target: rsvp.convocacaoDestinatarioId,
          set: {
            resposta: parsed.resposta,
            justificativa: parsed.justificativa,
            periodosParticipacao: finalPeriodos,
            atualizadoEm: nowIso,
            updatedAt: nowIso
          }
        })
      txQueries.push(txRsvp)

      const auditQuery = criarAuditQuery(tx, {
        acao: 'RSVP_REGISTRADO',
        atorMembroId: membroId,
        recursoTipo: 'RSVP',
        recursoId: rsvpId,
        escopoTipo,
        escopoId,
        contexto: {
          convocacaoDestinatarioId: destinatarioId,
          resposta: parsed.resposta,
          periodosParticipacao: finalPeriodos || []
        },
      })
      txQueries.push(auditQuery)

      return txQueries
    })

    const updated = await db.select().from(rsvp)
      .where(eq(rsvp.convocacaoDestinatarioId, destinatarioId))
      .get()

    // O status HTTP poderia ser 200 (se atualizou) ou 201 (se criou),
    // vamos padronizar 200 para upserts simplificados para facilitar teste,
    // a menos que haja necessidade estrita de diferenciar.
    return c.json(updated, 200)

  } catch (err: any) {
    if (err.issues) {
      return c.json({ error: err.issues }, 400)
    }
    return c.json({ error: err.message || 'Erro interno' }, 400)
  }
})
