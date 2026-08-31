import { describe, it, expect } from 'vitest'
import app from '../index'

describe('Worker — Rotas S00', () => {
  it('GET / retorna metadados da aplicação', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
    const json = (await res.json()) as Record<string, unknown>
    expect(json.app).toBe('Agenda Regional São Paulo')
    expect(json.sprint).toBe('S00')
    expect(json.status).toBe('scaffolding')
  })

  it('GET /health retorna healthy: true', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const json = (await res.json()) as Record<string, unknown>
    expect(json.healthy).toBe(true)
    expect(typeof json.ts).toBe('string')
  })

  it('GET /api/v1 retorna placeholder de API', async () => {
    const res = await app.request('/api/v1')
    expect(res.status).toBe(200)
    const json = (await res.json()) as Record<string, unknown>
    expect(json.message).toContain('Sprint S01')
  })

  it('Rota inexistente retorna 404', async () => {
    const res = await app.request('/rota-inexistente')
    expect(res.status).toBe(404)
    const json = (await res.json()) as Record<string, unknown>
    expect(json.error).toBeDefined()
  })
})
