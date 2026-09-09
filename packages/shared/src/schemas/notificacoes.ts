import { z } from 'zod'

export const PushSubscriptionKeysSchema = z.object({
  p256dh: z.string().min(1),
  auth: z.string().min(1)
})

export const PushSubscriptionSchema = z.object({
  endpoint: z.string().url('Endpoint inválido'),
  keys: PushSubscriptionKeysSchema
})

export type PushSubscriptionPayload = z.infer<typeof PushSubscriptionSchema>

export const SendPushMessageSchema = z.object({
  titulo: z.string().min(1),
  mensagem: z.string().min(1),
  url: z.string().optional()
})

export type SendPushMessagePayload = z.infer<typeof SendPushMessageSchema>
