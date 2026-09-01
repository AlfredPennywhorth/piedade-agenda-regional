import { z } from 'zod'

const escoposVinculo = {
  regionalId: z.string().uuid("regionalId deve ser um UUID válido").optional().nullable(),
  administracaoId: z.string().uuid("administracaoId deve ser um UUID válido").optional().nullable(),
  setorId: z.string().uuid("setorId deve ser um UUID válido").optional().nullable(),
  casaId: z.string().uuid("casaId deve ser um UUID válido").optional().nullable(),
  grupoTrabalhoId: z.string().uuid("grupoTrabalhoId deve ser um UUID válido").optional().nullable(),
}

export const CreateVinculoFuncionalSchema = z.object({
  membroId: z.string().uuid("membroId deve ser um UUID válido"),
  funcaoId: z.string().uuid("funcaoId deve ser um UUID válido"),
  ativo: z.boolean().optional().default(true),
  ...escoposVinculo,
}).refine((data) => {
  let preenchidos = 0;
  if (data.regionalId) preenchidos++;
  if (data.administracaoId) preenchidos++;
  if (data.setorId) preenchidos++;
  if (data.casaId) preenchidos++;
  if (data.grupoTrabalhoId) preenchidos++;

  return preenchidos === 1;
}, {
  message: "O vínculo funcional deve possuir exatamente um escopo institucional.",
  path: ["escopo"]
})

export const UpdateVinculoFuncionalSchema = z.object({
  membroId: z.string().uuid("membroId deve ser um UUID válido").optional(),
  funcaoId: z.string().uuid("funcaoId deve ser um UUID válido").optional(),
  ativo: z.boolean().optional(),
  ...escoposVinculo,
})
// A validação de escopo único no PATCH será feita na rota da API, 
// combinando o estado atual do banco com as alterações enviadas.

export type CreateVinculoFuncional = z.infer<typeof CreateVinculoFuncionalSchema>
export type UpdateVinculoFuncional = z.infer<typeof UpdateVinculoFuncionalSchema>
