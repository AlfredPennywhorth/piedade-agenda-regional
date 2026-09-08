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

// ============================================================
// RSVP — S08
// ============================================================

export const StatusRsvp = z.enum(['PARTICIPAREI', 'NAO_PARTICIPAREI', 'NAO_SEI'])
export type StatusRsvpEnum = z.infer<typeof StatusRsvp>

export const PeriodoParticipacao = z.enum(['MANHA', 'TARDE', 'NOITE'])
export type PeriodoParticipacaoEnum = z.infer<typeof PeriodoParticipacao>

export const TipoRefeicao = z.enum(['CAFE_MANHA', 'ALMOCO', 'LANCHE', 'JANTAR'])
export type TipoRefeicaoEnum = z.infer<typeof TipoRefeicao>

export const RsvpSchema = z.object({
  id: z.string().uuid(),
  convocacaoDestinatarioId: z.string().uuid(),
  resposta: StatusRsvp,
  justificativa: z.string().nullable().optional(),
  periodosParticipacao: z.array(PeriodoParticipacao).optional().nullable(),
  respondidoEm: z.string(),
  atualizadoEm: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Rsvp = z.infer<typeof RsvpSchema>

export const RsvpUpsert = z.object({
  resposta: StatusRsvp,
  justificativa: z.string().nullable().optional(),
  periodosParticipacao: z.array(PeriodoParticipacao).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.resposta === 'NAO_PARTICIPAREI' && !data.justificativa?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Justificativa é obrigatória quando resposta é NAO_PARTICIPAREI',
      path: ['justificativa'],
    })
  }
})
export type RsvpUpsertPayload = z.infer<typeof RsvpUpsert>
