// S00 — Entry point do Cloudflare Worker
// Funcionalidades de negócio (reuniões, membros, convocações)
// serão implementadas a partir da Sprint S01, conforme autorização do PMO.
//
// RESSALVA PMO: Manter separação estrita entre código Node e código Worker.
// Este arquivo deve depender APENAS de APIs disponíveis no runtime Cloudflare.

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

// Bindings do Cloudflare Workers (configurados em wrangler.toml)
export interface Env {
  APP_ENV: string
  APP_VERSION: string
  DB: D1Database
}

import { drizzle } from 'drizzle-orm/d1'
import { regionaisRouter } from './routes/regionais'
import { administracoesRouter } from './routes/administracoes'
import { setoresRouter } from './routes/setores'
import { casasRouter } from './routes/casas'
import { gruposTrabalhoRouter } from './routes/grupos_trabalho'

export function createApp(injectedDb?: any) {
  const app = new Hono<{ Bindings: Env; Variables: { db: any } }>()

  // Middlewares globais
  app.use('*', logger())
  app.use(
    '/api/*',
    cors({
      origin: ['http://localhost:5173'], // Dev local — produção: configurar via variável
      allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    })
  )

  // ============================================================
  // Rotas de infraestrutura — S00
  // ============================================================

  app.get('/', c => {
    return c.json({
      app: 'Agenda Regional São Paulo',
      version: c.env?.APP_VERSION ?? '0.0.1-s00',
      sprint: 'S01',
      status: 'scaffolding',
    })
  })

  app.get('/health', c => {
    return c.json({
      healthy: true,
      env: c.env?.APP_ENV ?? 'unknown',
      ts: new Date().toISOString(),
    })
  })

  // ============================================================
  // Middlewares da API
  // ============================================================
  app.use('/api/v1/*', async (c, next) => {
    if (injectedDb) {
      c.set('db', injectedDb)
    } else if (!c.get('db') && c.env?.DB) {
      c.set('db', drizzle(c.env.DB))
    }
    await next()
  })

  // ============================================================
  // Rotas da API (S01)
  // ============================================================
  app.route('/api/v1/regionais', regionaisRouter)
  app.route('/api/v1/administracoes', administracoesRouter)
  app.route('/api/v1/setores', setoresRouter)
  app.route('/api/v1/casas', casasRouter)
  app.route('/api/v1/grupos-trabalho', gruposTrabalhoRouter)

  // 404 padrão
  app.notFound(c => {
    return c.json({ error: 'Rota não encontrada' }, 404)
  })

  return app
}

export default createApp()
