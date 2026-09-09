import { eq, and } from 'drizzle-orm'
import { checkinTokens } from '../db/schema'
import { executeAtomic } from '../db/batch'

export async function hashToken(rawToken: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(rawToken)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function generateRawToken(): Promise<string> {
  const buffer = new Uint8Array(32) // 256 bits
  crypto.getRandomValues(buffer)
  return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function emitirCredencial(
  db: any,
  eventoId: string,
  membroId: string
): Promise<{ rawToken: string; expiraEm: string }> {
  const rawToken = await generateRawToken()
  const tokenHash = await hashToken(rawToken)
  
  const now = new Date()
  const expiraEm = new Date(now.getTime() + 5 * 60000).toISOString() // +5 min
  const nowIso = now.toISOString()
  const id = crypto.randomUUID()

  // Invalida tokens anteriores e cria o novo
  await executeAtomic(db, (tx) => {
    return [
      tx.update(checkinTokens)
        .set({ ativo: false, updatedAt: nowIso })
        .where(
          and(
            eq(checkinTokens.eventoId, eventoId),
            eq(checkinTokens.membroId, membroId),
            eq(checkinTokens.ativo, true)
          )
        ),
      tx.insert(checkinTokens)
        .values({
          id,
          eventoId,
          membroId,
          tokenHash,
          expiraEm,
          ativo: true,
          createdAt: nowIso,
          updatedAt: nowIso
        })
    ]
  })

  return { rawToken, expiraEm }
}
