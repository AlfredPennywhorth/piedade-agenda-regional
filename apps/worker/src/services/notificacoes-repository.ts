export interface PushSubscriptionAtiva {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface NotificacoesRepository {
  listarMembrosDaConvocacao(convocacaoId: string): Promise<string[]>

  listarSubscriptionsAtivas(
    membroId: string
  ): Promise<PushSubscriptionAtiva[]>

  inativarSubscription(id: string): Promise<void>
}
