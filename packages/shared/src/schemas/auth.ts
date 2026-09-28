import { z } from 'zod'
import { normalizarCelular } from '../utils/celular'

// PIN deve ter exatamente 6 dígitos numéricos
export const pinSchema = z.string().regex(/^\d{6}$/, 'O PIN deve conter exatamente 6 dígitos numéricos.')

const celularSchema = z.string().min(1, 'Celular é obrigatório').superRefine((val, ctx) => {
  if (!normalizarCelular(val)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Formato de celular inválido' })
  }
}).transform(val => normalizarCelular(val) as string)

export const ativacaoSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  celular: celularSchema,
  pin: pinSchema,
  confirmacaoPin: z.string()
}).refine((data) => data.pin === data.confirmacaoPin, {
  message: 'O PIN e a confirmação não conferem',
  path: ['confirmacaoPin']
})

export const loginSchema = z.object({
  identificador: celularSchema,
  pin: pinSchema,
})

export const solicitarRecuperacaoPinSchema = z.object({
  celular: celularSchema,
})

export const atualizarPerfilSchema = z.object({
  celular: celularSchema,
  pinAtual: pinSchema,
})

export const alterarPinSchema = z.object({
  pinAtual: pinSchema,
  novoPin: pinSchema,
  confirmacaoNovoPin: pinSchema,
}).refine((data) => data.novoPin === data.confirmacaoNovoPin, {
  message: 'O novo PIN e a confirmação não conferem',
  path: ['confirmacaoNovoPin'],
}).refine((data) => data.pinAtual !== data.novoPin, {
  message: 'O novo PIN deve ser diferente do PIN atual',
  path: ['novoPin'],
})

export const linkAtivacaoAdminSchema = z.object({
  // Sem payload no corpo para geração por enquanto, apenas por ID na URL.
  // Podemos estender futuramente.
})
