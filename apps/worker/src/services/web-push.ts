import { generateVapidKeys, generateWebPushMessage, generateVapidAuthorizationHeader } from '@block65/webcrypto-web-push'

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
    const message = await generateWebPushMessage(
      payload,
      subscription,
      {
        vapidDetails
      }
    )

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: message.headers,
      body: message.body
    })

    if (!response.ok) {
      const errText = await response.text()
      return { success: false, status: response.status, error: errText }
    }

    return { success: true, status: response.status }
  } catch (error: any) {
    return { success: false, status: 500, error: error.message }
  }
}
