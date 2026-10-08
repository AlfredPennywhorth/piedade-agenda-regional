import { Hono } from 'hono'
import { eq, and, asc, inArray } from 'drizzle-orm'
import {
  eventos,
  convocacoes,
  convocacaoDestinatarios,
  locais,
  espacosLocal,
  rsvp,
  eventoRefeicoes,
  checkins,
  agendaPrioridadesConflito,
  convocacaoDestinatarioEvidencias,
  eventosParticipantesExternos,
} from '../db/schema'
import { authMiddleware, Variables } from '../middleware/auth'
import { executeAtomic } from '../db/batch'

export const agendaRouter = new Hono<{ Variables: Variables }>()

agendaRouter.use('*', authMiddleware)

const JANELA_TRANSICAO_MINUTOS = 60
const JANELA_TRANSICAO_MS = JANELA_TRANSICAO_MINUTOS * 60 * 1000

const MAX_IDS_POR_CONSULTA = 80

function particionar<T>(itens: T[], tamanho = MAX_IDS_POR_CONSULTA): T[][] {
  const partes: T[][] = []
  for (let i = 0; i < itens.length; i += tamanho) {
    partes.push(itens.slice(i, i + tamanho))
  }
  return partes
}

function hierarquiaVinculo(escopoTipo: string | null) {
  if (escopoTipo === 'REGIONAL' || escopoTipo === 'GRUPO_TRABALHO') return 4
  if (escopoTipo === 'ADMINISTRACAO') return 3
  if (escopoTipo === 'SETOR') return 2
  if (escopoTipo === 'CASA') return 1
  return 0
}

function escolherMaiorVinculo<T extends {
  funcaoNome: string | null
  escopoTipo: string | null
  [key: string]: unknown
}>(vinculos: T[]): T | null {
  return [...vinculos].sort((a, b) => {
    const nivel = hierarquiaVinculo(b.escopoTipo) - hierarquiaVinculo(a.escopoTipo)
    if (nivel !== 0) return nivel
    return (a.funcaoNome ?? '').localeCompare(b.funcaoNome ?? '', 'pt-BR')
  })[0] ?? null
}

type AgendaPrioridadePersistida = {
  id: string
  membroId: string
  eventoId: string
  conflitoParChave: string
  conflitoChave: string
  priorizadoEm: string
  createdAt: string
  updatedAt: string
}

type RegistroAgenda = {
  evento: {
    id: string
    titulo: string
    inicioEm: string
    fimEm: string
    agendaRevisao: string
  }
  convocacao: any
  local: any
  espaco: any
  destinatario: any
  rsvp: any
  checkin: any
}

function tipoConflito(a: RegistroAgenda, b: RegistroAgenda): 'SOBREPOSICAO' | 'PROXIMIDADE' | null {
  const inicioA = new Date(a.evento.inicioEm).getTime()
  const fimA = new Date(a.evento.fimEm).getTime()
  const inicioB = new Date(b.evento.inicioEm).getTime()
  const fimB = new Date(b.evento.fimEm).getTime()

  if (inicioA < fimB && inicioB < fimA) return 'SOBREPOSICAO'

  const distancia = inicioB >= fimA
    ? inicioB - fimA
    : inicioA >= fimB
      ? inicioA - fimB
      : 0

  return distancia <= JANELA_TRANSICAO_MS ? 'PROXIMIDADE' : null
}

function montarMapaConflitos(records: RegistroAgenda[]) {
  const ativos = records.filter(record => record.rsvp?.resposta !== 'NAO_PARTICIPAREI')
  const mapa = new Map<string, Array<{ eventoId: string; tipo: 'SOBREPOSICAO' | 'PROXIMIDADE' }>>()

  for (let i = 0; i < ativos.length; i++) {
    const fimAtual = new Date(ativos[i].evento.fimEm).getTime()

    for (let j = i + 1; j < ativos.length; j++) {
      const inicioSeguinte = new Date(ativos[j].evento.inicioEm).getTime()
      if (inicioSeguinte > fimAtual + JANELA_TRANSICAO_MS) break

      if (ativos[i].evento.id === ativos[j].evento.id) continue
      const tipo = tipoConflito(ativos[i], ativos[j])
      if (!tipo) continue

      const aId = ativos[i].evento.id
      const bId = ativos[j].evento.id

      let conflitosA = mapa.get(aId)
      if (!conflitosA) {
        conflitosA = []
        mapa.set(aId, conflitosA)
      }
      conflitosA.push({ eventoId: bId, tipo })

      let conflitosB = mapa.get(bId)
      if (!conflitosB) {
        conflitosB = []
        mapa.set(bId, conflitosB)
      }
      conflitosB.push({ eventoId: aId, tipo })
    }
  }

  return mapa
}

function assinaturaConflito(record: RegistroAgenda) {
  return [
    record.evento.id,
    String(new Date(record.evento.inicioEm).getTime()),
    String(new Date(record.evento.fimEm).getTime()),
    record.evento.agendaRevisao,
  ].join('@')
}

function chaveParEstavel(eventoAId: string, eventoBId: string) {
  return [eventoAId, eventoBId].sort().join('|')
}

function chaveConflitoPar(
  a: RegistroAgenda,
  b: RegistroAgenda,
  tipo: 'SOBREPOSICAO' | 'PROXIMIDADE'
) {
  return [chaveParEstavel(a.evento.id, b.evento.id), ...[a, b]
    .sort((x, y) => x.evento.id.localeCompare(y.evento.id))
    .map(assinaturaConflito), tipo].join('|')
}

async function buscarRegistrosAgenda(db: any, membroId: string): Promise<RegistroAgenda[]> {
  const convocados: RegistroAgenda[] = await db.select({
    evento: eventos,
    convocacao: convocacoes,
    local: locais,
    espaco: espacosLocal,
    destinatario: convocacaoDestinatarios,
    rsvp,
    checkin: checkins,
  })
    .from(eventos)
    .innerJoin(convocacoes, eq(eventos.id, convocacoes.eventoId))
    .innerJoin(convocacaoDestinatarios, eq(convocacoes.id, convocacaoDestinatarios.convocacaoId))
    .leftJoin(locais, eq(eventos.localId, locais.id))
    .leftJoin(espacosLocal, eq(eventos.espacoId, espacosLocal.id))
    .leftJoin(rsvp, eq(convocacaoDestinatarios.id, rsvp.convocacaoDestinatarioId))
    .leftJoin(
      checkins,
      and(
        eq(checkins.eventoId, eventos.id),
        eq(checkins.membroId, membroId),
        eq(checkins.status, 'ATIVO')
      )
    )
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
  const pessoais = await db.select({ evento: eventos, local: locais, espaco: espacosLocal })
    .from(eventos)
    .leftJoin(locais, eq(eventos.localId, locais.id))
    .leftJoin(espacosLocal, eq(eventos.espacoId, espacosLocal.id))
    .where(and(eq(eventos.pessoal, true), eq(eventos.criadorMembroId, membroId), eq(eventos.ativo, true)))
    .all()
  const participacoesExternas = await db.select({
    evento: eventos, local: locais, espaco: espacosLocal,
    participacao: eventosParticipantesExternos,
  })
    .from(eventosParticipantesExternos)
    .innerJoin(eventos, eq(eventosParticipantesExternos.eventoId, eventos.id))
    .leftJoin(locais, eq(eventos.localId, locais.id))
    .leftJoin(espacosLocal, eq(eventos.espacoId, espacosLocal.id))
    .where(and(eq(eventosParticipantesExternos.membroId, membroId), eq(eventos.ativo, true), inArray(eventos.abrangencia, ['NACIONAL', 'INTERNACIONAL'])))
    .all()
  const registros = [...convocados, ...pessoais.map((record: any) => ({
    ...record, convocacao: null, destinatario: null, rsvp: null, checkin: null,
  })), ...participacoesExternas.map((record: any) => ({
    ...record, convocacao: null, destinatario: null,
    rsvp: null, checkin: null,
  }))]
  return Array.from(new Map(registros.map(record => [record.evento.id, record])).values())
    .sort((a, b) => new Date(a.evento.inicioEm).getTime() - new Date(b.evento.inicioEm).getTime())

}

agendaRouter.get('/', async (c) => {
  const db = c.get('db')
  const membroId = c.get('membroId')

  if (!db || !membroId) {
    return c.json({ error: 'Sessão ou banco indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  try {
    const records = await buscarRegistrosAgenda(db, membroId)
    const eventoIds = records.map(record => record.evento.id)
    const destinatarioIds = records.filter(record => record.destinatario).map(record => record.destinatario.id)
    const mapaConflitos = montarMapaConflitos(records)

    let refOferecidas: any[] = []
    let prioridades: Array<{ eventoId: string; conflitoParChave: string; conflitoChave: string }> = []
    let evidenciasVinculo: Array<{
      convocacaoDestinatarioId: string
      vinculoFuncionalId: string
      funcaoId: string
      funcaoNome: string | null
      escopoTipo: string | null
      escopoId: string | null
    }> = []

    if (eventoIds.length > 0) {
      const lotes = particionar(eventoIds)
      const lotesDestinatarios = particionar(destinatarioIds)
      const [refLotes, prioridadeLotes, evidenciaLotes] = await Promise.all([
        Promise.all(
          lotes.map(ids =>
            db.select()
              .from(eventoRefeicoes)
              .where(and(inArray(eventoRefeicoes.eventoId, ids), eq(eventoRefeicoes.ativo, true)))
              .all()
          )
        ),
        Promise.all(
          lotes.map(ids =>
            db.select({
              eventoId: agendaPrioridadesConflito.eventoId,
              conflitoParChave: agendaPrioridadesConflito.conflitoParChave,
              conflitoChave: agendaPrioridadesConflito.conflitoChave,
            })
              .from(agendaPrioridadesConflito)
              .where(
                and(
                  eq(agendaPrioridadesConflito.membroId, membroId),
                  inArray(agendaPrioridadesConflito.eventoId, ids)
                )
              )
              .all()
          )
        ),
        Promise.all(
          lotesDestinatarios.map(ids =>
            db.select({
              convocacaoDestinatarioId: convocacaoDestinatarioEvidencias.convocacaoDestinatarioId,
              vinculoFuncionalId: convocacaoDestinatarioEvidencias.vinculoFuncionalId,
              funcaoId: convocacaoDestinatarioEvidencias.funcaoId,
              funcaoNome: convocacaoDestinatarioEvidencias.funcaoNomeSnapshot,
              escopoTipo: convocacaoDestinatarioEvidencias.escopoTipoSnapshot,
              escopoId: convocacaoDestinatarioEvidencias.escopoIdSnapshot,
            })
              .from(convocacaoDestinatarioEvidencias)
              .where(inArray(convocacaoDestinatarioEvidencias.convocacaoDestinatarioId, ids))
              .all()
          )
        ),
      ])

      refOferecidas = refLotes.flat()
      prioridades = prioridadeLotes.flat()
      evidenciasVinculo = evidenciaLotes.flat()
    }

    const porId = new Map(records.map(record => [record.evento.id, record]))
    const prioridadesPorConflito = new Map(
      prioridades.map(prioridade => [prioridade.conflitoChave, prioridade])
    )

    const result = records.map((record: any) => {
      const eventoMeals = refOferecidas
        .filter(refeicao => refeicao.eventoId === record.evento.id)
        .map(refeicao => refeicao.tipo)

      const conflitosDiretos = mapaConflitos.get(record.evento.id) ?? []
      const escolhasDiretas = conflitosDiretos
        .map(conflito => {
          const outro = porId.get(conflito.eventoId)
          if (!outro) return null
          const conflitoChave = chaveConflitoPar(record, outro, conflito.tipo)
          const prioridade = prioridadesPorConflito.get(conflitoChave)
          return prioridade ? { conflito, prioridade } : null
        })
        .filter(Boolean) as Array<{
          conflito: { eventoId: string; tipo: 'SOBREPOSICAO' | 'PROXIMIDADE' }
          prioridade: { eventoId: string; conflitoChave: string }
        }>
      const priorizado = escolhasDiretas.some(
        escolha => escolha.prioridade.eventoId === record.evento.id
      )
      const conflitosResolvidos = escolhasDiretas.length === conflitosDiretos.length
      const atenuado = escolhasDiretas.some(
        escolha => escolha.prioridade.eventoId !== record.evento.id
      )
      const temSobreposicao = conflitosDiretos.some(conflito => conflito.tipo === 'SOBREPOSICAO')

      return {
        evento: {
          ...record.evento,
          refeicoesOferecidas: eventoMeals,
        },
        convocacao: record.convocacao,
        local: record.local,
        espaco: record.espaco,
        destinatarioId: record.destinatario?.id ?? null,
        vinculo: (() => {
          const vinculo = escolherMaiorVinculo(
            evidenciasVinculo.filter(
              evidencia => evidencia.convocacaoDestinatarioId === record.destinatario?.id
            )
          )
          return vinculo?.funcaoNome ? vinculo : null
        })(),
        participacaoExterna: record.participacao ? { status: record.participacao.status, membroId: record.participacao.membroId } : null,
        rsvp: record.rsvp ? {
          resposta: record.rsvp.resposta,
          justificativa: record.rsvp.justificativa,
          periodosParticipacao: record.rsvp.periodosParticipacao,
          reconfirmacaoPendente:
            new Date(record.rsvp.atualizadoEm).getTime() < new Date(record.evento.agendaRevisao).getTime(),
        } : null,
        checkin: record.checkin ? {
          id: record.checkin.id,
          dataHoraCheckin: record.checkin.dataHoraCheckin,
          forma: record.checkin.forma,
          operadorMembroId: record.checkin.operadorMembroId,
        } : null,
        conflito: conflitosDiretos.length === 0 ? null : {
          tipo: temSobreposicao ? 'SOBREPOSICAO' : 'PROXIMIDADE',
          janelaTransicaoMinutos: JANELA_TRANSICAO_MINUTOS,
          priorizado,
          conflitosResolvidos,
          atenuado,
          eventos: conflitosDiretos.map(conflito => {
            const outro = porId.get(conflito.eventoId)!
            return {
              eventoId: outro.evento.id,
              titulo: outro.evento.titulo,
              inicioEm: outro.evento.inicioEm,
              fimEm: outro.evento.fimEm,
              tipo: conflito.tipo,
            }
          }),
        },
      }
    })

    return c.json(result, 200)
  } catch (error: any) {
    return c.json({ error: error.message || 'Falha ao consultar agenda' }, 500)
  }
})

agendaRouter.post('/prioridade/:eventoId', async c => {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const eventoId = c.req.param('eventoId')

  if (!db || !membroId) {
    return c.json({ error: 'Sessão ou banco indisponível', code: 'INTERNAL_ERROR' }, 500)
  }

  const records = await buscarRegistrosAgenda(db, membroId)
  const selecionado = records.find(record => record.evento.id === eventoId)
  if (!selecionado) {
    return c.json({ error: 'Evento não encontrado na agenda do membro', code: 'NOT_FOUND' }, 404)
  }

  const mapaConflitos = montarMapaConflitos(records)
  if ((mapaConflitos.get(eventoId) ?? []).length === 0) {
    return c.json({ error: 'O evento não possui conflito de agenda ativo', code: 'SEM_CONFLITO' }, 409)
  }

  const conflitosDiretos = mapaConflitos.get(eventoId) ?? []
  const porId = new Map(records.map(record => [record.evento.id, record]))
  const conflitosPersistidos = conflitosDiretos.map(conflito => {
    const outro = porId.get(conflito.eventoId)
    if (!outro) throw new Error('Conflito aponta para evento ausente da agenda')
    return {
      conflitoParChave: chaveParEstavel(eventoId, conflito.eventoId),
      conflitoChave: chaveConflitoPar(selecionado, outro, conflito.tipo),
    }
  })
  const conflitoParChaves = conflitosPersistidos.map(item => item.conflitoParChave)
  const prioridadeLotes = await Promise.all(
    particionar(conflitoParChaves).map(chaves =>
      db.select()
        .from(agendaPrioridadesConflito)
        .where(
          and(
            eq(agendaPrioridadesConflito.membroId, membroId),
            inArray(agendaPrioridadesConflito.conflitoParChave, chaves)
          )
        )
        .all()
    )
  )
  const prioridadesAnteriores: AgendaPrioridadePersistida[] = prioridadeLotes.flat()
  const agora = new Date().toISOString()
  const tentativasPersistidas = conflitosPersistidos.map(({ conflitoParChave, conflitoChave }) => ({
    id: crypto.randomUUID(),
    conflitoParChave,
    conflitoChave,
  }))

  await executeAtomic(db, tx =>
    tentativasPersistidas.map(({ id, conflitoParChave, conflitoChave }) =>
      tx.insert(agendaPrioridadesConflito)
        .values({
          id,
          membroId,
          eventoId,
          conflitoParChave,
          conflitoChave,
          priorizadoEm: agora,
          createdAt: agora,
          updatedAt: agora,
        })
        .onConflictDoUpdate({
          target: [
            agendaPrioridadesConflito.membroId,
            agendaPrioridadesConflito.conflitoChave,
          ],
          set: {
            id,
            eventoId,
            conflitoParChave,
            priorizadoEm: agora,
            updatedAt: agora,
          },
        })
    )
  )

  // Revalida depois da escrita para fechar a corrida com alterações de RSVP.
  // Se o RSVP mudar antes da inserção, esta checagem remove a prioridade recém-gravada.
  // Se mudar depois, o próprio PUT de RSVP remove as prioridades do evento atomicamente.
  const recordsDepois = await buscarRegistrosAgenda(db, membroId)
  const selecionadoDepois = recordsDepois.find(record => record.evento.id === eventoId)
  const mapaDepois = montarMapaConflitos(recordsDepois)
  const porIdDepois = new Map(recordsDepois.map(record => [record.evento.id, record]))
  const conflitosDepois = selecionadoDepois
    ? (mapaDepois.get(eventoId) ?? []).map(conflito => {
        const outro = porIdDepois.get(conflito.eventoId)
        if (!outro) throw new Error('Conflito aponta para evento ausente da agenda')
        return {
          conflitoParChave: chaveParEstavel(eventoId, conflito.eventoId),
          conflitoChave: chaveConflitoPar(selecionadoDepois, outro, conflito.tipo),
        }
      })
    : []

  const chavesAntes = new Set(conflitosPersistidos.map(item => item.conflitoChave))
  const chavesDepois = new Set(conflitosDepois.map(item => item.conflitoChave))
  const conflitoMudou =
    chavesAntes.size !== chavesDepois.size ||
    [...chavesAntes].some(chave => !chavesDepois.has(chave))

  if (conflitoMudou) {
    const idsTentativa = tentativasPersistidas.map(item => item.id)
    const prioridadesRestauraveis = prioridadesAnteriores.filter(
      prioridade => chavesDepois.has(prioridade.conflitoChave)
    )

    await executeAtomic(db, tx => [
      ...particionar(idsTentativa).map(ids =>
        tx.delete(agendaPrioridadesConflito).where(
          and(
            eq(agendaPrioridadesConflito.membroId, membroId),
            inArray(agendaPrioridadesConflito.id, ids)
          )
        )
      ),
      ...prioridadesRestauraveis.map(prioridade =>
        tx.insert(agendaPrioridadesConflito)
          .values(prioridade)
          .onConflictDoNothing()
      ),
    ])

    return c.json({
      error: 'O conflito mudou enquanto a prioridade era salva. Atualize a agenda e tente novamente.',
      code: 'CONFLITO_ALTERADO',
    }, 409)
  }

  const chaveAtualPorPar = new Map(
    tentativasPersistidas.map(item => [item.conflitoParChave, item.conflitoChave])
  )
  const idsPrioridadesAntigas = prioridadesAnteriores
    .filter(prioridade =>
      chaveAtualPorPar.get(prioridade.conflitoParChave) !== prioridade.conflitoChave
    )
    .map(prioridade => prioridade.id)

  if (idsPrioridadesAntigas.length > 0) {
    await executeAtomic(db, tx =>
      particionar(idsPrioridadesAntigas).map(ids =>
        tx.delete(agendaPrioridadesConflito).where(
          and(
            eq(agendaPrioridadesConflito.membroId, membroId),
            inArray(agendaPrioridadesConflito.id, ids)
          )
        )
      )
    )
  }

  return c.json({
    message: 'Compromisso priorizado',
    eventoId,
    eventosConflitantes: conflitosDiretos.map(conflito => conflito.eventoId),
  }, 200)
})
