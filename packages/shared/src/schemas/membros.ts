import { z } from 'zod'
import { normalizarCelular } from '../utils/celular'

export const CreateMembroSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(255),
  dataNascimento: z.string().optional().nullable(),
  celular: z.string().optional().nullable().superRefine((val, ctx) => {
    if (val) {
      const normalizado = normalizarCelular(val)
      if (!normalizado) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Formato de celular inválido",
        })
      }
    }
  }).transform(val => (val ? normalizarCelular(val) : null)),
  casaId: z.string().uuid("casaId deve ser um UUID válido"),
  ativo: z.boolean().optional().default(true),
})

export const UpdateMembroSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(255).optional(),
  dataNascimento: z.string().optional().nullable(),
  celular: z.string().optional().nullable().superRefine((val, ctx) => {
    if (val) {
      const normalizado = normalizarCelular(val)
      if (!normalizado) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Formato de celular inválido",
        })
      }
    }
  }).transform(val => (val ? normalizarCelular(val) : null)),
  casaId: z.string().uuid("casaId deve ser um UUID válido").optional(),
  ativo: z.boolean().optional(),
})

export type CreateMembro = z.infer<typeof CreateMembroSchema>
export type UpdateMembro = z.infer<typeof UpdateMembroSchema>
