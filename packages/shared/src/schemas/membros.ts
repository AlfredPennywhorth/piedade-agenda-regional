import { z } from 'zod'
import { normalizarCelular } from '../utils/celular'

export const CreateMembroSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(255),
  dataOrdenacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de ordenação deve usar o formato AAAA-MM-DD'),
  codigoCarteirinha: z.string().trim().min(1, 'Código da carteirinha é obrigatório').max(100),
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
}).strict()

export const UpdateMembroSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(255).optional(),
  dataOrdenacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de ordenação deve usar o formato AAAA-MM-DD').optional(),
  codigoCarteirinha: z.string().trim().min(1, 'Código da carteirinha não pode ser vazio').max(100).optional(),
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
}).strict()

export type CreateMembro = z.infer<typeof CreateMembroSchema>
export type UpdateMembro = z.infer<typeof UpdateMembroSchema>
