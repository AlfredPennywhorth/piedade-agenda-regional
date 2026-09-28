import { eq } from 'drizzle-orm'
import { espacosLocal } from '../db/schema'

export async function espacoPertenceAoLocal(
  db: any,
  localId: string | null | undefined,
  espacoId: string | null | undefined
): Promise<boolean> {
  if (!espacoId) return true
  if (!localId) return false

  const espaco = await db
    .select({ localId: espacosLocal.localId })
    .from(espacosLocal)
    .where(eq(espacosLocal.id, espacoId))
    .get()

  return !!espaco && espaco.localId === localId
}

export async function espacoAtivoPertenceAoLocal(
  db: any,
  localId: string | null | undefined,
  espacoId: string | null | undefined
): Promise<boolean> {
  if (!espacoId) return true
  if (!localId) return false

  const espaco = await db
    .select({ localId: espacosLocal.localId, ativo: espacosLocal.ativo })
    .from(espacosLocal)
    .where(eq(espacosLocal.id, espacoId))
    .get()

  return !!espaco && espaco.localId === localId && espaco.ativo === true
}
