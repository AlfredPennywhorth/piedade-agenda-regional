import { z } from 'zod'
import { ModalidadeEvento } from './eventos'

export const FrequenciaSerie = z.enum([
  'DIARIA',
  'SEMANAL',
  'QUINZENAL',
  'MENSAL_DIA_FIXO',
  'MENSAL_POSICAO_SEMANA'
])

export type FrequenciaSerieEnum = z.infer<typeof FrequenciaSerie>

const HttpUrl = z.string().url('URL inválida').refine(
  val => val.startsWith('http://') || val.startsWith('https://'), 
  { message: 'URL deve usar protocolo http ou https' }
)

const baseSerie = {
  titulo: z.string().min(1, 'Título é obrigatório'),
  descricao: z.string().nullable().optional(),
  pauta: z.string().nullable().optional(),
  modalidade: ModalidadeEvento,
  
  frequencia: FrequenciaSerie,
  intervalo: z.number().int().min(1).default(1),
  
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato deve ser YYYY-MM-DD'),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato deve ser YYYY-MM-DD'),
  horarioInicio: z.string().regex(/^([0-1]\d|2[0-3]):[0-5]\d$/, 'Formato deve ser HH:MM'),
  horarioFim: z.string().regex(/^([0-1]\d|2[0-3]):[0-5]\d$/, 'Formato deve ser HH:MM'),
  
  diaSemana: z.number().int().min(0).max(6).nullable().optional(),
  diaMes: z.number().int().min(1).max(31).nullable().optional(),
  posicaoSemanaMes: z.number().int().refine(val => (val >= 1 && val <= 5) || val === -1, 'Deve ser entre 1 e 5, ou -1 para último').nullable().optional(),

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

const serieSuperRefine = (data: any, ctx: z.RefinementCtx) => {
  // 1. Validar fim > inicio para datas e horários
  if (data.dataFim < data.dataInicio) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Data de fim não pode ser anterior à data de início', path: ['dataFim'] })
  }
  if (data.horarioFim <= data.horarioInicio) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Horário de fim deve ser posterior ao horário de início', path: ['horarioFim'] })
  }

  // 2. Validar campos específicos de cada frequência
  if (data.frequencia === 'SEMANAL' || data.frequencia === 'QUINZENAL') {
    if (data.diaSemana === undefined || data.diaSemana === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'diaSemana é obrigatório para frequência semanal/quinzenal', path: ['diaSemana'] })
    }
  } else if (data.frequencia === 'MENSAL_DIA_FIXO') {
    if (!data.diaMes) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'diaMes é obrigatório para frequência mensal por dia fixo', path: ['diaMes'] })
    }
  } else if (data.frequencia === 'MENSAL_POSICAO_SEMANA') {
    if (data.diaSemana === undefined || data.diaSemana === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'diaSemana é obrigatório para esta frequência', path: ['diaSemana'] })
    }
    if (!data.posicaoSemanaMes) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'posicaoSemanaMes é obrigatório para esta frequência', path: ['posicaoSemanaMes'] })
    }
  }

  // 3. Validar Modalidade
  if (data.modalidade === 'PRESENCIAL' && !data.localId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Eventos presenciais exigem localId', path: ['localId'] })
  } else if (data.modalidade === 'ONLINE') {
    if (!data.urlOnline) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Eventos online exigem urlOnline', path: ['urlOnline'] })
    }
    if (data.localId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Eventos online não devem ter localId', path: ['localId'] })
    }
  } else if (data.modalidade === 'HIBRIDO') {
    if (!data.localId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Eventos híbridos exigem localId', path: ['localId'] })
    if (!data.urlOnline) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Eventos híbridos exigem urlOnline', path: ['urlOnline'] })
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
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A série deve ter exatamente um escopo institucional', path: ['escopo'] })
  }
}

export const SerieCreate = z.object(baseSerie).superRefine(serieSuperRefine)
export type SerieCreateInput = z.infer<typeof SerieCreate>

export const SerieUpdateMode = z.enum(['THIS', 'THIS_AND_FUTURE', 'ALL'])
export type SerieUpdateModeEnum = z.infer<typeof SerieUpdateMode>

export const SerieUpdatePayload = z.object({
  updateMode: SerieUpdateMode,
  fromEventId: z.string().uuid('ID do evento de origem inválido').optional(), // Obrigatório para THIS e THIS_AND_FUTURE
  changes: z.object(baseSerie).partial(),
}).superRefine((data: any, ctx: z.RefinementCtx) => {
  if (data.updateMode !== 'ALL' && !data.fromEventId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'fromEventId é obrigatório para edição com escopo THIS ou THIS_AND_FUTURE', path: ['fromEventId'] })
  }
})
export type SerieUpdatePayloadInput = z.infer<typeof SerieUpdatePayload>
