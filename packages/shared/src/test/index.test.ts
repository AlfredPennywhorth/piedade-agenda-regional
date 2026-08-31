import { describe, it, expect } from 'vitest'
import { AppInfo, ApiErrorSchema, HealthSchema, isApiError } from '../index'

describe('Shared — AppInfo', () => {
  it('contém o nome correto da aplicação', () => {
    expect(AppInfo.name).toBe('Agenda Regional São Paulo')
  })

  it('identifica sprint S00', () => {
    expect(AppInfo.sprint).toBe('S00')
  })
})

describe('Shared — ApiErrorSchema', () => {
  it('valida erro simples', () => {
    const result = ApiErrorSchema.safeParse({ error: 'Não encontrado' })
    expect(result.success).toBe(true)
  })

  it('rejeita objeto sem campo error', () => {
    const result = ApiErrorSchema.safeParse({ code: '404' })
    expect(result.success).toBe(false)
  })
})

describe('Shared — HealthSchema', () => {
  it('valida resposta de health check', () => {
    const result = HealthSchema.safeParse({
      healthy: true,
      env: 'development',
      ts: new Date().toISOString(),
    })
    expect(result.success).toBe(true)
  })
})

describe('Shared — isApiError', () => {
  it('detecta erro de API corretamente', () => {
    expect(isApiError({ error: 'Falha' })).toBe(true)
    expect(isApiError({ success: true })).toBe(false)
    expect(isApiError(null)).toBe(false)
  })
})
