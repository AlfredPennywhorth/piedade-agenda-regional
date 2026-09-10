import { z } from 'zod'

export const FormaCheckin = z.enum(['QR', 'MANUAL'])
export type FormaCheckinEnum = z.infer<typeof FormaCheckin>

export const CheckinQrSchema = z.object({
  qrToken: z.string().min(1, 'QR Token é obrigatório')
}).strict()
export type CheckinQrPayload = z.infer<typeof CheckinQrSchema>

export const CheckinManualSchema = z.object({
  convocacaoDestinatarioId: z.string().uuid('ID do destinatário da convocação deve ser um UUID válido')
}).strict()
export type CheckinManualPayload = z.infer<typeof CheckinManualSchema>

export const CheckinSchema = z.object({
  id: z.string().uuid(),
  convocacaoDestinatarioId: z.string().uuid(),
  eventoId: z.string().uuid(),
  membroId: z.string().uuid(),
  dataHoraCheckin: z.string(),
  forma: FormaCheckin,
  operadorMembroId: z.string().uuid().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
}).strict()
export type Checkin = z.infer<typeof CheckinSchema>
