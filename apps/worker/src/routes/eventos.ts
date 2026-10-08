import { Hono } from 'hono'
import { eq, and, or, sql, inArray } from 'drizzle-orm'
import { eventos, convocacoes, convocacaoFuncoes, locais, espacosLocal, membros, casas, setores, administracoes, gruposTrabalho, eventosParticipantesExternos } from '../db/schema'
import { EventoCreate, EventoUpdate } from '@piedade/shared'
import { executarOperacaoComAudit, executarOperacaoComAudits, extrairEscopoDoEvento, AuditLogData } from '../services/auditoria'
import { authMiddleware } from '../middleware/auth'
import { podeGerenciarAgendaNoEscopo, podeGerenciarAgendaExterna, obterRegionalGestaoAgendaExterna, eMasterSistema } from '../security/permissoes'
import { espacoAtivoPertenceAoLocal, espacoPertenceAoLocal } from '../services/espacos-local'

import { carregarEscoposOperacionaisLegados, condicaoEventosVisiveis, condicaoEventosGerenciaveis, podeLerEvento, podeGerenciarEvento } from '../security/eventos'

export const eventosRouter = new Hono<any>()

const D1_IN_BATCH = 80

async function carregarEmLotes<T>(
  ids: string[],
  carregar: (lote: string[]) => Promise<T[]>
): Promise<T[]> {
  const resultado: T[] = []
  for (let i = 0; i < ids.length; i += D1_IN_BATCH) {
    resultado.push(...await carregar(ids.slice(i, i + D1_IN_BATCH)))
  }
  return resultado
}

async function enriquecerAncestralidadeEventos(db: any, itens: any[]) {
  if (itens.length === 0) return itens

  const idsUnicos = (valores: Array<string | null | undefined>) =>
    Array.from(new Set(valores.filter((valor): valor is string => Boolean(valor))))

  const casaIds = idsUnicos(itens.map(item => item.evento.casaId))
  const gtIds = idsUnicos(itens.map(item => item.evento.grupoTrabalhoId))

  const [casasRows, gtsRows] = await Promise.all([
    carregarEmLotes(casaIds, lote =>
      db.select({ id: casas.id, setorId: casas.setorId })
        .from(casas).where(inArray(casas.id, lote)).all()
    ),
    carregarEmLotes(gtIds, lote =>
      db.select({
        id: gruposTrabalho.id,
        regionalId: gruposTrabalho.regionalId,
        administracaoId: gruposTrabalho.administracaoId,
        setorId: gruposTrabalho.setorId,
      }).from(gruposTrabalho).where(inArray(gruposTrabalho.id, lote)).all()
    ),
  ])

  const casaPorId = new Map(casasRows.map((item: any) => [item.id, item]))
  const gtPorId = new Map(gtsRows.map((item: any) => [item.id, item]))
  const setorIds = idsUnicos([
    ...itens.map(item => item.evento.setorId),
    ...casasRows.map((item: any) => item.setorId),
    ...gtsRows.map((item: any) => item.setorId),
  ])
  const setoresRows = await carregarEmLotes(setorIds, lote =>
    db.select({ id: setores.id, administracaoId: setores.administracaoId })
      .from(setores).where(inArray(setores.id, lote)).all()
  )
  const setorPorId = new Map(setoresRows.map((item: any) => [item.id, item]))

  const administracaoIds = idsUnicos([
    ...itens.map(item => item.evento.administracaoId),
    ...setoresRows.map((item: any) => item.administracaoId),
    ...gtsRows.map((item: any) => item.administracaoId),
  ])
  const administracoesRows = await carregarEmLotes(administracaoIds, lote =>
    db.select({ id: administracoes.id, regionalId: administracoes.regionalId })
      .from(administracoes).where(inArray(administracoes.id, lote)).all()
  )
  const administracaoPorId = new Map(administracoesRows.map((item: any) => [item.id, item]))

  return itens.map((item: any) => {
    const evento = item.evento
    const gt = evento.grupoTrabalhoId ? gtPorId.get(evento.grupoTrabalhoId) as any : null
    const casa = evento.casaId ? casaPorId.get(evento.casaId) as any : null
    const filtroSetorId = evento.setorId ?? casa?.setorId ?? gt?.setorId ?? null
    const setor = filtroSetorId ? setorPorId.get(filtroSetorId) as any : null
    const filtroAdministracaoId = evento.administracaoId ?? setor?.administracaoId ?? gt?.administracaoId ?? null
    const administracao = filtroAdministracaoId
      ? administracaoPorId.get(filtroAdministracaoId) as any
      : null
    const gtSetor = gt?.setorId ? setorPorId.get(gt.setorId) as any : null
    const gtAdministracaoId = gt?.administracaoId ?? gtSetor?.administracaoId ?? null
    const gtAdministracao = gtAdministracaoId
      ? administracaoPorId.get(gtAdministracaoId) as any
      : null
    const filtroRegionalId =
      evento.regionalId ?? administracao?.regionalId ?? gt?.regionalId ?? gtAdministracao?.regionalId ?? null

    return {
      ...evento,
      podeGerenciar: item.podeGerenciar === 1,
      filtroRegionalId,
      filtroAdministracaoId,
      filtroSetorId,
    }
  })
}

function mesmoInstante(a: string, b: string) {
  return new Date(a).getTime() === new Date(b).getTime()
}

function formatarDataHoraAgenda(valor: string) {
  return new Date(valor).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function criarAvisoAlteracaoMaterial(db: any, anterior: any, atual: any) {
  const partes: string[] = []

  if (!mesmoInstante(anterior.inicioEm, atual.inicioEm) || !mesmoInstante(anterior.fimEm, atual.fimEm)) {
    partes.push(
      `Horário: ${formatarDataHoraAgenda(anterior.inicioEm)}–${formatarDataHoraAgenda(anterior.fimEm)} → ${formatarDataHoraAgenda(atual.inicioEm)}–${formatarDataHoraAgenda(atual.fimEm)}`
    )
  }

  if (anterior.modalidade !== atual.modalidade) {
    partes.push(`Modalidade: ${anterior.modalidade} → ${atual.modalidade}`)
  }

  if (anterior.localId !== atual.localId) {
    const [localAnterior, localAtual] = await Promise.all([
      anterior.localId ? db.select({ nome: locais.nome }).from(locais).where(eq(locais.id, anterior.localId)).get() : null,
      atual.localId ? db.select({ nome: locais.nome }).from(locais).where(eq(locais.id, atual.localId)).get() : null,
    ])
    partes.push(`Local: ${localAnterior?.nome ?? 'sem local'} → ${localAtual?.nome ?? 'sem local'}`)
  }

  if (anterior.espacoId !== atual.espacoId) {
    const [espacoAnterior, espacoAtual] = await Promise.all([
      anterior.espacoId ? db.select({ nome: espacosLocal.nome }).from(espacosLocal).where(eq(espacosLocal.id, anterior.espacoId)).get() : null,
      atual.espacoId ? db.select({ nome: espacosLocal.nome }).from(espacosLocal).where(eq(espacosLocal.id, atual.espacoId)).get() : null,
    ])
    partes.push(`Espaço: ${espacoAnterior?.nome ?? 'sem espaço'} → ${espacoAtual?.nome ?? 'sem espaço'}`)
  }

  if (anterior.urlOnline !== atual.urlOnline) {
    partes.push(`Acesso online: ${anterior.urlOnline ? 'link anterior' : 'sem link'} → ${atual.urlOnline ? 'novo link disponível' : 'removido'}`)
  }

  if (
    anterior.abrangencia !== atual.abrangencia ||
    anterior.destinoUf !== atual.destinoUf ||
    anterior.destinoPaisCodigo !== atual.destinoPaisCodigo ||
    anterior.destinoCidadeLocal !== atual.destinoCidadeLocal
  ) {
    const formatarDestino = (evento: any) => {
      if (evento.abrangencia === 'NACIONAL') {
        return [evento.destinoCidadeLocal, evento.destinoUf].filter(Boolean).join(' — ') || 'destino nacional não informado'
      }
      if (evento.abrangencia === 'INTERNACIONAL') {
        return [evento.destinoCidadeLocal, evento.destinoPaisCodigo].filter(Boolean).join(' — ') || 'destino internacional não informado'
      }
      return 'escopo territorial da Regional'
    }
    partes.push(`Destino: ${formatarDestino(anterior)} → ${formatarDestino(atual)}`)
  }

  if (partes.length === 0) return null
  return `Atenção! O evento "${anterior.titulo}" foi alterado. ${partes.join('; ')}. Favor reconfirmar sua presença.`
}

function houveAlteracaoMaterial(anterior: any, atual: any) {
  return (
    !mesmoInstante(anterior.inicioEm, atual.inicioEm) ||
    !mesmoInstante(anterior.fimEm, atual.fimEm) ||
    anterior.modalidade !== atual.modalidade ||
    anterior.localId !== atual.localId ||
    anterior.espacoId !== atual.espacoId ||
    anterior.urlOnline !== atual.urlOnline ||
    anterior.abrangencia !== atual.abrangencia ||
    anterior.destinoUf !== atual.destinoUf ||
    anterior.destinoPaisCodigo !== atual.destinoPaisCodigo ||
    anterior.destinoCidadeLocal !== atual.destinoCidadeLocal
  )
}

eventosRouter.use('*', authMiddleware)

// Metadados de filtro não concedem acesso a eventos fora da autorização.
eventosRouter.get('/filtros', async c => {
  const master = eMasterSistema(c.get('contextoPermissoes'))
  const pessoas = master ? await c.get('db').select({ id: membros.id, nome: membros.nome })
    .from(membros).orderBy(membros.nome).all() : []
  const filtrarEscopo = master || c.get('contextoPermissoes').acessosAtivos.some((acesso: any) => ['ADMINISTRADOR_SISTEMA', 'GESTOR_AGENDA', 'GESTOR_RELATORIOS', 'AUDITOR', 'OPERADOR_PORTARIA_PERMANENTE'].includes(acesso.perfilCodigo)) ||
    (await carregarEscoposOperacionaisLegados(c.get('db'), c.get('membroId'))).length > 0
  return c.json({ master, filtrarEscopo, pessoas })
})

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

  const pessoaId = c.req.query('pessoaId')
  if (pessoaId) {
    if (!eMasterSistema(c.get('contextoPermissoes'))) {
      return c.json({ error: 'Filtro por pessoa exclusivo do Master', code: 'FORBIDDEN' }, 403)
    }
    conditions.push(or(eq(eventos.criadorMembroId, pessoaId), eq(eventos.organizadorMembroId, pessoaId),
      sql`EXISTS (SELECT 1 FROM convocacoes c JOIN convocacao_destinatarios d ON d.convocacao_id = c.id WHERE c.evento_id = ${eventos.id} AND c.status = 'PUBLICADA' AND c.ativo = 1 AND d.membro_id = ${pessoaId})`))
  }
  conditions.push(await condicaoEventosVisiveis(db, c.get('contextoPermissoes')))
  const gerenciavel = condicaoEventosGerenciaveis(c.get('contextoPermissoes'))
  const data = await db.select({ evento: eventos, podeGerenciar: sql<number>`CASE WHEN ${gerenciavel} THEN 1 ELSE 0 END` }).from(eventos).where(and(...conditions)).all()
  return c.json(await enriquecerAncestralidadeEventos(db, data))

})

eventosRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(eventos).where(eq(eventos.id, id)).get()
  
  if (!data) return c.json({ error: 'Evento não encontrado' }, 404)

  if (!(await podeLerEvento(db, c.get('contextoPermissoes'), id))) {
    return c.json({ error: 'Acesso não autorizado para este evento', code: 'FORBIDDEN' }, 403)
  }

  return c.json({ ...data, podeGerenciar: await podeGerenciarEvento(db, c.get('membroId'), data) })
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

    const atorMembroId = c.get('membroId') || null
    const externo = parsed.abrangencia === 'NACIONAL' || parsed.abrangencia === 'INTERNACIONAL'
    const { escopoTipo, escopoId } = externo
      ? { escopoTipo: parsed.abrangencia, escopoId: parsed.abrangencia === 'NACIONAL' ? parsed.destinoUf : parsed.destinoPaisCodigo }
      : extrairEscopoDoEvento(parsed)

    if (!atorMembroId || !escopoTipo || !escopoId) {
      return c.json({ error: 'Escopo da Agenda indisponível', code: 'FORBIDDEN' }, 403)
    }

    const regionalGestaoId = externo
      ? await obterRegionalGestaoAgendaExterna(db, atorMembroId)
      : null

    const autorizado = externo
      ? (
          parsed.pessoal === true ||
          (
            !!regionalGestaoId &&
            await podeGerenciarAgendaExterna(db, atorMembroId, regionalGestaoId)
          )
        )
      : await podeGerenciarAgendaNoEscopo(
          db,
          atorMembroId,
          escopoTipo as 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO',
          escopoId
        )

    if (!autorizado) {
      return c.json({ error: 'Acesso não autorizado para gerir a Agenda neste escopo', code: 'FORBIDDEN' }, 403)
    }
    if (externo && !regionalGestaoId) {
      return c.json({
        error: 'Não foi possível determinar uma única Regional responsável pelo atendimento externo',
        code: 'REGIONAL_GESTAO_AMBIGUA'
      }, 409)
    }

    if (parsed.pessoal) {
      if (parsed.organizadorMembroId && parsed.organizadorMembroId !== atorMembroId) {
        return c.json({ error: 'Evento Próprio pertence ao usuário conectado', code: 'FORBIDDEN' }, 403)
      }
      parsed.organizadorMembroId = atorMembroId
    }

    const auditData: AuditLogData = {
      acao: 'EVENTO_CRIADO',
      atorMembroId,
      recursoTipo: 'EVENTO',
      recursoId: id,
      escopoTipo: externo ? 'REGIONAL' : escopoTipo,
      escopoId: externo ? regionalGestaoId : escopoId,
      contexto: {
        titulo: parsed.titulo,
        modalidade: parsed.modalidade,
        pessoal: parsed.pessoal ?? false,
        escopoTipo: escopoTipo || '',
        escopoId: escopoId || '',
        regionalGestaoId,
      },
    }

    await executarOperacaoComAudit(
      db,
      (qdb) => [qdb.insert(eventos).values({
        id,
        ...parsed,
        criadorMembroId: atorMembroId,
        regionalGestaoId,
        regionalId: externo ? regionalGestaoId : parsed.regionalId,
      })],
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
  if (!(await podeGerenciarEvento(db, c.get('membroId'), evento))) return c.json({ error: 'Acesso não autorizado para este evento', code: 'FORBIDDEN' }, 403)
  if (!evento.ativo) return c.json({ error: 'Evento já está cancelado', code: 'EVENTO_JA_CANCELADO' }, 409)

  if (new Date(evento.fimEm).getTime() <= Date.now()) {
    return c.json({
      error: 'Eventos já encerrados não podem ser alterados. O registro deve preservar o que efetivamente ocorreu.',
      code: 'EVENTO_PASSADO_IMUTAVEL'
    }, 409)
  }

  const { escopoTipo, escopoId } = extrairEscopoDoEvento(evento)
  const atorMembroId = c.get('membroId') || null
  if (!atorMembroId || !escopoTipo || !escopoId) {
    return c.json({ error: 'Escopo da Agenda indisponível', code: 'FORBIDDEN' }, 403)
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

    if (!(await podeGerenciarEvento(db, c.get('membroId'), existing))) return c.json({ error: 'Acesso não autorizado para este evento', code: 'FORBIDDEN' }, 403)

    if (new Date(existing.fimEm).getTime() <= Date.now()) {
      return c.json({
        error: 'Eventos já encerrados não podem ser alterados. O registro deve preservar o que efetivamente ocorreu.',
        code: 'EVENTO_PASSADO_IMUTAVEL'
      }, 409)
    }

    // Validar estado final mesclado (existente + patch) com EventoCreate.
    // Em eventos externos, regionalId é interno (Regional de gestão) e não faz parte do destino público.
    const merged = { ...existing, ...parsed }
    EventoCreate.parse(
      merged.abrangencia === 'NACIONAL' || merged.abrangencia === 'INTERNACIONAL'
        ? { ...merged, regionalId: null, administracaoId: null, setorId: null, casaId: null, grupoTrabalhoId: null }
        : merged
    )
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
    const membroId = c.get('membroId')
    const escopoFinal = merged.abrangencia === 'NACIONAL' || merged.abrangencia === 'INTERNACIONAL'
      ? { escopoTipo: 'REGIONAL', escopoId: existing.regionalGestaoId || (membroId ? await obterRegionalGestaoAgendaExterna(db, membroId) : null) }
      : extrairEscopoDoEvento(merged)
    if (
      !membroId ||
      !escopoOriginal.escopoTipo ||
      !escopoOriginal.escopoId ||
      !escopoFinal.escopoTipo ||
      !escopoFinal.escopoId
    ) {
      return c.json({ error: 'Escopo da Agenda indisponível', code: 'FORBIDDEN' }, 403)
    }

    const externoFinal = merged.abrangencia === 'NACIONAL' || merged.abrangencia === 'INTERNACIONAL'
    const regionalGestaoFinal = externoFinal
      ? (existing.regionalGestaoId || await obterRegionalGestaoAgendaExterna(db, membroId))
      : null
    const autorizadoFinal = externoFinal
      ? (
          (merged.pessoal === true && existing.criadorMembroId === membroId) ||
          (
            !!regionalGestaoFinal &&
            await podeGerenciarAgendaExterna(db, membroId, regionalGestaoFinal)
          )
        )
      : await podeGerenciarAgendaNoEscopo(
          db, membroId,
          escopoFinal.escopoTipo as 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO',
          escopoFinal.escopoId,
          existing.criadorMembroId === membroId || existing.organizadorMembroId === membroId
        )
    const preservaCasaPessoal =
      !externoFinal &&
      existing.pessoal &&
      merged.casaId === existing.casaId
    if (!autorizadoFinal && !preservaCasaPessoal) return c.json({ error: 'Acesso não autorizado para gerir a Agenda neste escopo', code: 'FORBIDDEN' }, 403)

    if ((existing.pessoal ?? false) !== (merged.pessoal ?? false)) {
      return c.json({ error: 'O público do evento não pode ser alterado depois da criação', code: 'PUBLICO_EVENTO_IMUTAVEL' }, 409)
    }
    if (merged.pessoal && merged.organizadorMembroId !== existing.criadorMembroId) {
      return c.json({ error: 'Evento Próprio não pode ser transferido a outro usuário', code: 'FORBIDDEN' }, 403)
    }

    // PMO Rule: Ao alterar uma ocorrência individual, preservar serie_recorrencia_id e marcar recorrencia_excecao = true.
    const isExcecao = existing.serieRecorrenciaId !== null ? true : existing.recorrenciaExcecao
    const nowIso = new Date().toISOString()
    const ativacaoAlterada =
      parsed.ativo !== undefined && parsed.ativo !== existing.ativo
    const alteracaoMaterial = houveAlteracaoMaterial(existing, merged)
    const agendaAviso = alteracaoMaterial
      ? await criarAvisoAlteracaoMaterial(db, existing, merged)
      : existing.agendaAviso

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
        alteracaoMaterial,
        agendaAviso: alteracaoMaterial ? agendaAviso : null,
      },
    }

    await executarOperacaoComAudit(
      db,
      (qdb) => [
        qdb.update(eventos)
          .set({
            ...parsed,
            regionalGestaoId: regionalGestaoFinal,
            regionalId: externoFinal ? regionalGestaoFinal : merged.regionalId,
            administracaoId: externoFinal ? null : merged.administracaoId,
            setorId: externoFinal ? null : merged.setorId,
            casaId: externoFinal ? null : merged.casaId,
            grupoTrabalhoId: externoFinal ? null : merged.grupoTrabalhoId,
            recorrenciaExcecao: isExcecao,
            agendaRevisao: alteracaoMaterial || ativacaoAlterada ? nowIso : existing.agendaRevisao,
            agendaAviso,
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


// Participação externa é nominal, nunca uma função institucional.
eventosRouter.get('/:id/participantes-externos', async c => {
  const db = c.get('db')
  const id = c.req.param('id')
  const membroId = c.get('membroId')
  const evento = await db.select().from(eventos).where(eq(eventos.id,id)).get()
  if (!evento || !['NACIONAL','INTERNACIONAL'].includes(evento.abrangencia)) return c.json({error:'Evento externo não encontrado'},404)
  if (!membroId || !(await podeLerEvento(db,c.get('contextoPermissoes'),id))) return c.json({error:'Acesso não autorizado'},403)
  const itens = await db.select().from(eventosParticipantesExternos).where(eq(eventosParticipantesExternos.eventoId,id)).all()
  return c.json(itens)
})

eventosRouter.post('/:id/participantes-externos', async c => {
  const db = c.get('db')
  const id = c.req.param('id')
  const ator = c.get('membroId')
  const evento = await db.select().from(eventos).where(eq(eventos.id,id)).get()
  if (!evento || !evento.ativo || !['NACIONAL','INTERNACIONAL'].includes(evento.abrangencia)) return c.json({error:'Evento externo não encontrado'},404)
  if (!ator || !(await podeGerenciarEvento(db,ator,evento))) return c.json({error:'Acesso não autorizado'},403)
  const payload: unknown = await c.req.json().catch(() => null)
  if (!payload || typeof payload !== 'object') return c.json({error:'Dados inválidos'},400)
  const { membroId, tipo } = payload as Record<string,unknown>
  if (typeof membroId !== 'string' || !membroId || (tipo !== 'CONVIDADO' && tipo !== 'ATRIBUIDO')) return c.json({error:'Membro e tipo de participação inválidos'},400)
  const membro = await db.select({id:membros.id,ativo:membros.ativo}).from(membros).where(eq(membros.id,membroId)).get()
  if (!membro || !membro.ativo) return c.json({error:'Membro não encontrado ou inativo'},404)
  try {
    await executarOperacaoComAudit(db, qdb => [qdb.insert(eventosParticipantesExternos).values({eventoId:id,membroId,status:tipo,criadoPorMembroId:ator})], {
      acao: tipo === 'CONVIDADO' ? 'EVENTO_EXTERNO_CONVITE' : 'EVENTO_EXTERNO_ATRIBUICAO',
      atorMembroId: ator, recursoTipo: 'EVENTO', recursoId: id,
      escopoTipo: 'REGIONAL', escopoId: evento.regionalGestaoId ?? evento.regionalId,
      contexto: { membroId, tipo },
    })
    return c.json({eventoId:id,membroId,status:tipo},201)
  } catch(err:any) {
    if (String(err?.message).includes('UNIQUE constraint')) return c.json({error:'Membro já incluído neste evento'},409)
    return c.json({error:'Falha ao incluir participante'},400)
  }
})

eventosRouter.patch('/:id/participantes-externos/resposta', async c => {
  const db = c.get('db')
  const id = c.req.param('id')
  const membroId = c.get('membroId')
  if (!membroId) return c.json({error:'Sem identificação do membro'},403)
  const payload: unknown = await c.req.json().catch(() => null)
  if (!payload || typeof payload !== 'object') return c.json({error:'Dados inválidos'},400)
  const { resposta } = payload as Record<string,unknown>
  if (resposta !== 'CONFIRMADO' && resposta !== 'RECUSADO') return c.json({error:'Resposta inválida'},400)
  const convite = await db.select().from(eventosParticipantesExternos)
    .where(and(eq(eventosParticipantesExternos.eventoId,id),eq(eventosParticipantesExternos.membroId,membroId))).get()
  if (!convite || convite.status !== 'CONVIDADO') return c.json({error:'Convite pendente não encontrado'},404)
  const evento = await db.select().from(eventos).where(eq(eventos.id,id)).get()
  if (!evento || !['NACIONAL','INTERNACIONAL'].includes(evento.abrangencia)) return c.json({error:'Evento externo não encontrado'},404)
  try {
    await executarOperacaoComAudit(db, qdb => [qdb.update(eventosParticipantesExternos).set({
      // Fail closed: a stale response writes an invalid CHECK value, aborting the whole
      // atomic batch, including the audit record. A conditional UPDATE alone would
      // silently affect zero rows while still recording a misleading audit entry.
      status: sql`CASE WHEN ${eventosParticipantesExternos.status} = 'CONVIDADO' THEN ${resposta} ELSE 'RESPOSTA_OBSOLETA' END`,
      updatedAt: new Date().toISOString(),
    }).where(and(eq(eventosParticipantesExternos.eventoId,id),eq(eventosParticipantesExternos.membroId,membroId)))], {
      acao: 'EVENTO_EXTERNO_RESPOSTA', atorMembroId: membroId,
      recursoTipo: 'EVENTO', recursoId: id,
      escopoTipo: 'REGIONAL', escopoId: evento.regionalGestaoId ?? evento.regionalId,
      contexto: { membroId, resposta },
    })
  } catch (err: any) {
    if (String(err?.message).includes('CHECK constraint failed')) {
      return c.json({ error: 'Este convite já foi respondido', code: 'CONVITE_RESPOSTA_OBSOLETA' }, 409)
    }
    return c.json({ error: 'Não foi possível registrar a resposta', code: 'ERRO_RESPOSTA_CONVITE' }, 400)
  }
  return c.json({eventoId:id,membroId,status:resposta})
})
