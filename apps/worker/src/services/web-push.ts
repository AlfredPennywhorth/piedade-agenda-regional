import { buildPushPayload } from '@block65/webcrypto-web-push'

export interface VapidDetails {
  publicKey: string
  privateKey: string
  subject: string
}

export interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export async function enviarNotificacao(
  subscription: PushSubscriptionData,
  payload: string,
  vapidDetails: VapidDetails
): Promise<{ success: boolean; status: number; error?: string }> {
  try {
    const pushMessage = {
      data: payload
    }

    const sub = {
      endpoint: subscription.endpoint,
      expirationTime: null,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      }
    }

    const message = await buildPushPayload(
      pushMessage,
      sub,
      vapidDetails
    )

    const response = await fetch(subscription.endpoint, {
      method: message.method,
      headers: message.headers,
      body: message.body
    })

    if (!response.ok) {
      const errText = await response.text()
      return { success: false, status: response.status, error: errText }
    }

    return { success: true, status: response.status }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, status: 500, error: message }
  }
}
