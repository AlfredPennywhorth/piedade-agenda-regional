import { eq, and } from 'drizzle-orm'
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

