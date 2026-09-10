// packages/shared — S00 Scaffolding
//
// Este pacote centraliza tipos, schemas Zod e constantes
// compartilhadas entre @piedade/web e @piedade/worker.
//
// GOVERNANÇA: Não adicionar regras de negócio sem aprovação do PMO.

import { z } from 'zod'

export * from './schemas/institucional'
export * from './schemas/membros'
export * from './utils/celular'
export * from './schemas/funcoes'
export * from './schemas/vinculos'
export * from './schemas/auth'
export * from './schemas/locais'
export * from './schemas/series'
export * from './schemas/eventos'
export * from './schemas/convocacoes'
export * from './schemas/notificacoes'
export * from './schemas/checkin'
export * from './utils/date-utils'
export * from './utils/recurrence-engine'


// ============================================================
// Metadados da aplicação
// ============================================================
export const AppInfo = {
  name: 'Agenda Regional São Paulo',
  version: '0.0.1-s11',
  sprint: 'S11',
} as const

// ============================================================
// Schemas base — S00: apenas scaffolding
// Schemas de negócio (membros, reuniões, convocações) aguardam Sprint S01
// ============================================================

/** Schema de resposta padrão de erro da API */
export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
})
export type ApiError = z.infer<typeof ApiErrorSchema>

/** Schema de resposta padrão de sucesso da API */
export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: z
      .object({
        page: z.number().optional(),
        total: z.number().optional(),
      })
      .optional(),
  })

/** Schema de health check */
export const HealthSchema = z.object({
  healthy: z.boolean(),
  env: z.string(),
  ts: z.string().datetime(),
})
export type Health = z.infer<typeof HealthSchema>

// ============================================================
// Utilitários
// ============================================================

/** Verifica se o objeto é um erro da API */
export function isApiError(value: unknown): value is ApiError {
  return ApiErrorSchema.safeParse(value).success
}
