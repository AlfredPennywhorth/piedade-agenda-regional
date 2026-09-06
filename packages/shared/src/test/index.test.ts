import { describe, it, expect } from 'vitest'
import { AppInfo, ApiErrorSchema, HealthSchema, isApiError, RsvpUpsert } from '../index'

describe('Shared — AppInfo', () => {
  it('contém o nome correto da aplicação', () => {
    expect(AppInfo.name).toBe('Agenda Regional São Paulo')
  })

  it('identifica sprint S00', () => {
    expect(AppInfo.sprint).toBe('S00')
  })
})

describe('S08 - RSVP', () => {
  it('RsvpUpsert aceita PARTICIPAREI sem justificativa', () => {
    const result = RsvpUpsert.safeParse({ resposta: 'PARTICIPAREI' })
    expect(result.success).toBe(true)
  })

  it('RsvpUpsert rejeita NAO_PARTICIPAREI sem justificativa', () => {
    const result = RsvpUpsert.safeParse({ resposta: 'NAO_PARTICIPAREI' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Justificativa é obrigatória/)
    }
  })

  it('RsvpUpsert aceita NAO_PARTICIPAREI com justificativa', () => {
    const result = RsvpUpsert.safeParse({ resposta: 'NAO_PARTICIPAREI', justificativa: 'Motivo de teste' })
    expect(result.success).toBe(true)
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
