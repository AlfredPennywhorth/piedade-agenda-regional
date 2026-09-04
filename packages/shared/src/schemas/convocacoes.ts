import { z } from 'zod'

export const StatusConvocacao = z.enum([
  'RASCUNHO',
  'PUBLICADA',
  'CANCELADA'
])
export type StatusConvocacaoEnum = z.infer<typeof StatusConvocacao>

const baseConvocacao = {
  eventoId: z.string().uuid('ID do evento deve ser um UUID válido'),
  observacoes: z.string().nullable().optional()
}

export const ConvocacaoSchema = z.object({
  id: z.string().uuid(),
  ...baseConvocacao,
  status: StatusConvocacao,
  publicadaEm: z.string().nullable().optional(),
  canceladaEm: z.string().nullable().optional(),
  ativo: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
}).strict()

export type Convocacao = z.infer<typeof ConvocacaoSchema>

export const ConvocacaoCreate = z.object({
  eventoId: z.string().uuid('ID do evento deve ser um UUID válido'),
  observacoes: z.string().nullable().optional()
}).strict()

export type ConvocacaoCreatePayload = z.infer<typeof ConvocacaoCreate>

export const ConvocacaoUpdate = z.object({
  observacoes: z.string().nullable().optional()
}).strict()

export type ConvocacaoUpdatePayload = z.infer<typeof ConvocacaoUpdate>

export const ConvocacaoFuncaoSchema = z.object({
  id: z.string().uuid(),
  convocacaoId: z.string().uuid(),
  funcaoId: z.string().uuid(),
  createdAt: z.string()
}).strict()

export type ConvocacaoFuncao = z.infer<typeof ConvocacaoFuncaoSchema>

export const ConvocacaoFuncaoCreate = z.object({
  funcaoId: z.string().uuid('ID da função deve ser um UUID válido')
}).strict()

export type ConvocacaoFuncaoCreatePayload = z.infer<typeof ConvocacaoFuncaoCreate>

export const ConvocacaoDestinatarioSchema = z.object({
  id: z.string().uuid(),
  convocacaoId: z.string().uuid(),
  membroId: z.string().uuid(),
  funcaoId: z.string().uuid(),
  vinculoFuncionalId: z.string().uuid(),
  createdAt: z.string()
}).strict()

export type ConvocacaoDestinatario = z.infer<typeof ConvocacaoDestinatarioSchema>
