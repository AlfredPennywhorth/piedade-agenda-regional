import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { eventos, funcoes, vinculosFuncionais, convocacoes, convocacaoFuncoes } from '../db/schema'
import { EventoCreate, EventoUpdate } from '@piedade/shared'
import { executarOperacaoComAudit, executarOperacaoComAudits, extrairEscopoDoEvento, AuditLogData } from '../services/auditoria'
import { authMiddleware } from '../middleware/auth'
import { obterEscoposTerritoriaisVisiveis, podeGerenciarAgendaNoEscopo } from '../security/permissoes'
import { espacoAtivoPertenceAoLocal, espacoPertenceAoLocal } from '../services/espacos-local'

export const eventosRouter = new Hono<any>()

function mesmoInstante(a: string, b: string) {
  return new Date(a).getTime() === new Date(b).getTime()
}

function eventoVisivelNoEscopo(evento: any, escopos: any): boolean {
  if (escopos.tudo) return true
  if (evento.regionalId && escopos.regionaisIds.has(evento.regionalId)) return true
  if (evento.administracaoId && escopos.administracoesIds.has(evento.administracaoId)) return true
  if (evento.setorId && escopos.setoresIds.has(evento.setorId)) return true
  if (evento.casaId && escopos.casasIds.has(evento.casaId)) return true
  if (evento.grupoTrabalhoId && escopos.gruposTrabalhoIds.has(evento.grupoTrabalhoId)) return true
  return false
}

type EscoposRelatorios = {
  regionaisIds: Set<string>
  administracoesIds: Set<string>
  setoresIds: Set<string>
  casasIds: Set<string>
  gruposTrabalhoIds: Set<string>
}

async function carregarEscoposRelatorios(
  db: any,
  contexto: any,
  membroId: string
): Promise<EscoposRelatorios> {
  const resultado: EscoposRelatorios = {
    regionaisIds: new Set<string>(),
    administracoesIds: new Set<string>(),
    setoresIds: new Set<string>(),
    casasIds: new Set<string>(),
    gruposTrabalhoIds: new Set<string>(),
  }

  for (const acesso of contexto.acessosAtivos) {
    if (
      acesso.perfilCodigo !== 'GESTOR_RELATORIOS' ||
      acesso.escopoTipo === 'GLOBAL' ||
      !acesso.escopoId
    ) continue

    if (acesso.escopoTipo === 'REGIONAL') resultado.regionaisIds.add(acesso.escopoId)
    if (acesso.escopoTipo === 'ADMINISTRACAO') resultado.administracoesIds.add(acesso.escopoId)
    if (acesso.escopoTipo === 'SETOR') resultado.setoresIds.add(acesso.escopoId)
    if (acesso.escopoTipo === 'CASA') resultado.casasIds.add(acesso.escopoId)
    if (acesso.escopoTipo === 'GRUPO_TRABALHO') resultado.gruposTrabalhoIds.add(acesso.escopoId)
  }

  const vinculos = await db
    .select({ vinculo: vinculosFuncionais })
    .from(vinculosFuncionais)
    .innerJoin(funcoes, eq(vinculosFuncionais.funcaoId, funcoes.id))
    .where(
      and(
        eq(vinculosFuncionais.membroId, membroId),
        eq(vinculosFuncionais.ativo, true),
        eq(funcoes.ativo, true),
        eq(funcoes.codigo, 'GESTOR_RELATORIOS')
      )
    )
    .all()

  for (const { vinculo } of vinculos) {
    if (vinculo.regionalId) resultado.regionaisIds.add(vinculo.regionalId)
    if (vinculo.administracaoId) resultado.administracoesIds.add(vinculo.administracaoId)
    if (vinculo.setorId) resultado.setoresIds.add(vinculo.setorId)
    if (vinculo.casaId) resultado.casasIds.add(vinculo.casaId)
    if (vinculo.grupoTrabalhoId) resultado.gruposTrabalhoIds.add(vinculo.grupoTrabalhoId)
  }

  return resultado
}

function eventoAutorizadoParaRelatorios(
  evento: any,
  membroId: string,
  escoposRelatorios: EscoposRelatorios
): boolean {
  if (evento.organizadorMembroId === membroId) return true
  if (evento.regionalId && escoposRelatorios.regionaisIds.has(evento.regionalId)) return true
  if (evento.administracaoId && escoposRelatorios.administracoesIds.has(evento.administracaoId)) return true
  if (evento.setorId && escoposRelatorios.setoresIds.has(evento.setorId)) return true
  if (evento.casaId && escoposRelatorios.casasIds.has(evento.casaId)) return true
  if (
    evento.grupoTrabalhoId &&
    escoposRelatorios.gruposTrabalhoIds.has(evento.grupoTrabalhoId)
  ) return true
  return false
}

function eventoVisivelParaLeitura(
  evento: any,
  membroId: string,
  escopos: any,
  escoposRelatorios: EscoposRelatorios
): boolean {
  return (
    eventoVisivelNoEscopo(evento, escopos) ||
    eventoAutorizadoParaRelatorios(evento, membroId, escoposRelatorios)
  )
}

eventosRouter.use('*', authMiddleware)

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

  const contexto = c.get('contextoPermissoes')
  const membroId = c.get('membroId')
  const [escopos, escoposRelatorios] = await Promise.all([
    obterEscoposTerritoriaisVisiveis(db, contexto),
    carregarEscoposRelatorios(db, contexto, membroId),
  ])

  return c.json(
    data.filter((evento: any) =>
      eventoVisivelParaLeitura(evento, membroId, escopos, escoposRelatorios)
    )
  )
})

eventosRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(eventos).where(eq(eventos.id, id)).get()
  
  if (!data) return c.json({ error: 'Evento não encontrado' }, 404)

  const contexto = c.get('contextoPermissoes')
  const membroId = c.get('membroId')
  const [escopos, escoposRelatorios] = await Promise.all([
    obterEscoposTerritoriaisVisiveis(db, contexto),
    carregarEscoposRelatorios(db, contexto, membroId),
  ])

  if (!eventoVisivelParaLeitura(data, membroId, escopos, escoposRelatorios)) {
    return c.json({ error: 'Acesso não autorizado para este evento', code: 'FORBIDDEN' }, 403)
  }

  return c.json(data)
})

eventosRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = EventoCreate.parse(body)
    
    if (!(await espacoAtivoPertenceAoLocal(db, parsed.localId, parsed.espacoId))) {
      if (await espacoPertenceAoLocal(db, parsed.localId, parsed.espacoId)) {
        return c.json({ error: 'O espaço selecionado está inativo', code: 'ESPACO_INATIVO' }, 409)
      }
      return c.json({ error: 'O espaço selecionado não pertence ao Local informado', code: 'ESPACO_FORA_DO_LOCAL' }, 400)
    }

    const id = crypto.randomUUID()

    const { escopoTipo, escopoId } = extrairEscopoDoEvento(parsed)
    const atorMembroId = c.get('membroId') || null

    if (!atorMembroId || !escopoTipo || !escopoId) {
      return c.json({ error: 'Escopo da Agenda indisponível', code: 'FORBIDDEN' }, 403)
    }
    const autorizado = await podeGerenciarAgendaNoEscopo(
      db,
      atorMembroId,
      escopoTipo as 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO',
      escopoId
    )
    if (!autorizado) {
      return c.json({ error: 'Acesso não autorizado para gerir a Agenda neste escopo', code: 'FORBIDDEN' }, 403)
    }

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
      return c.json({ error: 'Local, Espaço ou Escopo vinculado não existe' }, 400)
    }
    if (err.message && err.message.includes('CHECK constraint failed')) {
      return c.json({ error: 'Violação de regra de negócio no banco (ex: escopo único)' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

eventosRouter.post('/:id/cancelar', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const evento = await db.select().from(eventos).where(eq(eventos.id, id)).get()
  if (!evento) return c.json({ error: 'Evento não encontrado' }, 404)
  if (!evento.ativo) return c.json({ error: 'Evento já está cancelado', code: 'EVENTO_JA_CANCELADO' }, 409)

  const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)
  const atorMembroId = c.get('membroId') || null
  if (!atorMembroId || !escopoTipo || !escopoId) {
    return c.json({ error: 'Escopo da Agenda indisponível', code: 'FORBIDDEN' }, 403)
  }

  const autorizado = await podeGerenciarAgendaNoEscopo(
    db,
    atorMembroId,
    escopoTipo as 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO',
    escopoId
  )
  if (!autorizado) {
    return c.json({ error: 'Acesso não autorizado para gerir a Agenda neste escopo', code: 'FORBIDDEN' }, 403)
  }

  const convocacao = await db
    .select()
    .from(convocacoes)
    .where(eq(convocacoes.eventoId, id))
    .get()

  if (convocacao?.status === 'PUBLICADA') {
    return c.json({
      error: 'O evento possui convocação PUBLICADA. Cancele primeiro a convocação antes de cancelar o evento.',
      code: 'EVENTO_COM_CONVOCACAO_PUBLICADA'
    }, 409)
  }

  const agoraIso = new Date().toISOString()
  const audits: AuditLogData[] = []

  if (convocacao && convocacao.status === 'RASCUNHO') {
    audits.push({
      acao: 'CONVOCACAO_CANCELADA',
      atorMembroId,
      recursoTipo: 'CONVOCACAO',
      recursoId: convocacao.id,
      escopoTipo,
      escopoId,
      contexto: {
        eventoId: id,
        motivo: 'CANCELAMENTO_EVENTO'
      }
    })
  }

  audits.push({
    acao: 'EVENTO_CANCELADO',
    atorMembroId,
    recursoTipo: 'EVENTO',
    recursoId: id,
    escopoTipo,
    escopoId,
    contexto: {
      titulo: evento.titulo,
      convocacaoId: convocacao?.id ?? null,
      convocacaoStatusAnterior: convocacao?.status ?? null
    }
  })

  await executarOperacaoComAudits(
    db,
    qdb => {
      const queries: any[] = []

      if (convocacao?.status === 'RASCUNHO') {
        queries.push(
          qdb.delete(convocacaoFuncoes).where(eq(convocacaoFuncoes.convocacaoId, convocacao.id)),
          qdb.update(convocacoes)
            .set({
              status: 'CANCELADA',
              ativo: false,
              canceladaEm: agoraIso,
              updatedAt: agoraIso
            })
            .where(eq(convocacoes.id, convocacao.id))
        )
      }

      queries.push(
        qdb.update(eventos)
          .set({
            ativo: false,
            recorrenciaExcecao: evento.serieRecorrenciaId ? true : evento.recorrenciaExcecao,
            agendaRevisao: agoraIso,
            updatedAt: agoraIso
          })
          .where(eq(eventos.id, id))
      )

      return queries
    },
    audits
  )

  return c.json({
    success: true,
    eventoId: id,
    convocacaoId: convocacao?.id ?? null,
    convocacaoCancelada: convocacao?.status === 'RASCUNHO'
  })
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
    const espacoFoiAlterado = parsed.espacoId !== undefined && parsed.espacoId !== existing.espacoId
    const espacoValido = espacoFoiAlterado
      ? await espacoAtivoPertenceAoLocal(db, merged.localId, merged.espacoId)
      : await espacoPertenceAoLocal(db, merged.localId, merged.espacoId)

    if (!espacoValido) {
      if (espacoFoiAlterado && await espacoPertenceAoLocal(db, merged.localId, merged.espacoId)) {
        return c.json({ error: 'O espaço selecionado está inativo', code: 'ESPACO_INATIVO' }, 409)
      }
      return c.json({ error: 'O espaço selecionado não pertence ao Local informado', code: 'ESPACO_FORA_DO_LOCAL' }, 400)
    }

    const escopoOriginal = extrairEscopoDoEvento(existing)
    const escopoFinal = extrairEscopoDoEvento(merged)
    const membroId = c.get('membroId')
    if (
      !membroId ||
      !escopoOriginal.escopoTipo ||
      !escopoOriginal.escopoId ||
      !escopoFinal.escopoTipo ||
      !escopoFinal.escopoId
    ) {
      return c.json({ error: 'Escopo da Agenda indisponível', code: 'FORBIDDEN' }, 403)
    }

    const [autorizadoOriginal, autorizadoFinal] = await Promise.all([
      podeGerenciarAgendaNoEscopo(
        db,
        membroId,
        escopoOriginal.escopoTipo as 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO',
        escopoOriginal.escopoId
      ),
      podeGerenciarAgendaNoEscopo(
        db,
        membroId,
        escopoFinal.escopoTipo as 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO',
        escopoFinal.escopoId
      ),
    ])

    if (!autorizadoOriginal || !autorizadoFinal) {
      return c.json({ error: 'Acesso não autorizado para gerir a Agenda neste escopo', code: 'FORBIDDEN' }, 403)
    }

    // PMO Rule: Ao alterar uma ocorrência individual, preservar serie_recorrencia_id e marcar recorrencia_excecao = true.
    const isExcecao = existing.serieRecorrenciaId !== null ? true : existing.recorrenciaExcecao
    const nowIso = new Date().toISOString()
    const horarioAlterado =
      (parsed.inicioEm !== undefined && !mesmoInstante(parsed.inicioEm, existing.inicioEm)) ||
      (parsed.fimEm !== undefined && !mesmoInstante(parsed.fimEm, existing.fimEm))
    const ativacaoAlterada =
      parsed.ativo !== undefined && parsed.ativo !== existing.ativo

    const atorMembroId = c.get('membroId') || null

    const auditData: AuditLogData = {
      acao: 'EVENTO_ATUALIZADO',
      atorMembroId,
      recursoTipo: 'EVENTO',
      recursoId: id,
      escopoTipo: escopoFinal.escopoTipo,
      escopoId: escopoFinal.escopoId,
      contexto: {
        titulo: existing.titulo,
        modalidade: existing.modalidade,
        camposAlterados: Object.keys(parsed),
      },
    }

    await executarOperacaoComAudit(
      db,
      (qdb) => [
        qdb.update(eventos)
          .set({
            ...parsed,
            recorrenciaExcecao: isExcecao,
            agendaRevisao: horarioAlterado || ativacaoAlterada ? nowIso : existing.agendaRevisao,
            updatedAt: nowIso,
          })
          .where(eq(eventos.id, id))
      ],
      auditData
    )

    const updated = await db.select().from(eventos).where(eq(eventos.id, id)).get()
    return c.json(updated)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Local, Espaço ou Escopo vinculado não existe' }, 400)
    }
    if (err.message && err.message.includes('CHECK constraint failed')) {
      return c.json({ error: 'Violação de regra de negócio no banco (ex: escopo único)' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

