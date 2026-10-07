import { Hono } from 'hono'
import { eq, and, gte, sql, inArray, isNotNull } from 'drizzle-orm'
import { auditoriaLogs, administracoes, casas, eventos, gruposTrabalho, membros, seriesRecorrencia, setores, locais, espacosLocal } from '../db/schema'
import { SerieCreate, SerieUpdatePayload, generateOccurrences, getLocalDateFromUtc } from '@piedade/shared'
import { EventoCreate } from '@piedade/shared'
import { executeAtomic } from '../db/batch'
import { authMiddleware } from '../middleware/auth'
import { eMasterSistema, podeGerenciarAgendaNoEscopo, regionaisAdministradas } from '../security/permissoes'
import { podeGerenciarEvento } from '../security/eventos'
import { criarAuditQuery, executarOperacaoComAudit, extrairEscopoDoEvento } from '../services/auditoria'
import { espacoAtivoPertenceAoLocal, espacoPertenceAoLocal } from '../services/espacos-local'

export const seriesRecorrenciaRouter = new Hono<any>()

// Usado por todas as regenerações: editar ou dividir uma série não transfere autoria.
async function recuperarCriadorDaSerie(db: any, serieId: string): Promise<string | null> {
  const criacao = await db.select({ membroId: auditoriaLogs.atorMembroId })
    .from(auditoriaLogs)
    .where(and(
      eq(auditoriaLogs.acao, 'SERIE_RECORRENCIA_CRIADA'),
      eq(auditoriaLogs.recursoTipo, 'SERIE_RECORRENCIA'),
      eq(auditoriaLogs.recursoId, serieId),
      isNotNull(auditoriaLogs.atorMembroId)
    ))
    .orderBy(auditoriaLogs.criadoEm, auditoriaLogs.id).get()
  const ocorrenciaOriginal = criacao ? null : await db
    .select({ membroId: eventos.criadorMembroId }).from(eventos)
    .where(and(eq(eventos.serieRecorrenciaId, serieId), isNotNull(eventos.criadorMembroId)))
    .orderBy(eventos.createdAt, eventos.id).get()
  return criacao?.membroId ?? ocorrenciaOriginal?.membroId ?? null

}
async function recuperarCriadoresDasSeries(db: any, serieIds: string[]): Promise<Map<string, string>> {
  const criadores = new Map<string, string>()
  if (serieIds.length === 0) return criadores

  const criacoes = await db.select({
    serieId: auditoriaLogs.recursoId,
    membroId: auditoriaLogs.atorMembroId,
    criadoEm: auditoriaLogs.criadoEm,
    id: auditoriaLogs.id,
  }).from(auditoriaLogs).where(and(
    eq(auditoriaLogs.acao, 'SERIE_RECORRENCIA_CRIADA'),
    eq(auditoriaLogs.recursoTipo, 'SERIE_RECORRENCIA'),
    inArray(auditoriaLogs.recursoId, serieIds),
    isNotNull(auditoriaLogs.atorMembroId)
  )).orderBy(auditoriaLogs.criadoEm, auditoriaLogs.id).all()

  for (const item of criacoes) {
    if (item.serieId && item.membroId && !criadores.has(item.serieId)) {
      criadores.set(item.serieId, item.membroId)
    }
  }

  const faltantes = serieIds.filter(id => !criadores.has(id))
  if (faltantes.length === 0) return criadores

  const ocorrencias = await db.select({
    serieId: eventos.serieRecorrenciaId,
    membroId: eventos.criadorMembroId,
    createdAt: eventos.createdAt,
    id: eventos.id,
  }).from(eventos).where(and(
    inArray(eventos.serieRecorrenciaId, faltantes),
    isNotNull(eventos.criadorMembroId)
  )).orderBy(eventos.createdAt, eventos.id).all()

  for (const item of ocorrencias) {
    if (item.serieId && item.membroId && !criadores.has(item.serieId)) {
      criadores.set(item.serieId, item.membroId)
    }
  }
  return criadores
}


function mesmoInstante(a: string, b: string) {
  return new Date(a).getTime() === new Date(b).getTime()
}

const CAMPOS_OPERACIONAIS_SERIE = new Set(['modalidade', 'localId', 'espacoId', 'urlOnline'])

function apenasAlteracaoOperacionalSerie(changes: Record<string, unknown>) {
  const chaves = Object.keys(changes)
  return chaves.length > 0 && chaves.every(chave => CAMPOS_OPERACIONAIS_SERIE.has(chave))
}

async function criarAvisoAlteracaoOperacionalSerie(db: any, anterior: any, atual: any) {
  const partes: string[] = []

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

  if (partes.length === 0) return null
  return `Atenção! O evento "${anterior.titulo}" foi alterado. ${partes.join('; ')}. Favor reconfirmar sua presença.`
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

function houveAlteracaoMaterialOcorrencia(anterior: any, atual: any) {
  return (
    !mesmoInstante(anterior.inicioEm, atual.inicioEm) ||
    !mesmoInstante(anterior.fimEm, atual.fimEm) ||
    anterior.modalidade !== atual.modalidade ||
    anterior.localId !== atual.localId ||
    anterior.espacoId !== atual.espacoId ||
    anterior.urlOnline !== atual.urlOnline
  )
}

async function criarAvisoAlteracaoOcorrencia(db: any, anterior: any, atual: any) {
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

  if (partes.length === 0) return null
  return `Atenção! O evento "${anterior.titulo}" foi alterado. ${partes.join('; ')}. Favor reconfirmar sua presença.`
}

seriesRecorrenciaRouter.use('*', authMiddleware)

interface EscoposAgendaAutorizados {
  tudo: boolean
  regionaisIds: Set<string>
  administracoesIds: Set<string>
  setoresIds: Set<string>
  casasIds: Set<string>
  gruposTrabalhoIds: Set<string>
}

async function carregarEscoposAgendaAutorizados(c: any): Promise<EscoposAgendaAutorizados> {
  const db = c.get('db')
  const contexto = c.get('contextoPermissoes')

  const resultado: EscoposAgendaAutorizados = {
    tudo: eMasterSistema(contexto),
    regionaisIds: new Set<string>(),
    administracoesIds: new Set<string>(),
    setoresIds: new Set<string>(),
    casasIds: new Set<string>(),
    gruposTrabalhoIds: new Set<string>(),
  }
  if (resultado.tudo) return resultado

  const regionaisAgenda = new Set<string>(regionaisAdministradas(contexto))
  const administracoesAgenda = new Set<string>()
  const setoresAgenda = new Set<string>()
  const casasAgenda = new Set<string>()
  const gtsAgenda = new Set<string>()
  const administracoesDescendentesDeRegional = new Set<string>()
  const setoresDescendentesDeRegional = new Set<string>()

  for (const acesso of contexto.acessosAtivos) {
    if (
      acesso.perfilCodigo !== 'GESTOR_AGENDA' ||
      !acesso.escopoId ||
      acesso.escopoTipo === 'GLOBAL'
    ) continue

    if (acesso.escopoTipo === 'REGIONAL') regionaisAgenda.add(acesso.escopoId)
    if (acesso.escopoTipo === 'ADMINISTRACAO') administracoesAgenda.add(acesso.escopoId)
    if (acesso.escopoTipo === 'SETOR') setoresAgenda.add(acesso.escopoId)
    if (acesso.escopoTipo === 'CASA') casasAgenda.add(acesso.escopoId)
    if (acesso.escopoTipo === 'GRUPO_TRABALHO') gtsAgenda.add(acesso.escopoId)
  }

  const regionaisIds = Array.from(regionaisAgenda)
  if (regionaisIds.length > 0) {
    const adms = await db
      .select({ id: administracoes.id })
      .from(administracoes)
      .where(inArray(administracoes.regionalId, regionaisIds))
      .all()
    adms.forEach((item: any) => {
      administracoesAgenda.add(item.id)
      administracoesDescendentesDeRegional.add(item.id)
    })

    const gtsRegionais = await db
      .select({ id: gruposTrabalho.id })
      .from(gruposTrabalho)
      .where(inArray(gruposTrabalho.regionalId, regionaisIds))
      .all()
    gtsRegionais.forEach((item: any) => gtsAgenda.add(item.id))
  }

  const administracoesIds = Array.from(administracoesAgenda)
  if (administracoesIds.length > 0) {
    const itensSetor = await db
      .select({ id: setores.id, administracaoId: setores.administracaoId })
      .from(setores)
      .where(inArray(setores.administracaoId, administracoesIds))
      .all()
    itensSetor.forEach((item: any) => {
      setoresAgenda.add(item.id)
      if (administracoesDescendentesDeRegional.has(item.administracaoId)) {
        setoresDescendentesDeRegional.add(item.id)
      }
    })

    const administracoesRegionaisIds = Array.from(administracoesDescendentesDeRegional)
    if (administracoesRegionaisIds.length > 0) {
      const gtsAdministracao = await db
        .select({ id: gruposTrabalho.id })
        .from(gruposTrabalho)
        .where(inArray(gruposTrabalho.administracaoId, administracoesRegionaisIds))
        .all()
      gtsAdministracao.forEach((item: any) => gtsAgenda.add(item.id))
    }
  }

  const setoresIds = Array.from(setoresAgenda)
  if (setoresIds.length > 0) {
    const itensCasa = await db
      .select({ id: casas.id })
      .from(casas)
      .where(inArray(casas.setorId, setoresIds))
      .all()
    itensCasa.forEach((item: any) => casasAgenda.add(item.id))

    const setoresRegionaisIds = Array.from(setoresDescendentesDeRegional)
    if (setoresRegionaisIds.length > 0) {
      const gtsSetor = await db
        .select({ id: gruposTrabalho.id })
        .from(gruposTrabalho)
        .where(inArray(gruposTrabalho.setorId, setoresRegionaisIds))
        .all()
      gtsSetor.forEach((item: any) => gtsAgenda.add(item.id))
    }
  }

  resultado.regionaisIds = regionaisAgenda
  resultado.administracoesIds = administracoesAgenda
  resultado.setoresIds = setoresAgenda
  resultado.casasIds = casasAgenda
  resultado.gruposTrabalhoIds = gtsAgenda
  return resultado
}

function serieAutorizadaNoEscopo(serie: any, escopos: EscoposAgendaAutorizados): boolean {
  if (escopos.tudo) return true
  if (serie.regionalId && escopos.regionaisIds.has(serie.regionalId)) return true
  if (serie.administracaoId && escopos.administracoesIds.has(serie.administracaoId)) return true
  if (serie.setorId && escopos.setoresIds.has(serie.setorId)) return true
  if (serie.casaId && escopos.casasIds.has(serie.casaId)) return true
  if (serie.grupoTrabalhoId && escopos.gruposTrabalhoIds.has(serie.grupoTrabalhoId)) return true
  return false
}

async function podeGerenciarSerie(c: any, serie: any): Promise<boolean> {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const contexto = c.get('contextoPermissoes')
  if (!membroId) return false
  if (eMasterSistema(contexto)) return true

  const escopos = await carregarEscoposAgendaAutorizados(c)
  if (serieAutorizadaNoEscopo(serie, escopos)) return true

  // Autoria/organização não transformam a Casa inteira em área de gestão:
  // só o próprio autor/organizador, enquanto vinculado à mesma Casa, pode gerir.
  if (!serie.casaId) return false
  const criadorMembroId = await recuperarCriadorDaSerie(db, serie.id)
  if (criadorMembroId !== membroId && serie.organizadorMembroId !== membroId) return false

  const membro = await db
    .select({ casaId: membros.casaId, ativo: membros.ativo })
    .from(membros)
    .where(eq(membros.id, membroId))
    .get()
  return membro?.ativo === true && membro.casaId === serie.casaId
}

async function podeGerenciarEntidade(
  c: any,
  entidade: any,
  permitirCasaAutomatica = true
): Promise<boolean> {
  const db = c.get('db')
  const membroId = c.get('membroId')
  const escopo = extrairEscopoDoEvento(entidade)

  if (!membroId || !escopo.escopoTipo || !escopo.escopoId) return false

  return podeGerenciarAgendaNoEscopo(
    db,
    membroId,
    escopo.escopoTipo as 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO',
    escopo.escopoId,
    permitirCasaAutomatica
  )
}

function atorEhAutorOuOrganizador(
  membroId: string | null,
  criadorMembroId: string | null | undefined,
  organizadorMembroId: string | null | undefined
) {
  return !!membroId && (membroId === criadorMembroId || membroId === organizadorMembroId)
}

seriesRecorrenciaRouter.get('/', async (c) => {
  const db = c.get('db')
  const ativo = c.req.query('ativo')

  const conditions = []
  if (ativo !== undefined) {
    conditions.push(eq(seriesRecorrencia.ativo, ativo === 'true'))
  }

  const query = db.select().from(seriesRecorrencia)
  const data = conditions.length > 0 
    ? await query.where(and(...conditions)).all()
    : await query.all()

  const membroId = c.get('membroId')
  const contexto = c.get('contextoPermissoes')
  if (!membroId) return c.json([])

  const escopos = await carregarEscoposAgendaAutorizados(c)
  const membro = eMasterSistema(contexto) ? null : await db
    .select({ casaId: membros.casaId, ativo: membros.ativo })
    .from(membros)
    .where(eq(membros.id, membroId))
    .get()
  const criadores = await recuperarCriadoresDasSeries(db, data.map((serie: any) => serie.id))

  const autorizadas = data.filter((serie: any) => {
    if (escopos.tudo || serieAutorizadaNoEscopo(serie, escopos)) return true
    if (!serie.casaId || membro?.ativo !== true || membro.casaId !== serie.casaId) return false
    return atorEhAutorOuOrganizador(
      membroId,
      criadores.get(serie.id) ?? null,
      serie.organizadorMembroId
    )
  })
  return c.json(autorizadas)
})

seriesRecorrenciaRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const data = await db.select().from(seriesRecorrencia).where(eq(seriesRecorrencia.id, id)).get()
  
  if (!data) return c.json({ error: 'Série não encontrada' }, 404)
  if (!(await podeGerenciarSerie(c, data))) {
    return c.json({ error: 'Acesso não autorizado para gerir esta série', code: 'FORBIDDEN' }, 403)
  }
  return c.json(data)
})

seriesRecorrenciaRouter.post('/', async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const parsed = SerieCreate.parse(body)

    if (!(await espacoAtivoPertenceAoLocal(db, parsed.localId, parsed.espacoId))) {
      if (await espacoPertenceAoLocal(db, parsed.localId, parsed.espacoId)) {
        return c.json({ error: 'O espaço selecionado está inativo', code: 'ESPACO_INATIVO' }, 409)
      }
      return c.json({ error: 'O espaço selecionado não pertence ao Local informado', code: 'ESPACO_FORA_DO_LOCAL' }, 400)
    }
    
    if (!(await podeGerenciarEntidade(c, parsed))) {
      return c.json({ error: 'Acesso não autorizado para gerir a Agenda neste escopo', code: 'FORBIDDEN' }, 403)
    }

    const serieId = crypto.randomUUID()
    
    const nowIso = new Date().toISOString()
    const resultSerie = { id: serieId, ...parsed, createdAt: nowIso, updatedAt: nowIso }
    
    // Gerar ocorrências usando a recurrence-engine (Agnóstica de infra)
    const occurrencesDates = generateOccurrences(parsed)
    
    // Preparar payloads de evento
    const eventosToInsert = occurrencesDates.map(occ => {
      const { ...serieBaseData } = parsed
      return {
        id: crypto.randomUUID(),
        titulo: serieBaseData.titulo,
        descricao: serieBaseData.descricao,
        pauta: serieBaseData.pauta,
        modalidade: serieBaseData.modalidade,
        localId: serieBaseData.localId,
        espacoId: serieBaseData.espacoId,
        urlOnline: serieBaseData.urlOnline,
        criadorMembroId: c.get('membroId'),
        organizadorMembroId: serieBaseData.organizadorMembroId,
        regionalId: serieBaseData.regionalId,
        administracaoId: serieBaseData.administracaoId,
        setorId: serieBaseData.setorId,
        casaId: serieBaseData.casaId,
        grupoTrabalhoId: serieBaseData.grupoTrabalhoId,
        observacoes: serieBaseData.observacoes,
        ativo: serieBaseData.ativo ?? true,
        
        inicioEm: occ.inicioEm,
        fimEm: occ.fimEm,
        
        serieRecorrenciaId: serieId,
        recorrenciaOrigemInicioEm: occ.inicioEm,
        recorrenciaExcecao: false,
        createdAt: nowIso,
        updatedAt: nowIso
      }
    })

    // Transação usando executeAtomic para atomicidade nativa Cloudflare/SQLite
    await executeAtomic(db, (qdb) => {
      const queries = []
      queries.push(qdb.insert(seriesRecorrencia).values(resultSerie))
      if (eventosToInsert.length > 0) {
        queries.push(qdb.insert(eventos).values(eventosToInsert))
      }
      const escopo = extrairEscopoDoEvento(resultSerie)
      queries.push(criarAuditQuery(qdb, {
        acao: 'SERIE_RECORRENCIA_CRIADA',
        atorMembroId: c.get('membroId') || null,
        recursoTipo: 'SERIE_RECORRENCIA',
        recursoId: serieId,
        escopoTipo: escopo.escopoTipo,
        escopoId: escopo.escopoId,
        contexto: { titulo: resultSerie.titulo, ocorrenciasGeradas: eventosToInsert.length },
      }))
      return queries
    })

    return c.json({ serie: resultSerie, generatedOccurrences: eventosToInsert.length }, 201)
  } catch (err: any) {
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Local, Espaço ou Escopo vinculado não existe' }, 400)
    }
    if (err.message && err.message.includes('CHECK constraint failed')) {
      return c.json({ error: 'Violação de regra de negócio no banco' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})

seriesRecorrenciaRouter.patch('/:id', async (c) => {
  const db = c.get('db')
  const serieId = c.req.param('id')
  
  try {
    const body = await c.req.json()
    const parsed = SerieUpdatePayload.parse(body)
    
    const existingSerie = await db.select().from(seriesRecorrencia).where(eq(seriesRecorrencia.id, serieId)).get()
    if (!existingSerie) return c.json({ error: 'Série não encontrada' }, 404)
    if (!(await podeGerenciarSerie(c, existingSerie))) {
      return c.json({ error: 'Acesso não autorizado para gerir esta série', code: 'FORBIDDEN' }, 403)
    }
    
    const nowIso = new Date().toISOString()
    
    if (parsed.updateMode === 'THIS') {
      if (!parsed.fromEventId) return c.json({ error: 'fromEventId obrigatório' }, 400)
      
      const existingEvent = await db.select().from(eventos).where(eq(eventos.id, parsed.fromEventId)).get()
      if (!existingEvent || existingEvent.serieRecorrenciaId !== serieId) {
         return c.json({ error: 'Evento origem não encontrado ou não pertence a esta série' }, 400)
      }

      if (new Date(existingEvent.fimEm).getTime() <= Date.now()) {
        return c.json({
          error: 'Ocorrências já encerradas não podem ser alteradas. O registro deve preservar o que efetivamente ocorreu.',
          code: 'EVENTO_PASSADO_IMUTAVEL'
        }, 409)
      }
      
      if (!(await podeGerenciarEvento(db, c.get('membroId'), existingEvent))) {
        return c.json({ error: 'Acesso não autorizado para gerir este evento', code: 'FORBIDDEN' }, 403)
      }

      const mergedEvent = { ...existingEvent, ...parsed.changes }
      EventoCreate.parse(mergedEvent) // Valida regras S04
      const alteracaoMaterial = houveAlteracaoMaterialOcorrencia(existingEvent, mergedEvent)
      const agendaAviso = alteracaoMaterial
        ? await criarAvisoAlteracaoOcorrencia(db, existingEvent, mergedEvent)
        : existingEvent.agendaAviso
      const espacoFoiAlterado = parsed.changes.espacoId !== undefined && parsed.changes.espacoId !== existingEvent.espacoId
      const espacoValido = espacoFoiAlterado
        ? await espacoAtivoPertenceAoLocal(db, mergedEvent.localId, mergedEvent.espacoId)
        : await espacoPertenceAoLocal(db, mergedEvent.localId, mergedEvent.espacoId)
      if (!espacoValido) {
        if (espacoFoiAlterado && await espacoPertenceAoLocal(db, mergedEvent.localId, mergedEvent.espacoId)) {
          return c.json({ error: 'O espaço selecionado está inativo', code: 'ESPACO_INATIVO' }, 409)
        }
        return c.json({ error: 'O espaço selecionado não pertence ao Local informado', code: 'ESPACO_FORA_DO_LOCAL' }, 400)
      }
      const permitirCasaAutomaticaDestino = atorEhAutorOuOrganizador(
        c.get('membroId'),
        existingEvent.criadorMembroId,
        existingEvent.organizadorMembroId
      )
      if (!(await podeGerenciarEntidade(c, mergedEvent, permitirCasaAutomaticaDestino))) {
        return c.json({ error: 'Acesso não autorizado para mover o evento para este escopo', code: 'FORBIDDEN' }, 403)
      }
      
      const escopo = extrairEscopoDoEvento(existingEvent)
      await executarOperacaoComAudit(
        db,
        (qdb) => [
          qdb.update(eventos)
            .set({
              ...parsed.changes,
              recorrenciaOrigemInicioEm:
                existingEvent.recorrenciaOrigemInicioEm ?? existingEvent.inicioEm,
              recorrenciaExcecao: true,
              agendaRevisao: alteracaoMaterial ? nowIso : existingEvent.agendaRevisao,
              agendaAviso,
              updatedAt: nowIso,
            })
            .where(eq(eventos.id, parsed.fromEventId))
        ],
        {
          acao: 'SERIE_OCORRENCIA_ATUALIZADA',
          atorMembroId: c.get('membroId') || null,
          recursoTipo: 'EVENTO',
          recursoId: parsed.fromEventId,
          escopoTipo: escopo.escopoTipo,
          escopoId: escopo.escopoId,
          contexto: {
            serieRecorrenciaId: serieId,
            camposAlterados: Object.keys(parsed.changes),
            alteracaoMaterial,
            reconfirmacaoSolicitada: alteracaoMaterial,
            agendaAviso: alteracaoMaterial ? agendaAviso : null,
          },
        }
      )
      const updatedEvent = await db.select().from(eventos).where(eq(eventos.id, parsed.fromEventId)).get()
      return c.json({ message: 'Evento atualizado individualmente', event: updatedEvent })
    }
    
    if (parsed.updateMode === 'ALL') {
      const mergedSerieData = { ...existingSerie, ...parsed.changes }
      const apenasDesativacao =
        parsed.changes.ativo === false &&
        Object.keys(parsed.changes).every((chave) => chave === 'ativo')

      if (!apenasDesativacao) {
        SerieCreate.parse(mergedSerieData)
        if (!(await espacoAtivoPertenceAoLocal(db, mergedSerieData.localId, mergedSerieData.espacoId))) {
          if (await espacoPertenceAoLocal(db, mergedSerieData.localId, mergedSerieData.espacoId)) {
            return c.json({ error: 'O espaço selecionado está inativo', code: 'ESPACO_INATIVO' }, 409)
          }
          return c.json({ error: 'O espaço selecionado não pertence ao Local informado', code: 'ESPACO_FORA_DO_LOCAL' }, 400)
        }
        const criadorOriginal = await recuperarCriadorDaSerie(db, existingSerie.id)
        const permitirCasaAutomaticaDestino = atorEhAutorOuOrganizador(
          c.get('membroId'),
          criadorOriginal,
          existingSerie.organizadorMembroId
        )
        if (!(await podeGerenciarEntidade(c, mergedSerieData, permitirCasaAutomaticaDestino))) {
          return c.json({ error: 'Acesso não autorizado para mover a série para este escopo', code: 'FORBIDDEN' }, 403)
        }
      }

      if (
        !apenasDesativacao &&
        apenasAlteracaoOperacionalSerie(parsed.changes as Record<string, unknown>)
      ) {
        const agendaAviso = await criarAvisoAlteracaoOperacionalSerie(db, existingSerie, mergedSerieData)
        const alteracoesEvento: Record<string, unknown> = {}
        for (const campo of CAMPOS_OPERACIONAIS_SERIE) {
          if (Object.prototype.hasOwnProperty.call(parsed.changes, campo)) {
            alteracoesEvento[campo] = (parsed.changes as any)[campo]
          }
        }

        await executeAtomic(db, (qdb) => {
          const escopo = extrairEscopoDoEvento(existingSerie)
          return [
            qdb.update(seriesRecorrencia)
              .set({ ...parsed.changes, updatedAt: nowIso })
              .where(eq(seriesRecorrencia.id, serieId)),
            qdb.update(eventos)
              .set({
                ...alteracoesEvento,
                agendaRevisao: agendaAviso ? nowIso : eventos.agendaRevisao,
                agendaAviso: agendaAviso ?? eventos.agendaAviso,
                updatedAt: nowIso,
              })
              .where(and(
                eq(eventos.serieRecorrenciaId, serieId),
                gte(eventos.inicioEm, nowIso),
                eq(eventos.recorrenciaExcecao, false),
                eq(eventos.ativo, true)
              )),
            criarAuditQuery(qdb, {
              acao: 'SERIE_RECORRENCIA_ATUALIZADA',
              atorMembroId: c.get('membroId') || null,
              recursoTipo: 'SERIE_RECORRENCIA',
              recursoId: serieId,
              escopoTipo: escopo.escopoTipo,
              escopoId: escopo.escopoId,
              contexto: {
                updateMode: 'ALL',
                camposAlterados: Object.keys(parsed.changes),
                semRegeneracao: true,
                reconfirmacaoSolicitada: Boolean(agendaAviso),
                agendaAviso,
              },
            })
          ]
        })

        return c.json({
          message: agendaAviso
            ? 'Série atualizada sem regenerar ocorrências; reconfirmação solicitada.'
            : 'Série atualizada sem regenerar ocorrências.',
          reconfirmacaoSolicitada: Boolean(agendaAviso),
        })
      }

      if (parsed.changes.ativo === false) {
        await executeAtomic(db, (qdb) => {
          return [
            qdb.update(seriesRecorrencia)
              .set({ ...parsed.changes, ativo: false, updatedAt: nowIso })
              .where(eq(seriesRecorrencia.id, serieId)),
            qdb.update(eventos)
              .set({ ativo: false, updatedAt: nowIso })
              .where(and(
                eq(eventos.serieRecorrenciaId, serieId),
                gte(eventos.inicioEm, nowIso)
              )),
            criarAuditQuery(qdb, {
              acao: 'SERIE_RECORRENCIA_ATUALIZADA',
              atorMembroId: c.get('membroId') || null,
              recursoTipo: 'SERIE_RECORRENCIA',
              recursoId: serieId,
              ...(() => {
                const escopo = extrairEscopoDoEvento(existingSerie)
                return { escopoTipo: escopo.escopoTipo, escopoId: escopo.escopoId }
              })(),
              contexto: { updateMode: 'ALL', camposAlterados: Object.keys(parsed.changes) },
            })
          ]
        })
        return c.json({ message: 'Série atualizada e eventos futuros inativados com sucesso' })
      }

      const exceptions = await db.select().from(eventos).where(and(
        eq(eventos.serieRecorrenciaId, serieId),
        gte(
          sql`COALESCE(${eventos.recorrenciaOrigemInicioEm}, ${eventos.inicioEm})`,
          nowIso
        ),
        eq(eventos.recorrenciaExcecao, true)
      )).all()
      const exceptionDates = new Set(
        exceptions.map((e: any) =>
          getLocalDateFromUtc(e.recorrenciaOrigemInicioEm ?? e.inicioEm)
        )
      )
      
      const occurrencesDates = generateOccurrences(mergedSerieData)
      const futureOccurrences = occurrencesDates
        .filter(occ => occ.inicioEm >= nowIso)
        .filter(occ => !exceptionDates.has(getLocalDateFromUtc(occ.inicioEm)))
        
      const criadorMembroId = await recuperarCriadorDaSerie(db, serieId)

      const eventosToInsert = futureOccurrences.map(occ => {
        const { ...serieBaseData } = mergedSerieData
        return {
          id: crypto.randomUUID(),
          titulo: serieBaseData.titulo,
          descricao: serieBaseData.descricao,
          pauta: serieBaseData.pauta,
          modalidade: serieBaseData.modalidade,
          localId: serieBaseData.localId,
          espacoId: serieBaseData.espacoId,
          urlOnline: serieBaseData.urlOnline,
          criadorMembroId,
          organizadorMembroId: serieBaseData.organizadorMembroId,
          regionalId: serieBaseData.regionalId,
          administracaoId: serieBaseData.administracaoId,
          setorId: serieBaseData.setorId,
          casaId: serieBaseData.casaId,
          grupoTrabalhoId: serieBaseData.grupoTrabalhoId,
          observacoes: serieBaseData.observacoes,
          ativo: serieBaseData.ativo ?? true,
          
          inicioEm: occ.inicioEm,
          fimEm: occ.fimEm,
          
          serieRecorrenciaId: serieId,
          recorrenciaOrigemInicioEm: occ.inicioEm,
          recorrenciaExcecao: false,
          createdAt: nowIso,
          updatedAt: nowIso
        }
      })
      
      await executeAtomic(db, (qdb) => {
        const queries = []
        queries.push(
          qdb.update(seriesRecorrencia)
            .set({ ...parsed.changes, updatedAt: nowIso })
            .where(eq(seriesRecorrencia.id, serieId))
        )
        
        // Em vez de delete, marcar ativo=false nas ocorrências substituídas
        queries.push(
          qdb.update(eventos)
            .set({ ativo: false, updatedAt: nowIso })
            .where(and(
              eq(eventos.serieRecorrenciaId, serieId),
              gte(eventos.inicioEm, nowIso),
              eq(eventos.recorrenciaExcecao, false),
              eq(eventos.ativo, true) // Não precisa inativar o que já está inativo
            ))
        )
        
        if (eventosToInsert.length > 0) {
          queries.push(qdb.insert(eventos).values(eventosToInsert))
        }
        const escopo = extrairEscopoDoEvento(existingSerie)
        queries.push(criarAuditQuery(qdb, {
          acao: 'SERIE_RECORRENCIA_ATUALIZADA',
          atorMembroId: c.get('membroId') || null,
          recursoTipo: 'SERIE_RECORRENCIA',
          recursoId: serieId,
          escopoTipo: escopo.escopoTipo,
          escopoId: escopo.escopoId,
          contexto: { updateMode: 'ALL', camposAlterados: Object.keys(parsed.changes) },
        }))
        return queries
      })
      
      return c.json({ message: 'Série inteira e futuros eventos atualizados com sucesso' })
    }
    
    if (parsed.updateMode === 'THIS_AND_FUTURE') {
      if (!parsed.fromEventId) return c.json({ error: 'fromEventId obrigatório' }, 400)
      
      const existingEvent = await db.select().from(eventos).where(eq(eventos.id, parsed.fromEventId)).get()
      if (!existingEvent || existingEvent.serieRecorrenciaId !== serieId) {
         return c.json({ error: 'Evento origem não encontrado ou não pertence a esta série' }, 400)
      }

      if (new Date(existingEvent.fimEm).getTime() <= Date.now()) {
        return c.json({
          error: 'Ocorrências já encerradas não podem servir de início para alterar esta e as futuras.',
          code: 'EVENTO_PASSADO_IMUTAVEL'
        }, 409)
      }
      
      if (!(await podeGerenciarEvento(db, c.get('membroId'), existingEvent))) {
        return c.json({ error: 'Acesso não autorizado para gerir este evento', code: 'FORBIDDEN' }, 403)
      }

      const pivotDateIso = existingEvent.recorrenciaOrigemInicioEm ?? existingEvent.inicioEm

      const newSerieId = crypto.randomUUID()
      
      // Cálculo correto com timezone
      const newStartDateStr = getLocalDateFromUtc(pivotDateIso)
      
      const alteracaoApenasOperacional = apenasAlteracaoOperacionalSerie(parsed.changes as Record<string, unknown>)
      const serieBData = alteracaoApenasOperacional
        ? {
            ...SerieCreate.parse({
              ...existingSerie,
              ...parsed.changes,
              dataInicio: newStartDateStr,
              // Valida o restante do contrato atual sem rejeitar série legada.
              intervalo: 1,
            }),
            // Alteração operacional não muda a cadência histórica armazenada.
            intervalo: existingSerie.intervalo,
          }
        : SerieCreate.parse({
            ...existingSerie,
            ...parsed.changes,
            dataInicio: newStartDateStr
          })
      if (!(await espacoAtivoPertenceAoLocal(db, serieBData.localId, serieBData.espacoId))) {
        if (await espacoPertenceAoLocal(db, serieBData.localId, serieBData.espacoId)) {
          return c.json({ error: 'O espaço selecionado está inativo', code: 'ESPACO_INATIVO' }, 409)
        }
        return c.json({ error: 'O espaço selecionado não pertence ao Local informado', code: 'ESPACO_FORA_DO_LOCAL' }, 400)
      }
      const criadorOriginal = await recuperarCriadorDaSerie(db, existingSerie.id)
      const permitirCasaAutomaticaDestino = atorEhAutorOuOrganizador(
        c.get('membroId'),
        criadorOriginal,
        existingSerie.organizadorMembroId
      )
      if (!(await podeGerenciarEntidade(c, serieBData, permitirCasaAutomaticaDestino))) {
        return c.json({ error: 'Acesso não autorizado para mover a série para este escopo', code: 'FORBIDDEN' }, 403)
      }
      if (alteracaoApenasOperacional) {
        const agendaAviso = await criarAvisoAlteracaoOperacionalSerie(db, existingSerie, serieBData)

        if (!agendaAviso) {
          return c.json({
            message: 'Nenhuma alteração operacional efetiva foi detectada',
            novaSerieId: null,
            reconfirmacaoSolicitada: false,
          })
        }

        const splitNaPrimeiraOcorrencia = newStartDateStr <= existingSerie.dataInicio
        const pivotDate = new Date(`${newStartDateStr}T12:00:00Z`)
        pivotDate.setTime(pivotDate.getTime() - (1000 * 60 * 60 * 24))
        const oldEndDateStr = pivotDate.toISOString().split('T')[0]

        await executeAtomic(db, (qdb) => {
          const queries = []

          queries.push(
            qdb.update(seriesRecorrencia)
              .set(
                splitNaPrimeiraOcorrencia
                  ? { ativo: false, updatedAt: nowIso }
                  : { dataFim: oldEndDateStr, updatedAt: nowIso }
              )
              .where(eq(seriesRecorrencia.id, serieId))
          )

          queries.push(
            qdb.insert(seriesRecorrencia).values({
              id: newSerieId,
              ...serieBData,
              createdAt: nowIso,
              updatedAt: nowIso,
            })
          )

          // Exceções futuras continuam como exceções e são apenas movidas para a nova fatia.
          queries.push(
            qdb.update(eventos)
              .set({ serieRecorrenciaId: newSerieId, updatedAt: nowIso })
              .where(and(
                eq(eventos.serieRecorrenciaId, serieId),
                gte(
                  sql`COALESCE(${eventos.recorrenciaOrigemInicioEm}, ${eventos.inicioEm})`,
                  pivotDateIso
                ),
                eq(eventos.recorrenciaExcecao, true)
              ))
          )

          // Ocorrências normais são atualizadas no lugar: IDs e convocações permanecem.
          queries.push(
            qdb.update(eventos)
              .set({
                modalidade: serieBData.modalidade,
                localId: serieBData.localId,
                espacoId: serieBData.espacoId,
                urlOnline: serieBData.urlOnline,
                serieRecorrenciaId: newSerieId,
                agendaRevisao: nowIso,
                agendaAviso,
                updatedAt: nowIso,
              })
              .where(and(
                eq(eventos.serieRecorrenciaId, serieId),
                gte(
                  sql`COALESCE(${eventos.recorrenciaOrigemInicioEm}, ${eventos.inicioEm})`,
                  pivotDateIso
                ),
                eq(eventos.recorrenciaExcecao, false),
                eq(eventos.ativo, true)
              ))
          )

          // Se o pivô for exceção, aplicar a mudança material também nele.
          if (existingEvent.recorrenciaExcecao) {
            queries.push(
              qdb.update(eventos)
                .set({
                  modalidade: serieBData.modalidade,
                  localId: serieBData.localId,
                  espacoId: serieBData.espacoId,
                  urlOnline: serieBData.urlOnline,
                  agendaRevisao: nowIso,
                  agendaAviso,
                  updatedAt: nowIso,
                })
                .where(eq(eventos.id, existingEvent.id))
            )
          }

          const escopo = extrairEscopoDoEvento(existingSerie)
          queries.push(criarAuditQuery(qdb, {
            acao: 'SERIE_RECORRENCIA_DIVIDIDA',
            atorMembroId: c.get('membroId') || null,
            recursoTipo: 'SERIE_RECORRENCIA',
            recursoId: serieId,
            escopoTipo: escopo.escopoTipo,
            escopoId: escopo.escopoId,
            contexto: {
              updateMode: 'THIS_AND_FUTURE',
              novaSerieId: newSerieId,
              fromEventId: parsed.fromEventId,
              semRegeneracao: true,
              reconfirmacaoSolicitada: Boolean(agendaAviso),
              agendaAviso,
            },
          }))
          return queries
        })

        return c.json({
          message: 'Este e os próximos eventos atualizados sem regeneração',
          novaSerieId: newSerieId,
          reconfirmacaoSolicitada: Boolean(agendaAviso),
        })
      }


      // Série A (Antiga) termina no dia anterior a novaStartDateStr
      // Para saber isso facilmente no mesmo timezone de SP: 
      // Em Javascript local é perigoso por causa de fusos da máquina.
      // Porém getLocalDateFromUtc pega exatamente o "hoje" em SP e podemos subtrair os dias
      // convertendo Date UTC + Math. Uma forma segura é simplesmente:
      const msPerDay = 1000 * 60 * 60 * 24
      // Pegamos o meio do dia em UTC equivalente ao início da data de hoje, 
      // garantindo que não vamos cair no dia errado.
      const pivotDate = new Date(`${newStartDateStr}T12:00:00Z`)
      pivotDate.setTime(pivotDate.getTime() - msPerDay)
      const oldEndDateStr = pivotDate.toISOString().split('T')[0]
      
      const exceptions = await db.select().from(eventos).where(and(
        eq(eventos.serieRecorrenciaId, serieId),
        gte(
          sql`COALESCE(${eventos.recorrenciaOrigemInicioEm}, ${eventos.inicioEm})`,
          pivotDateIso
        ),
        eq(eventos.recorrenciaExcecao, true)
      )).all()
      const exceptionDates = new Set(
        exceptions.map((e: any) =>
          getLocalDateFromUtc(e.recorrenciaOrigemInicioEm ?? e.inicioEm)
        )
      )
      
      const criadorMembroId = await recuperarCriadorDaSerie(db, serieId)
      const occurrencesDates = generateOccurrences(serieBData)
      const eventosToInsert = occurrencesDates
        .filter(occ => !exceptionDates.has(getLocalDateFromUtc(occ.inicioEm)))
        .map(occ => {
          const { ...serieBaseData } = serieBData
          return {
            id: crypto.randomUUID(),
            titulo: serieBaseData.titulo,
            descricao: serieBaseData.descricao,
            pauta: serieBaseData.pauta,
            modalidade: serieBaseData.modalidade,
            localId: serieBaseData.localId,
            espacoId: serieBaseData.espacoId,
            urlOnline: serieBaseData.urlOnline,
            criadorMembroId,
          organizadorMembroId: serieBaseData.organizadorMembroId,
            regionalId: serieBaseData.regionalId,
            administracaoId: serieBaseData.administracaoId,
            setorId: serieBaseData.setorId,
            casaId: serieBaseData.casaId,
            grupoTrabalhoId: serieBaseData.grupoTrabalhoId,
            observacoes: serieBaseData.observacoes,
            ativo: serieBaseData.ativo ?? true,
            
            inicioEm: occ.inicioEm,
            fimEm: occ.fimEm,
            
            serieRecorrenciaId: newSerieId,
            recorrenciaOrigemInicioEm: occ.inicioEm,
            recorrenciaExcecao: false,
            createdAt: nowIso,
            updatedAt: nowIso
          }
        })
      
      await executeAtomic(db, (qdb) => {
        const queries = []
        // 1. Atualizar Série A. Se o pivô for a primeira ocorrência,
        // não persistir dataFim anterior a dataInicio: a série antiga fica inativa.
        const splitNaPrimeiraOcorrencia = newStartDateStr <= existingSerie.dataInicio
        queries.push(
          qdb.update(seriesRecorrencia)
            .set(
              splitNaPrimeiraOcorrencia
                ? { ativo: false, updatedAt: nowIso }
                : { dataFim: oldEndDateStr, updatedAt: nowIso }
            )
            .where(eq(seriesRecorrencia.id, serieId))
        )
          
        // 2. Criar Série B
        const resultSerieB = { id: newSerieId, ...serieBData, createdAt: nowIso, updatedAt: nowIso }
        queries.push(qdb.insert(seriesRecorrencia).values(resultSerieB))
        
        // 3. Atualizar as EXCEÇÕES futuras (e a própria pivot se for exceção) para apontar para a Série B
        // As ocorrências normais serão inativadas e recriadas.
        // Assim respeitamos a regra de que as ocorrências velhas (não exceção) devem ser inativadas sem DELETE.
        
        queries.push(
          qdb.update(eventos)
            .set({ serieRecorrenciaId: newSerieId, updatedAt: nowIso })
            .where(and(
              eq(eventos.serieRecorrenciaId, serieId),
              gte(
                sql`COALESCE(${eventos.recorrenciaOrigemInicioEm}, ${eventos.inicioEm})`,
                pivotDateIso
              ),
              eq(eventos.recorrenciaExcecao, true)
            ))
        )
        
        // 4. Inativar ocorrências normais da Série A a partir do pivot
        queries.push(
          qdb.update(eventos)
            .set({ ativo: false, updatedAt: nowIso })
            .where(and(
              eq(eventos.serieRecorrenciaId, serieId),
              gte(eventos.inicioEm, pivotDateIso),
              eq(eventos.recorrenciaExcecao, false),
              eq(eventos.ativo, true)
            ))
        )
          
        // 5. Inserir eventos gerados
        if (eventosToInsert.length > 0) {
          queries.push(qdb.insert(eventos).values(eventosToInsert))
        }
        const escopo = extrairEscopoDoEvento(existingSerie)
        queries.push(criarAuditQuery(qdb, {
          acao: 'SERIE_RECORRENCIA_DIVIDIDA',
          atorMembroId: c.get('membroId') || null,
          recursoTipo: 'SERIE_RECORRENCIA',
          recursoId: serieId,
          escopoTipo: escopo.escopoTipo,
          escopoId: escopo.escopoId,
          contexto: { updateMode: 'THIS_AND_FUTURE', novaSerieId: newSerieId, fromEventId: parsed.fromEventId },
        }))
        return queries
      })
      
      return c.json({ message: 'Série dividida e eventos atualizados', novaSerieId: newSerieId })
    }

  } catch (err: any) {
    if (err.message && err.message.includes('EVENTO_COM_CONVOCACAO_ATIVA')) {
      return c.json(
        {
          error:
            'A série possui ocorrência futura com convocação vinculada. Altere a ocorrência individualmente ou trate a convocação antes de regenerar a série.',
          code: 'SERIE_COM_CONVOCACAO',
        },
        409
      )
    }
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
      return c.json({ error: 'Local, Espaço ou Escopo vinculado não existe' }, 400)
    }
    if (err.message && err.message.includes('CHECK constraint failed')) {
      return c.json({ error: 'Violação de regra de negócio no banco (ex: escopo único)' }, 400)
    }
    return c.json({ error: err.issues || err.message }, 400)
  }
})
