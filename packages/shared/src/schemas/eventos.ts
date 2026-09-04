import { z } from 'zod'
import { isSameDayInSaoPaulo } from '../utils/date-utils'

export const ModalidadeEvento = z.enum(['PRESENCIAL', 'ONLINE', 'HIBRIDO'])
export type ModalidadeEventoEnum = z.infer<typeof ModalidadeEvento>

const HttpUrl = z.string().url('URL inválida').refine(
  val => val.startsWith('http://') || val.startsWith('https://'), 
  { message: 'URL deve usar protocolo http ou https' }
)

export const baseEvento = {
  titulo: z.string().min(1, 'Título é obrigatório'),
  descricao: z.string().nullable().optional(),
  pauta: z.string().nullable().optional(),
  modalidade: ModalidadeEvento,
  inicioEm: z.string().datetime({ message: 'A data de início deve ser uma string ISO 8601 válida' }),
  fimEm: z.string().datetime({ message: 'A data de fim deve ser uma string ISO 8601 válida' }),
  localId: z.string().uuid('Local ID inválido').nullable().optional(),
  urlOnline: HttpUrl.nullable().optional(),
  organizadorMembroId: z.string().uuid('Membro ID inválido').nullable().optional(),
  
  // Escopos (pelo menos um e no máximo um)
  regionalId: z.string().uuid('Regional ID inválido').nullable().optional(),
  administracaoId: z.string().uuid('Administração ID inválida').nullable().optional(),
  setorId: z.string().uuid('Setor ID inválido').nullable().optional(),
  casaId: z.string().uuid('Casa ID inválida').nullable().optional(),
  grupoTrabalhoId: z.string().uuid('GT ID inválido').nullable().optional(),

  observacoes: z.string().nullable().optional(),
  ativo: z.boolean().default(true).optional(),
}

const eventoSuperRefine = (data: any, ctx: z.RefinementCtx) => {
  // 1. Validar fim > inicio
  const dInicio = new Date(data.inicioEm)
  const dFim = new Date(data.fimEm)
  if (dFim <= dInicio) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A data de fim deve ser posterior à data de início',
      path: ['fimEm']
    })
  }

  // 2. Validar mesmo dia em America/Sao_Paulo
  if (data.inicioEm && data.fimEm && !isSameDayInSaoPaulo(data.inicioEm, data.fimEm)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'O evento não pode atravessar múltiplos dias no fuso de São Paulo',
      path: ['fimEm']
    })
  }

  // 3. Validar Modalidade
  if (data.modalidade === 'PRESENCIAL') {
    if (!data.localId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Eventos presenciais exigem localId',
        path: ['localId']
      })
    }
  } else if (data.modalidade === 'ONLINE') {
    if (!data.urlOnline) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Eventos online exigem urlOnline',
        path: ['urlOnline']
      })
    }
    if (data.localId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Eventos online não devem ter localId',
        path: ['localId']
      })
    }
  } else if (data.modalidade === 'HIBRIDO') {
    if (!data.localId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Eventos híbridos exigem localId',
        path: ['localId']
      })
    }
    if (!data.urlOnline) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Eventos híbridos exigem urlOnline',
        path: ['urlOnline']
      })
    }
  }

  // 4. Validar escopo único
  const scopes = [
    data.regionalId,
    data.administracaoId,
    data.setorId,
    data.casaId,
    data.grupoTrabalhoId
  ].filter(val => val !== null && val !== undefined && val !== '')

  if (scopes.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'O evento deve ter exatamente um escopo institucional',
      path: ['escopo'] // Using a generic path as it touches multiple fields
    })
  }
}

export const EventoCreate = z.object(baseEvento).superRefine(eventoSuperRefine)
export type EventoCreateInput = z.infer<typeof EventoCreate>

// For updates, we need to allow partial updates, but if we do partial updates
// we cannot easily run the superRefine as we don't have all data.
// In this project structure, often updates supply all required fields or the backend merges them before validation.
// If the backend merges them, validating the merged object with EventoCreate is better.
// If the backend doesn't, we should provide a partial schema without full validation.
export const EventoUpdate = z.object(baseEvento).partial().superRefine((data: any, ctx: z.RefinementCtx) => {
  // Only validate things if they are provided, but this is complex for partials.
  // We'll skip complex cross-field validation for partial updates here unless both fields are present.
  if (data.inicioEm && data.fimEm) {
     const dInicio = new Date(data.inicioEm)
     const dFim = new Date(data.fimEm)
     if (dFim <= dInicio) {
       ctx.addIssue({
         code: z.ZodIssueCode.custom,
         message: 'A data de fim deve ser posterior à data de início',
         path: ['fimEm']
       })
     }
     if (!isSameDayInSaoPaulo(data.inicioEm, data.fimEm)) {
       ctx.addIssue({
         code: z.ZodIssueCode.custom,
         message: 'O evento não pode atravessar múltiplos dias no fuso de São Paulo',
         path: ['fimEm']
       })
     }
  }
})
export type EventoUpdateInput = z.infer<typeof EventoUpdate>
