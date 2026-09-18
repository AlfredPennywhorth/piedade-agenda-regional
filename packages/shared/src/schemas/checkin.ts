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

export const PortariaEventosQuerySchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
}).strict()
export type PortariaEventosQuery = z.infer<typeof PortariaEventosQuerySchema>

export const PortariaEventoItemSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string(),
  inicioEm: z.string(),
  fimEm: z.string(),
  modalidade: z.enum(['PRESENCIAL', 'ONLINE', 'HIBRIDO']),
}).strict()

export const PortariaEventosResponseSchema = z.object({
  data: z.array(PortariaEventoItemSchema),
}).strict()
export type PortariaEventosResponse = z.infer<typeof PortariaEventosResponseSchema>
