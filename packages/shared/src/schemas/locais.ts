import { z } from 'zod'

export const LocalCreate = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  endereco: z.string().min(1, 'Endereço é obrigatório'),
  numero: z.string().min(1, 'Número é obrigatório'),
  complemento: z.string().nullable().optional(),
  bairro: z.string().nullable().optional(),
  cidade: z.string().min(1, 'Cidade é obrigatória'),
  uf: z.string().length(2, 'UF deve ter 2 caracteres').toUpperCase(),
  cep: z.string().nullable().optional(),
  referencia: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  urlMaps: z.string().url('URL inválida').nullable().optional(),
  urlWaze: z.string().url('URL inválida').nullable().optional(),
  ativo: z.boolean().default(true).optional(),
})

export type LocalCreateInput = z.infer<typeof LocalCreate>

export const LocalUpdate = LocalCreate.partial().extend({
  ativo: z.boolean().optional()
})

export type LocalUpdateInput = z.infer<typeof LocalUpdate>
