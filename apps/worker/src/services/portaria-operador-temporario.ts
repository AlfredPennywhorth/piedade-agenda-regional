import { and, eq } from 'drizzle-orm'
import { credenciaisOperadorPortariaEvento, eventos, portariasEvento } from '../db/schema'
import { hashToken } from '../security/tokens'

export type CredencialOperadorValida = {
  id: string
  eventoId: string
  expiraEm: string
  evento: typeof eventos.$inferSelect
}

export async function validarCredencialOperadorPortaria(
  db: any,
  token: string
): Promise<
  | { ok: true; credencial: CredencialOperadorValida }
  | { ok: false; status: 401 | 409 | 410; code: string; error: string }
> {
  const tokenLimpo = token.trim()
  if (!tokenLimpo) {
    return { ok: false, status: 401, code: 'CREDENCIAL_INVALIDA', error: 'Credencial inválida' }
  }

  const tokenHash = await hashToken(tokenLimpo)
  const credencial = await db
    .select()
    .from(credenciaisOperadorPortariaEvento)
    .where(and(
      eq(credenciaisOperadorPortariaEvento.tokenHash, tokenHash),
      eq(credenciaisOperadorPortariaEvento.ativo, true)
    ))
    .get()

  if (!credencial || credencial.revogadoEm) {
    return { ok: false, status: 401, code: 'CREDENCIAL_INVALIDA', error: 'Credencial inválida ou revogada' }
  }

  if (new Date(credencial.expiraEm).getTime() <= Date.now()) {
    return { ok: false, status: 410, code: 'CREDENCIAL_EXPIRADA', error: 'Credencial expirada' }
  }

  const evento = await db
    .select()
    .from(eventos)
    .where(and(eq(eventos.id, credencial.eventoId), eq(eventos.ativo, true)))
    .get()

  if (!evento) {
    return { ok: false, status: 409, code: 'EVENTO_INDISPONIVEL', error: 'Evento indisponível' }
  }

  const portaria = await db
    .select({ status: portariasEvento.status })
    .from(portariasEvento)
    .where(eq(portariasEvento.eventoId, credencial.eventoId))
    .get()

  if (portaria?.status === 'FECHADA') {
    return { ok: false, status: 409, code: 'PORTARIA_FECHADA', error: 'A Portaria desta reunião já foi fechada' }
  }

  const agora = new Date().toISOString()
  await db
    .update(credenciaisOperadorPortariaEvento)
    .set({ ultimoAcessoEm: agora, updatedAt: agora })
    .where(eq(credenciaisOperadorPortariaEvento.id, credencial.id))

  return {
    ok: true,
    credencial: {
      id: credencial.id,
      eventoId: credencial.eventoId,
      expiraEm: credencial.expiraEm,
      evento,
    },
  }
}
