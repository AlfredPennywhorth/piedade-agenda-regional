import { eq, and } from 'drizzle-orm'
import { DrizzleD1Database } from 'drizzle-orm/d1'
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

export async function carregarContextoPermissoes(db: DrizzleD1Database<typeof schema>, membroId: string): Promise<ContextoPermissoes> {
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
