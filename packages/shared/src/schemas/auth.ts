import { z } from 'zod'
import { normalizarCelular } from '../utils/celular'

// PIN deve ter exatamente 6 dígitos numéricos
export const pinSchema = z.string().regex(/^\d{6}$/, 'O PIN deve conter exatamente 6 dígitos numéricos.')

export const ativacaoSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  celular: z.string().min(1, 'Celular é obrigatório').superRefine((val, ctx) => {
    if (!normalizarCelular(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Formato de celular inválido' })
    }
  }).transform(val => normalizarCelular(val) as string),
  dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento deve estar no formato YYYY-MM-DD'),
  pin: pinSchema,
  confirmacaoPin: z.string()
}).refine((data) => data.pin === data.confirmacaoPin, {
  message: 'O PIN e a confirmação não conferem',
  path: ['confirmacaoPin']
})

export const loginSchema = z.object({
  identificador: z.string().min(1, 'Identificador é obrigatório').superRefine((val, ctx) => {
    if (!normalizarCelular(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Formato de celular inválido' })
    }
  }).transform(val => normalizarCelular(val) as string),
  pin: pinSchema,
})

export const linkAtivacaoAdminSchema = z.object({
  // Sem payload no corpo para geração por enquanto, apenas por ID na URL.
  // Podemos estender futuramente.
})
