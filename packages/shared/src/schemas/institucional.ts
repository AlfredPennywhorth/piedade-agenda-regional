import { z } from 'zod'

// Validadores base
const baseEntity = {
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(255),
  codigo: z.string().max(50).optional().nullable(),
  ativo: z.boolean().optional().default(true),
}

// ---------------------------------------------
// Regional
// ---------------------------------------------
export const CreateRegionalSchema = z.object({
  ...baseEntity,
})
export const UpdateRegionalSchema = CreateRegionalSchema.partial()

export type CreateRegional = z.infer<typeof CreateRegionalSchema>
export type UpdateRegional = z.infer<typeof UpdateRegionalSchema>

// ---------------------------------------------
// Administração
// ---------------------------------------------
export const CreateAdministracaoSchema = z.object({
  regionalId: z.string().uuid("regionalId deve ser um UUID válido"),
  ...baseEntity,
})
export const UpdateAdministracaoSchema = CreateAdministracaoSchema.partial()

export type CreateAdministracao = z.infer<typeof CreateAdministracaoSchema>
export type UpdateAdministracao = z.infer<typeof UpdateAdministracaoSchema>

// ---------------------------------------------
// Setor
// ---------------------------------------------
export const CreateSetorSchema = z.object({
  administracaoId: z.string().uuid("administracaoId deve ser um UUID válido"),
  ...baseEntity,
})
export const UpdateSetorSchema = CreateSetorSchema.partial()

export type CreateSetor = z.infer<typeof CreateSetorSchema>
export type UpdateSetor = z.infer<typeof UpdateSetorSchema>

// ---------------------------------------------
// Casa de Oração
// ---------------------------------------------
export const CreateCasaSchema = z.object({
  setorId: z.string().uuid("setorId deve ser um UUID válido"),
  ...baseEntity,
})
export const UpdateCasaSchema = CreateCasaSchema.partial()

export type CreateCasa = z.infer<typeof CreateCasaSchema>
export type UpdateCasa = z.infer<typeof UpdateCasaSchema>

// ---------------------------------------------
// Grupo de Trabalho
// ---------------------------------------------
// Regra vigente: GT é exclusivamente Regional. Os campos legados
// administracaoId/setorId são aceitos apenas como null para permitir
// saneamento de clientes antigos sem reintroduzir escopos inválidos.
export const CreateGrupoTrabalhoSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(255),
  ativo: z.boolean().optional().default(true),
  regionalId: z.string().uuid("regionalId deve ser um UUID válido").optional().nullable(),
  administracaoId: z.string().uuid().optional().nullable(),
  setorId: z.string().uuid().optional().nullable(),
}).superRefine((data, ctx) => {
  if (!data.regionalId || data.administracaoId || data.setorId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "O Grupo de Trabalho deve pertencer exclusivamente a uma Regional.",
      path: ["escopo"],
    })
  }
})

export const UpdateGrupoTrabalhoSchema = z.object({
  nome: z.string().min(2).max(255).optional(),
  ativo: z.boolean().optional(),
  regionalId: z.string().uuid("regionalId deve ser um UUID válido").optional().nullable(),
  administracaoId: z.string().uuid().optional().nullable(),
  setorId: z.string().uuid().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.administracaoId || data.setorId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "O Grupo de Trabalho deve pertencer exclusivamente a uma Regional.",
      path: ["escopo"],
    })
  }
})

export type CreateGrupoTrabalho = z.infer<typeof CreateGrupoTrabalhoSchema>
export type UpdateGrupoTrabalho = z.infer<typeof UpdateGrupoTrabalhoSchema>
