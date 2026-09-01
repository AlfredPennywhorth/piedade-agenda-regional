import { z } from 'zod'

export const CreateMembroSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(255),
  dataNascimento: z.string().optional().nullable(),
  celular: z.string().optional().nullable(),
  casaId: z.string().uuid("casaId deve ser um UUID válido"),
  ativo: z.boolean().optional().default(true),
})

export const UpdateMembroSchema = CreateMembroSchema.partial()

export type CreateMembro = z.infer<typeof CreateMembroSchema>
export type UpdateMembro = z.infer<typeof UpdateMembroSchema>
