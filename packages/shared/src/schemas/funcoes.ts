import { z } from 'zod'

export const CreateFuncaoSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(255),
  codigo: z.string().max(50).optional().nullable(),
  descricao: z.string().optional().nullable(),
  ativo: z.boolean().optional().default(true),
})

export const UpdateFuncaoSchema = CreateFuncaoSchema.partial()

export type CreateFuncao = z.infer<typeof CreateFuncaoSchema>
export type UpdateFuncao = z.infer<typeof UpdateFuncaoSchema>
