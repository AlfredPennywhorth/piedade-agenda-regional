import { eq, and } from 'drizzle-orm'
import { convocacaoDestinatarios, pushSubscriptions, membros } from '../db/schema'
import { enviarNotificacao, VapidDetails } from './web-push'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

export async function enviarAvisosConvocacao(
  db: BaseSQLiteDatabase<'async' | 'sync', any, any, any>,
  convocacaoId: string,
  titulo: string,
  mensagem: string,
  vapidDetails: VapidDetails,
  url: string
): Promise<{ totais: number; enviados: number; inativados: number; falhas: number }> {
  // Busca todos os destinatários ativos vinculados à convocação
  const destinatarios = await db
    .select({
      membroId: convocacaoDestinatarios.membroId
    })
    .from(convocacaoDestinatarios)
    .innerJoin(membros, eq(convocacaoDestinatarios.membroId, membros.id))
    .where(
      and(
        eq(convocacaoDestinatarios.convocacaoId, convocacaoId),
        eq(membros.ativo, true)
      )
    )
    .all()

  // Filtra IDs únicos
  const membroIds = Array.from(new Set(destinatarios.map((d: { membroId: string }) => d.membroId)))

  let enviados = 0
  let inativados = 0
  let falhas = 0

  for (const membroId of membroIds) {
    // Busca subscriptions ativas do membro
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.membroId, membroId),
          eq(pushSubscriptions.ativo, true)
        )
      )
      .all()

    for (const sub of subs) {
      const payload = JSON.stringify({ titulo, mensagem, url })
      const result = await enviarNotificacao(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        },
        payload,
        vapidDetails
      )

      if (result.success) {
        enviados++
      } else {
        // Se retornar 410 (Gone) ou 404 (Not Found), inativamos a subscription
        if (result.status === 410 || result.status === 404) {
          await db
            .update(pushSubscriptions)
            .set({ ativo: false, updatedAt: new Date().toISOString() })
            .where(eq(pushSubscriptions.id, sub.id))
            .run()
          inativados++
        } else {
          // Erro transiente (5xx) ou outros não devem apagar/inativar
          falhas++
        }
      }
    }
  }

  return { totais: membroIds.length, enviados, inativados, falhas }
}
