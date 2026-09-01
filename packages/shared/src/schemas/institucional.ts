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
export const CreateGrupoTrabalhoSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(255),
  ativo: z.boolean().optional().default(true),
  regionalId: z.string().uuid().optional().nullable(),
  administracaoId: z.string().uuid().optional().nullable(),
  setorId: z.string().uuid().optional().nullable(),
}).refine((data) => {
  let escoposPreenchidos = 0;
  if (data.regionalId) escoposPreenchidos++;
  if (data.administracaoId) escoposPreenchidos++;
  if (data.setorId) escoposPreenchidos++;

  return escoposPreenchidos === 1;
}, {
  message: "O Grupo de Trabalho deve pertencer a exatamente um escopo (Regional, Administração ou Setor).",
  path: ["escopo"] // Indica que o erro ocorreu na combinação dos escopos
})

export const UpdateGrupoTrabalhoSchema = z.object({
  nome: z.string().min(2).max(255).optional(),
  ativo: z.boolean().optional(),
  regionalId: z.string().uuid().optional().nullable(),
  administracaoId: z.string().uuid().optional().nullable(),
  setorId: z.string().uuid().optional().nullable(),
}).refine((data) => {
  // Para update parcial, se nenhuma FK for enviada, consideramos válido (apenas atualizando nome/ativo).
  // Mas se for enviada alguma FK, precisamos garantir que o conjunto final enviado seja válido?
  // O PATCH não envia o objeto todo. Vamos assumir que se ele enviar campos de escopo, deve estar correto 
  // Ou delegamos a validação de FKs pro banco.
  // Como Zod só tem os dados da requisição, se ele passar { regionalId: '...', administracaoId: null, setorId: null } seria bom validar
  
  const hasRegional = data.regionalId !== undefined;
  const hasAdm = data.administracaoId !== undefined;
  const hasSetor = data.setorId !== undefined;

  // Se nenhum escopo foi enviado na request de PATCH, a atualização é livre
  if (!hasRegional && !hasAdm && !hasSetor) return true;

  // Se enviou, pelo menos um deve ser truthy (visto que estamos substituindo), e os outros falsy
  // Para ser seguro na reatribuição, o client DEVE mandar null pros outros se for mudar
  let preenchidos = 0;
  if (data.regionalId) preenchidos++;
  if (data.administracaoId) preenchidos++;
  if (data.setorId) preenchidos++;
  
  // Isso requer que a interface envie o objeto de escopos por completo se for alterar.
  // Caso envie parcial (ex: só regionalId), isso quebraria a validação se no banco já houvesse outro.
  // Por ora, vamos restringir que se for alterar escopo, deve mandar exatamente 1 não nulo e no max 1.
  return preenchidos <= 1; // Pode ser 0 se enviou nulos, o banco bloqueia
}, {
  message: "Ao alterar o escopo, forneça exatamente o novo ID de escopo e anule (null) os demais.",
  path: ["escopo"]
})

export type CreateGrupoTrabalho = z.infer<typeof CreateGrupoTrabalhoSchema>
export type UpdateGrupoTrabalho = z.infer<typeof UpdateGrupoTrabalhoSchema>
