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
    expect(json.sprint).toBe('S11')
    expect(json.status).toBe('operational')
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

  describe('CORS — Configuração de origens', () => {
    it('aceita origem padrão localhost:5173', async () => {
      const res = await app.request(
        '/api/v1/health',
        {
          method: 'OPTIONS',
          headers: {
            Origin: 'http://localhost:5173',
            'Access-Control-Request-Method': 'GET',
          },
        },
        env
      )

      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    })

    it('aceita origem adicional configurada via CORS_ORIGIN (ex: Codespaces)', async () => {
      const codespaceEnv = {
        ...env,
        CORS_ORIGIN: 'https://codespace-5173.app.github.dev',
      }
      const res = await app.request(
        '/api/v1/health',
        {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://codespace-5173.app.github.dev',
            'Access-Control-Request-Method': 'GET',
          },
        },
        codespaceEnv
      )

      expect(res.headers.get('access-control-allow-origin')).toBe(
        'https://codespace-5173.app.github.dev'
      )
    })
  })
})
