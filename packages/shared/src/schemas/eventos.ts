import { z } from 'zod'
import { isSameDayInSaoPaulo } from '../utils/date-utils'
import { TipoRefeicao } from './convocacoes'
import { PAISES_ISO } from './paises'

export const ModalidadeEvento = z.enum(['PRESENCIAL', 'ONLINE', 'HIBRIDO'])
export type ModalidadeEventoEnum = z.infer<typeof ModalidadeEvento>

export const AbrangenciaEvento = z.enum(['TERRITORIAL', 'NACIONAL', 'INTERNACIONAL'])
export type AbrangenciaEventoEnum = z.infer<typeof AbrangenciaEvento>

export const UF_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const
export const UfBrasil = z.enum(UF_BRASIL)
export type UfBrasilEnum = z.infer<typeof UfBrasil>

const CODIGOS_PAIS_ISO = PAISES_ISO.map(([codigo]) => codigo) as [string, ...string[]]
export const CodigoPaisISO2 = z.enum(CODIGOS_PAIS_ISO, {
  errorMap: () => ({ message: 'País deve usar código ISO 3166-1 alpha-2 válido' }),
})
export type CodigoPaisISO2Type = z.infer<typeof CodigoPaisISO2>

const HttpUrl = z.string().url('URL inválida').refine(
  val => val.startsWith('http://') || val.startsWith('https://'), 
  { message: 'URL deve usar protocolo http ou https' }
)

export const baseEvento = {
  pessoal: z.boolean().optional(),
  titulo: z.string().min(1, 'Título é obrigatório'),
  descricao: z.string().nullable().optional(),
  pauta: z.string().nullable().optional(),
  modalidade: ModalidadeEvento,
  inicioEm: z.string().datetime({ message: 'A data de início deve ser uma string ISO 8601 válida' }),
  fimEm: z.string().datetime({ message: 'A data de fim deve ser uma string ISO 8601 válida' }),
  localId: z.string().uuid('Local ID inválido').nullable().optional(),
  espacoId: z.string().uuid('Espaço ID inválido').nullable().optional(),
  urlOnline: HttpUrl.nullable().optional(),
  organizadorMembroId: z.string().uuid('Membro ID inválido').nullable().optional(),

  abrangencia: AbrangenciaEvento.default('TERRITORIAL').optional(),
  destinoUf: UfBrasil.nullable().optional(),
  destinoPaisCodigo: CodigoPaisISO2.nullable().optional(),
  destinoCidadeLocal: z.string().trim().min(2, 'Cidade / Local de Atendimento é obrigatório').max(180).nullable().optional(),
  
  // Escopos institucionais territoriais (exatamente um quando abrangencia=TERRITORIAL)
  regionalId: z.string().uuid('Regional ID inválido').nullable().optional(),
  administracaoId: z.string().uuid('Administração ID inválida').nullable().optional(),
  setorId: z.string().uuid('Setor ID inválido').nullable().optional(),
  casaId: z.string().uuid('Casa ID inválida').nullable().optional(),
  grupoTrabalhoId: z.string().uuid('GT ID inválido').nullable().optional(),

  observacoes: z.string().nullable().optional(),
  ativo: z.boolean().default(true).optional(),

  // S09
  possuiManha: z.boolean().default(false).optional(),
  possuiTarde: z.boolean().default(false).optional(),
  possuiNoite: z.boolean().default(false).optional(),
}

const eventoSuperRefine = (data: any, ctx: z.RefinementCtx) => {
  const abrangencia = data.abrangencia ?? 'TERRITORIAL'
  const externo = abrangencia === 'NACIONAL' || abrangencia === 'INTERNACIONAL'

  if (data.pessoal && !externo && !data.casaId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Evento Próprio territorial exige escopo Casa de Oração', path: ['pessoal'] })
  }

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
    if (!data.localId && !externo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Eventos presenciais territoriais exigem localId',
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
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Eventos online não devem ter localId', path: ['localId'] })
    }
    if (data.espacoId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Eventos online não devem ter espacoId', path: ['espacoId'] })
    }
  } else if (data.modalidade === 'HIBRIDO') {
    if (!data.localId && !externo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Eventos híbridos territoriais exigem localId',
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

  // 4. Validar abrangência e destino
  const scopes = [
    data.regionalId,
    data.administracaoId,
    data.setorId,
    data.casaId,
    data.grupoTrabalhoId
  ].filter((val: unknown) => val !== null && val !== undefined && val !== '')

  if (abrangencia === 'TERRITORIAL') {
    if (scopes.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Evento territorial deve ter exatamente um escopo institucional',
        path: ['escopo']
      })
    }
    if (data.destinoUf || data.destinoPaisCodigo || data.destinoCidadeLocal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Evento territorial não deve informar destino externo',
        path: ['abrangencia']
      })
    }
  } else {
    if (scopes.length !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Evento externo não deve usar escopos territoriais de SP',
        path: ['escopo']
      })
    }
    if (!data.destinoCidadeLocal?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cidade / Local de Atendimento é obrigatório',
        path: ['destinoCidadeLocal']
      })
    }
    if (abrangencia === 'NACIONAL') {
      if (!data.destinoUf) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'UF é obrigatória para atendimento Nacional', path: ['destinoUf'] })
      }
      if (data.destinoPaisCodigo) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Atendimento Nacional não deve informar País', path: ['destinoPaisCodigo'] })
      }
    }
    if (abrangencia === 'INTERNACIONAL') {
      if (!data.destinoPaisCodigo) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'País é obrigatório para atendimento Internacional', path: ['destinoPaisCodigo'] })
      }
      if (data.destinoUf) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Atendimento Internacional não deve informar UF', path: ['destinoUf'] })
      }
    }
    if (data.localId || data.espacoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Evento externo deve usar o destino informado, sem Local/Espaço da Regional SP',
        path: ['localId']
      })
    }
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

// ============================================================
// S09 — Refeições oferecidas por evento
// ============================================================

/**
 * Schema de criação/upsert de refeição para um evento.
 * O Worker consome este schema de @piedade/shared para evitar
 * dependência direta de zod no bundle Cloudflare Workers.
 */
export const EventoRefeicaoCreate = z.object({
  tipo: TipoRefeicao
})
export type EventoRefeicaoCreatePayload = z.infer<typeof EventoRefeicaoCreate>
