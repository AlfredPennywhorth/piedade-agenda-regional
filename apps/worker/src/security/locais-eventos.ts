import { and, eq, isNotNull } from 'drizzle-orm'
import { eventos } from '../db/schema'
import { condicaoEventosVisiveis } from './eventos'
import type { ContextoPermissoes } from './permissoes'

// Somente referências de eventos que a própria API de Eventos autoriza consultar.
// Não concede direito de editar os cadastros territoriais nem revela locais particulares.
export async function locaisDeEventosVisiveis(db: any, contexto: ContextoPermissoes): Promise<Set<string>> {
  const condicao = await condicaoEventosVisiveis(db, contexto)
  const referencias = await db.select({ id: eventos.localId }).from(eventos)
    .where(and(isNotNull(eventos.localId), condicao)).all()
  return new Set<string>(referencias.map((item: { id: string | null }) => item.id).filter((id: string | null): id is string => Boolean(id)))
}

export async function espacosDeEventosVisiveis(db: any, contexto: ContextoPermissoes): Promise<Set<string>> {
  const condicao = await condicaoEventosVisiveis(db, contexto)
  const referencias = await db.select({ id: eventos.espacoId }).from(eventos)
    .where(and(isNotNull(eventos.espacoId), condicao)).all()
  return new Set<string>(referencias.map((item: { id: string | null }) => item.id).filter((id: string | null): id is string => Boolean(id)))
}
