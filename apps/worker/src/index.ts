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
  // DB: D1Database  // Ativar após: wrangler d1 create piedade-agenda-db
}

const app = new Hono<{ Bindings: Env }>()

// Middlewares globais
app.use('*', logger())
app.use(
  '/api/*',
  cors({
    origin: ['http://localhost:5173'], // Dev local — produção: configurar via variável
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
)

// ============================================================
// Rotas de infraestrutura — S00
// ============================================================

app.get('/', c => {
  return c.json({
    app: 'Agenda Regional São Paulo',
    version: c.env.APP_VERSION ?? '0.0.1-s00',
    sprint: 'S00',
    status: 'scaffolding',
  })
})

app.get('/health', c => {
  return c.json({
    healthy: true,
    env: c.env.APP_ENV ?? 'unknown',
    ts: new Date().toISOString(),
  })
})

// ============================================================
// Placeholder de rota de API — aguarda Sprint S01
// ============================================================
app.get('/api/v1', c => {
  return c.json({
    message: 'API v1 — Sprint S01 pendente de autorização PMO',
    docs: '/docs',
  })
})

// 404 padrão
app.notFound(c => {
  return c.json({ error: 'Rota não encontrada' }, 404)
})

export default app
