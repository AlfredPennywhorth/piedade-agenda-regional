import { eq, and, inArray, or } from 'drizzle-orm'
import * as schema from '../db/schema'

export interface ContextoPermissoes {
  membroId: string
  vinculosAtivos: {
    funcaoId: string
    regionalId: string | null
    administracaoId: string | null
    setorId: string | null
    casaId: string | null
    grupoTrabalhoId: string | null
  }[]
}

export async function carregarContextoPermissoes(db: any, membroId: string): Promise<ContextoPermissoes> {
  const vinculos = await db
    .select({
      funcaoId: schema.vinculosFuncionais.funcaoId,
      regionalId: schema.vinculosFuncionais.regionalId,
      administracaoId: schema.vinculosFuncionais.administracaoId,
      setorId: schema.vinculosFuncionais.setorId,
      casaId: schema.vinculosFuncionais.casaId,
      grupoTrabalhoId: schema.vinculosFuncionais.grupoTrabalhoId,
    })
    .from(schema.vinculosFuncionais)
    .where(
      and(
        eq(schema.vinculosFuncionais.membroId, membroId),
        eq(schema.vinculosFuncionais.ativo, true)
      )
    )

  return {
    membroId,
    vinculosAtivos: vinculos,
  }
}

// Fundação (S03): funções auxiliares para verificar permissões futuras.

export function temFuncao(contexto: ContextoPermissoes, funcaoId: string): boolean {
  return contexto.vinculosAtivos.some((v) => v.funcaoId === funcaoId)
}

export function temFuncaoNoEscopoRegional(contexto: ContextoPermissoes, funcaoId: string, regionalId: string): boolean {
  return contexto.vinculosAtivos.some(
    (v) => v.funcaoId === funcaoId && v.regionalId === regionalId
  )
}

export function temVinculoEmTipoEscopo(contexto: ContextoPermissoes, tipo: 'regional' | 'administracao' | 'setor' | 'casa' | 'gt'): boolean {
  return contexto.vinculosAtivos.some((v) => {
    switch (tipo) {
      case 'regional': return v.regionalId !== null
      case 'administracao': return v.administracaoId !== null
      case 'setor': return v.setorId !== null
      case 'casa': return v.casaId !== null
      case 'gt': return v.grupoTrabalhoId !== null
    }
    return false
  })
}

/**
 * Valida se o membro possui vínculo ativo estritamente com a função de código OPERADOR_PORTARIA no mesmo escopo do evento.
 */
export async function eOperadorPortariaAutorizado(db: any, membroId: string, evento: any): Promise<boolean> {
  if (!db || !membroId || !evento) return false

  const vinculosPortaria = await db
    .select({
      v: schema.vinculosFuncionais,
      f: schema.funcoes
    })
    .from(schema.vinculosFuncionais)
    .innerJoin(schema.funcoes, eq(schema.vinculosFuncionais.funcaoId, schema.funcoes.id))
    .where(
      and(
        eq(schema.vinculosFuncionais.membroId, membroId),
        eq(schema.vinculosFuncionais.ativo, true),
        eq(schema.funcoes.ativo, true),
        eq(schema.funcoes.codigo, 'OPERADOR_PORTARIA')
      )
    )
    .all()

  if (!vinculosPortaria || vinculosPortaria.length === 0) {
    return false
  }

  return vinculosPortaria.some(({ v }: any) => {
    if (evento.regionalId && v.regionalId === evento.regionalId) return true
    if (evento.administracaoId && v.administracaoId === evento.administracaoId) return true
    if (evento.setorId && v.setorId === evento.setorId) return true
    if (evento.casaId && v.casaId === evento.casaId) return true
    if (evento.grupoTrabalhoId && v.grupoTrabalhoId === evento.grupoTrabalhoId) return true
    return false
  })
}

/**
 * Valida se o membro possui permissão de relatórios para um evento específico.
 * Autorizado se:
 * 1. É o organizador do evento (evento.organizadorMembroId === membroId); OU
 * 2. Possui vínculo ativo com a função GESTOR_RELATORIOS no exato escopo do evento.
 */
export async function eGestorRelatoriosAutorizadoParaEvento(db: any, membroId: string, evento: any): Promise<boolean> {
  if (!db || !membroId || !evento) return false

  // 1. Organizador do evento
  if (evento.organizadorMembroId === membroId) {
    return true
  }

  // 2. Vínculo GESTOR_RELATORIOS no mesmo escopo
  const vinculosGestor = await db
    .select({
      v: schema.vinculosFuncionais,
      f: schema.funcoes
    })
    .from(schema.vinculosFuncionais)
    .innerJoin(schema.funcoes, eq(schema.vinculosFuncionais.funcaoId, schema.funcoes.id))
    .where(
      and(
        eq(schema.vinculosFuncionais.membroId, membroId),
        eq(schema.vinculosFuncionais.ativo, true),
        eq(schema.funcoes.ativo, true),
        eq(schema.funcoes.codigo, 'GESTOR_RELATORIOS')
      )
    )
    .all()

  if (!vinculosGestor || vinculosGestor.length === 0) {
    return false
  }

  return vinculosGestor.some(({ v }: any) => {
    if (evento.regionalId && v.regionalId === evento.regionalId) return true
    if (evento.administracaoId && v.administracaoId === evento.administracaoId) return true
    if (evento.setorId && v.setorId === evento.setorId) return true
    if (evento.casaId && v.casaId === evento.casaId) return true
    if (evento.grupoTrabalhoId && v.grupoTrabalhoId === evento.grupoTrabalhoId) return true
    return false
  })
}

/**
 * Valida se o membro possui permissão GESTOR_RELATORIOS em um escopo específico (tipo + id).
 */
export async function eGestorRelatoriosAutorizadoParaEscopo(
  db: any,
  membroId: string,
  escopoTipo: 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO',
  escopoId: string
): Promise<boolean> {
  if (!db || !membroId || !escopoTipo || !escopoId) return false

  const vinculosGestor = await db
    .select({
      v: schema.vinculosFuncionais,
      f: schema.funcoes
    })
    .from(schema.vinculosFuncionais)
    .innerJoin(schema.funcoes, eq(schema.vinculosFuncionais.funcaoId, schema.funcoes.id))
    .where(
      and(
        eq(schema.vinculosFuncionais.membroId, membroId),
        eq(schema.vinculosFuncionais.ativo, true),
        eq(schema.funcoes.ativo, true),
        eq(schema.funcoes.codigo, 'GESTOR_RELATORIOS')
      )
    )
    .all()

  if (!vinculosGestor || vinculosGestor.length === 0) {
    return false
  }

  return vinculosGestor.some(({ v }: any) => {
    switch (escopoTipo) {
      case 'REGIONAL': return v.regionalId === escopoId
      case 'ADMINISTRACAO': return v.administracaoId === escopoId
      case 'SETOR': return v.setorId === escopoId
      case 'CASA': return v.casaId === escopoId
      case 'GRUPO_TRABALHO': return v.grupoTrabalhoId === escopoId
      default: return false
    }
  })
}

/**
 * Valida se o membro possui vínculo ativo estritamente com a função AUDITOR_SISTEMA em escopo REGIONAL ou ADMINISTRACAO.
 */
export async function eAuditorSistemaAutorizado(db: any, membroId: string): Promise<boolean> {
  if (!db || !membroId) return false

  const vinculosAuditor = await db
    .select({
      v: schema.vinculosFuncionais,
      f: schema.funcoes
    })
    .from(schema.vinculosFuncionais)
    .innerJoin(schema.funcoes, eq(schema.vinculosFuncionais.funcaoId, schema.funcoes.id))
    .where(
      and(
        eq(schema.vinculosFuncionais.membroId, membroId),
        eq(schema.vinculosFuncionais.ativo, true),
        eq(schema.funcoes.ativo, true),
        eq(schema.funcoes.codigo, 'AUDITOR_SISTEMA')
      )
    )
    .all()

  if (!vinculosAuditor || vinculosAuditor.length === 0) {
    return false
  }

  // Válido apenas em escopo REGIONAL ou ADMINISTRACAO
  return vinculosAuditor.some(({ v }: any) => v.regionalId !== null || v.administracaoId !== null)
}

export interface CapacidadesMembro {
  podeVisualizarRelatorios: boolean
  podeVisualizarAuditoria: boolean
  podeOperarPortaria: boolean
}

export async function obterCapacidadesMembro(db: any, membroId: string): Promise<CapacidadesMembro> {
  if (!db || !membroId) {
    return {
      podeVisualizarRelatorios: false,
      podeVisualizarAuditoria: false,
      podeOperarPortaria: false
    }
  }

  const vinculos = await db
    .select({
      codigo: schema.funcoes.codigo
    })
    .from(schema.vinculosFuncionais)
    .innerJoin(schema.funcoes, eq(schema.vinculosFuncionais.funcaoId, schema.funcoes.id))
    .where(
      and(
        eq(schema.vinculosFuncionais.membroId, membroId),
        eq(schema.vinculosFuncionais.ativo, true),
        eq(schema.funcoes.ativo, true)
      )
    )
    .all()

  const codigos = new Set(vinculos.map((v: any) => v.codigo))

  const eventoOrganizado = await db
    .select({ id: schema.eventos.id })
    .from(schema.eventos)
    .where(and(eq(schema.eventos.organizadorMembroId, membroId), eq(schema.eventos.ativo, true)))
    .get()

  const podeVisualizarRelatorios = codigos.has('GESTOR_RELATORIOS') || !!eventoOrganizado
  const podeVisualizarAuditoria = await eAuditorSistemaAutorizado(db, membroId)
  const podeOperarPortaria = codigos.has('OPERADOR_PORTARIA')

  return {
    podeVisualizarRelatorios,
    podeVisualizarAuditoria,
    podeOperarPortaria
  }
}

export interface EscoposAutorizadosAuditor {
  regionaisIds: string[]
  administracoesIds: string[]
  setoresIds: string[]
  casasIds: string[]
  gtsIds: string[]
}

export async function obterEscoposAutorizadosDoAuditor(db: any, membroId: string): Promise<EscoposAutorizadosAuditor | null> {
  if (!db || !membroId) return null

  const vinculosAuditor = await db
    .select({
      v: schema.vinculosFuncionais,
      f: schema.funcoes
    })
    .from(schema.vinculosFuncionais)
    .innerJoin(schema.funcoes, eq(schema.vinculosFuncionais.funcaoId, schema.funcoes.id))
    .where(
      and(
        eq(schema.vinculosFuncionais.membroId, membroId),
        eq(schema.vinculosFuncionais.ativo, true),
        eq(schema.funcoes.ativo, true),
        eq(schema.funcoes.codigo, 'AUDITOR_SISTEMA')
      )
    )
    .all()

  if (!vinculosAuditor || vinculosAuditor.length === 0) return null

  const vinculosValidos = vinculosAuditor.filter(({ v }: any) => v.regionalId !== null || v.administracaoId !== null)
  if (vinculosValidos.length === 0) return null

  const regionaisIds = new Set<string>()
  const administracoesIds = new Set<string>()
  const setoresIds = new Set<string>()
  const casasIds = new Set<string>()
  const gtsIds = new Set<string>()

  for (const { v } of vinculosValidos) {
    if (v.regionalId) {
      regionaisIds.add(v.regionalId)
      const adms = await db.select({ id: schema.administracoes.id }).from(schema.administracoes).where(eq(schema.administracoes.regionalId, v.regionalId)).all()
      adms.forEach((a: any) => administracoesIds.add(a.id))
    } else if (v.administracaoId) {
      administracoesIds.add(v.administracaoId)
    }
  }

  const arrAdms = Array.from(administracoesIds)
  if (arrAdms.length > 0) {
    const setList = await db.select({ id: schema.setores.id }).from(schema.setores).where(inArray(schema.setores.administracaoId, arrAdms)).all()
    setList.forEach((s: any) => setoresIds.add(s.id))
  }

  const arrSetores = Array.from(setoresIds)
  if (arrSetores.length > 0) {
    const casList = await db.select({ id: schema.casas.id }).from(schema.casas).where(inArray(schema.casas.setorId, arrSetores)).all()
    casList.forEach((c: any) => casasIds.add(c.id))
  }

  const arrRegionais = Array.from(regionaisIds)
  const gtConditions = []
  if (arrRegionais.length > 0) gtConditions.push(inArray(schema.gruposTrabalho.regionalId, arrRegionais))
  if (arrAdms.length > 0) gtConditions.push(inArray(schema.gruposTrabalho.administracaoId, arrAdms))
  if (arrSetores.length > 0) gtConditions.push(inArray(schema.gruposTrabalho.setorId, arrSetores))

  if (gtConditions.length > 0) {
    const gtList = await db.select({ id: schema.gruposTrabalho.id }).from(schema.gruposTrabalho).where(or(...gtConditions)).all()
    gtList.forEach((g: any) => gtsIds.add(g.id))
  }

  return {
    regionaisIds: Array.from(regionaisIds),
    administracoesIds: Array.from(administracoesIds),
    setoresIds: Array.from(setoresIds),
    casasIds: Array.from(casasIds),
    gtsIds: Array.from(gtsIds)
  }
}


