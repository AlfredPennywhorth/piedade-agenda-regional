import { describe, it, expect } from 'vitest'
import app, { createApp } from '../index'

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
    expect(json.sprint).toBe('S12')
    expect(json.status).toBe('operational')
  })

  it('GET /health retorna healthy: true', async () => {
    const res = await app.request('/health', {}, env)

    expect(res.status).toBe(200)

    const json = (await res.json()) as Record<string, unknown>

    expect(json.healthy).toBe(true)
    expect(typeof json.ts).toBe('string')
    expect(json.env).toBeUndefined()
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
        { ...env, APP_ENV: 'development' }
      )

      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
      expect(res.headers.get('access-control-allow-methods')).toContain('PUT')
      expect(res.headers.get('access-control-allow-methods')).toContain('DELETE')
      expect(res.headers.get('access-control-allow-headers')).toContain('Authorization')
      expect(res.headers.get('access-control-allow-headers')).toContain('Content-Type')
      expect(res.headers.get('access-control-expose-headers')).toContain('Retry-After')
      expect(res.headers.get('access-control-max-age')).toBe('600')
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

    it('não reflete origem arbitrária', async () => {
      const res = await app.request(
        '/api/v1/health',
        {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://origem-maliciosa.example',
            'Access-Control-Request-Method': 'GET',
          },
        },
        env
      )

      expect(res.headers.get('access-control-allow-origin')).toBeNull()
    })

    it('Beta aceita apenas a origem configurada e não localhost', async () => {
      const betaEnv = {
        ...env,
        APP_ENV: 'beta',
        CORS_ORIGIN: 'https://beta.piedade-agenda-regional.pages.dev',
      }

      const permitido = await app.request(
        '/api/v1/health',
        {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://beta.piedade-agenda-regional.pages.dev',
            'Access-Control-Request-Method': 'GET',
          },
        },
        betaEnv
      )
      expect(permitido.headers.get('access-control-allow-origin')).toBe(
        'https://beta.piedade-agenda-regional.pages.dev'
      )

      const localhost = await app.request(
        '/api/v1/health',
        {
          method: 'OPTIONS',
          headers: {
            Origin: 'http://localhost:5173',
            'Access-Control-Request-Method': 'GET',
          },
        },
        betaEnv
      )
      expect(localhost.headers.get('access-control-allow-origin')).toBeNull()
    })

    it('não permite localhost em produção sem CORS_ORIGIN explícita', async () => {
      const res = await app.request(
        '/api/v1/health',
        {
          method: 'OPTIONS',
          headers: {
            Origin: 'http://localhost:5173',
            'Access-Control-Request-Method': 'GET',
          },
        },
        { ...env, APP_ENV: 'production' }
      )

      expect(res.headers.get('access-control-allow-origin')).toBeNull()
    })
  })

  it('inclui headers de segurança nas respostas', async () => {
    const res = await app.request('/health', {}, env)

    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(res.headers.get('permissions-policy')).toBe('geolocation=(), microphone=(), camera=(self)')
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(res.headers.get('strict-transport-security')).toContain('max-age=31536000')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
  })

  it('protege toda a API contra cache, inclusive respostas 404', async () => {
    const res = await app.request('/api/v1/rota-inexistente', {}, env)

    expect(res.status).toBe(404)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('pragma')).toBe('no-cache')

    const json = (await res.json()) as Record<string, unknown>
    expect(json).toEqual({ error: 'Rota não encontrada', code: 'NOT_FOUND' })
  })

  it('não executa logger de requisição em Beta', async () => {
    const log = console.log
    let chamadas = 0
    console.log = () => {
      chamadas += 1
    }

    try {
      await app.request(
        '/api/v1/portaria-publica/cadastro/token-que-nao-deve-ser-logado',
        {},
        { ...env, APP_ENV: 'beta' }
      )
      expect(chamadas).toBe(0)
    } finally {
      console.log = log
    }
  })

  it('sanitiza exceções sem expor detalhes internos', async () => {
    const appComErro = createApp()
    appComErro.get('/erro-interno-teste', () => {
      throw new Error('SELECT segredo FROM tabela_interna')
    })

    const res = await appComErro.request('/erro-interno-teste', {}, env)
    const json = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(500)
    expect(json).toEqual({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' })
    expect(JSON.stringify(json)).not.toContain('SELECT')
  })
})
