import { eq, and, or } from 'drizzle-orm'
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
 * Valida se o membro possui vínculo ativo com a função OPERADOR_PORTARIA no mesmo escopo do evento.
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
        or(
          eq(schema.funcoes.codigo, 'OPERADOR_PORTARIA'),
          eq(schema.funcoes.nome, 'Operador de Portaria')
        )
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
