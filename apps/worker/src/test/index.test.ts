import { describe, it, expect } from 'vitest'
import app from '../index'

const env = {
  APP_ENV: 'test',
  APP_VERSION: '0.0.1-test',
}

describe('Worker — Rotas de infraestrutura', () => {
  it('GET / retorna metadados da aplicação', async () => {
    const res = await app.request('/', {}, env)

    expect(res.status).toBe(200)

    const json = (await res.json()) as Record<string, unknown>

    expect(json.app).toBe('Agenda Regional São Paulo')
    expect(json.sprint).toBe('S02')
    expect(json.status).toBe('scaffolding')
  })

  it('GET /health retorna healthy: true', async () => {
    const res = await app.request('/health', {}, env)

    expect(res.status).toBe(200)

    const json = (await res.json()) as Record<string, unknown>

    expect(json.healthy).toBe(true)
    expect(typeof json.ts).toBe('string')
  })

  it('GET /api/v1 sem rota específica retorna 404', async () => {
    const res = await app.request('/api/v1', {}, env)

    expect(res.status).toBe(404)

    const json = (await res.json()) as Record<string, unknown>

    expect(json.error).toBeDefined()
  })

  it('Rota inexistente retorna 404', async () => {
    const res = await app.request('/rota-inexistente', {}, env)

    expect(res.status).toBe(404)

    const json = (await res.json()) as Record<string, unknown>

    expect(json.error).toBeDefined()
  })
})
