import { enviarNotificacao, VapidDetails } from './web-push'
import type { NotificacoesRepository } from './notificacoes-repository'

export async function enviarAvisosConvocacao(
  repo: NotificacoesRepository,
  convocacaoId: string,
  titulo: string,
  mensagem: string,
  vapidDetails: VapidDetails,
  url: string
): Promise<{ totais: number; enviados: number; inativados: number; falhas: number }> {
  // Busca todos os destinatários ativos vinculados à convocação
  const destinatarios = await repo.listarMembrosDaConvocacao(convocacaoId)

  // Filtra IDs únicos
  const membroIds = Array.from(new Set(destinatarios))

  let enviados = 0
  let inativados = 0
  let falhas = 0

  for (const membroId of membroIds) {
    // Busca subscriptions ativas do membro
    const subs = await repo.listarSubscriptionsAtivas(membroId)

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
          await repo.inativarSubscription(sub.id)
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
