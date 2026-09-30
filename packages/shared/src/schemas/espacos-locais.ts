import { z } from 'zod'

export const EspacoLocalCreate = z.object({
  localId: z.string().uuid('Local ID inválido'),
  nome: z.string().trim().min(1, 'Nome é obrigatório'),
  descricao: z.string().trim().nullable().optional(),
  capacidade: z.number().int().positive('Capacidade deve ser maior que zero').nullable().optional(),
  ativo: z.boolean().default(true).optional(),
})

export type EspacoLocalCreateInput = z.infer<typeof EspacoLocalCreate>

export const EspacoLocalUpdate = EspacoLocalCreate.partial()
export type EspacoLocalUpdateInput = z.infer<typeof EspacoLocalUpdate>
