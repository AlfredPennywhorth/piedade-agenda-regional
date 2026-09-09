import { z } from 'zod'

export const EmitirCredencialSchema = z.object({
  eventoId: z.string().uuid('ID do evento inválido')
})

export const CheckinQrSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório')
})

export const CheckinManualSchema = z.object({
  membroId: z.string().uuid('ID do membro inválido')
})
