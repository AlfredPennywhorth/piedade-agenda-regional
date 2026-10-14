import { and, inArray } from 'drizzle-orm'
import { eventos } from '../db/schema'
import { condicaoEventosVisiveis } from './eventos'
import type { ContextoPermissoes } from './permissoes'

// Limita a busca às referências candidatas; não carrega eventos históricos inteiros.
// A permissão é exclusivamente de leitura para recursos referenciados por eventos visíveis.
async function referenciasVisiveis(
  db: any,
  contexto: ContextoPermissoes,
  coluna: typeof eventos.localId | typeof eventos.espacoId,
  candidatos: string[]
): Promise<Set<string>> {
  const ids = [...new Set(candidatos)].filter(Boolean)
  if (ids.length === 0) return new Set<string>()
  const condicao = await condicaoEventosVisiveis(db, contexto)
  const autorizados = new Set<string>()
  // O predicado de visibilidade varia conforme os vínculos legados da conta.
  // Contamos os bindings gerados pelo Drizzle antes de dimensionar cada lote,
  // respeitando o teto de 100 parâmetros do Cloudflare D1.
  const consultaBase = db.selectDistinct({ id: coluna }).from(eventos)
    .where(and(inArray(coluna, [ids[0]]), condicao))
  const parametrosFixos = consultaBase.toSQL().params.length - 1
  const tamanhoLote = Math.min(80, 100 - parametrosFixos)
  if (tamanhoLote < 1) {
    throw new Error('Condição de visibilidade excede o limite de parâmetros do D1')
  }
  for (let i = 0; i < ids.length; i += tamanhoLote) {
    const lote = ids.slice(i, i + tamanhoLote)
    const registros: Array<{ id: string | null }> = await db.selectDistinct({ id: coluna })
      .from(eventos)
      .where(and(inArray(coluna, lote), condicao)).all()
    for (const registro of registros) if (registro.id) autorizados.add(registro.id)
  }
  return autorizados
}

export function locaisDeEventosVisiveis(db: any, contexto: ContextoPermissoes, candidatos: string[]): Promise<Set<string>> {
  return referenciasVisiveis(db, contexto, eventos.localId, candidatos)
}

export function espacosDeEventosVisiveis(db: any, contexto: ContextoPermissoes, candidatos: string[]): Promise<Set<string>> {
  return referenciasVisiveis(db, contexto, eventos.espacoId, candidatos)
}
