import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { rsvp, convocacoes, convocacaoDestinatarios, eventos, eventoRefeicoes, rsvpRefeicoes } from '../db/schema'
import { authMiddleware, Variables } from '../middleware/auth'
import { RsvpUpsert } from '@piedade/shared'
import { executeAtomic } from '../db/batch'

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
      possuiTarde: eventos.possuiTarde
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
    let finalPeriodo = null
    const refeicoesDesejadas: string[] = []

    if (parsed.resposta === 'PARTICIPAREI') {
      // 1. Normalizar período
      if (record.possuiManha && !record.possuiTarde) {
        finalPeriodo = 'MANHA'
      } else if (!record.possuiManha && record.possuiTarde) {
        finalPeriodo = 'TARDE'
      } else if (record.possuiManha && record.possuiTarde) {
        if (!parsed.periodoParticipacao) {
           return c.json({ error: 'Período de participação é obrigatório para este evento.' }, 400)
        }
        finalPeriodo = parsed.periodoParticipacao
      }

      // 2. Validar Refeições
      if (parsed.refeicoesSelecionadas && parsed.refeicoesSelecionadas.length > 0) {
        const ativasDb = await db.select().from(eventoRefeicoes)
          .where(and(
            eq(eventoRefeicoes.eventoId, record.eventoId),
            eq(eventoRefeicoes.ativo, true)
          )).all()
        
        const tiposAtivos = ativasDb.map(r => r.tipo)
        for (const tipo of parsed.refeicoesSelecionadas) {
          if (!tiposAtivos.includes(tipo)) {
            return c.json({ error: `Refeição ${tipo} não está disponível ou está inativa neste evento.` }, 400)
          }
          const idDaRefeicao = ativasDb.find(r => r.tipo === tipo)!.id
          refeicoesDesejadas.push(idDaRefeicao)
        }
      }
    }

    // Precisamos do ID do RSVP. Vamos buscar se existe.
    let existingRsvp = await db.select().from(rsvp)
      .where(eq(rsvp.convocacaoDestinatarioId, destinatarioId)).get()
    
    const rsvpId = existingRsvp ? existingRsvp.id : crypto.randomUUID()
    
    let escolhasAnteriores: any[] = []
    if (existingRsvp) {
      escolhasAnteriores = await db.select().from(rsvpRefeicoes)
        .where(eq(rsvpRefeicoes.rsvpId, existingRsvp.id)).all()
    }

    // Execute de forma atômica (D1 Batch ou Transaction local)
    await executeAtomic(db, (tx) => {
      // Como já construímos as queries com `db`, elas não usarão a transação `tx` no SQLite in-memory,
      // pois drizzle-orm no SQLite (better-sqlite3) exige que a query seja gerada pelo tx.
      // Vamos reconstruir as queries usando o construtor correto (tx ou db):
      
      const txQueries = []
      
      const txRsvp = tx.insert(rsvp)
        .values({
          id: rsvpId,
          convocacaoDestinatarioId: destinatarioId,
          resposta: parsed.resposta,
          justificativa: parsed.justificativa,
          periodoParticipacao: finalPeriodo,
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
            periodoParticipacao: finalPeriodo,
            atualizadoEm: nowIso,
            updatedAt: nowIso
          }
        })
      txQueries.push(txRsvp)

      if (existingRsvp) {
        for (const ref of escolhasAnteriores) {
          const deveEstarAtiva = refeicoesDesejadas.includes(ref.eventoRefeicaoId)
          if (ref.ativo !== deveEstarAtiva) {
            txQueries.push(
              tx.update(rsvpRefeicoes)
                .set({ ativo: deveEstarAtiva, updatedAt: nowIso })
                .where(eq(rsvpRefeicoes.id, ref.id))
            )
          }
          const idx = refeicoesDesejadas.indexOf(ref.eventoRefeicaoId)
          if (idx > -1) refeicoesDesejadas.splice(idx, 1)
        }
      }

      for (const refId of refeicoesDesejadas) {
        txQueries.push(
          tx.insert(rsvpRefeicoes).values({
            id: crypto.randomUUID(),
            rsvpId,
            eventoRefeicaoId: refId,
            ativo: true,
            createdAt: nowIso,
            updatedAt: nowIso
          })
        )
      }

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
