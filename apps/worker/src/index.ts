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
  PIN_PEPPER: string
  DB: D1Database
}

import { drizzle } from 'drizzle-orm/d1'
import { regionaisRouter } from './routes/regionais'
import { administracoesRouter } from './routes/administracoes'
import { setoresRouter } from './routes/setores'
import { casasRouter } from './routes/casas'
import { gruposTrabalhoRouter } from './routes/grupos_trabalho'
import { membrosRouter } from './routes/membros'
import { funcoesRouter } from './routes/funcoes'
import { vinculosFuncionaisRouter } from './routes/vinculos_funcionais'
import { ativacaoApp } from './routes/auth/ativacao'
import { loginApp } from './routes/auth/login'
import { logoutApp } from './routes/auth/logout'
import { meApp } from './routes/auth/me'
import { adminMembrosApp } from './routes/admin/membros'
import { locaisRouter } from './routes/locais'
import { eventosRouter } from './routes/eventos'
import { eventoRefeicoesRouter } from './routes/evento-refeicoes'
import { seriesRecorrenciaRouter } from './routes/series-recorrencia'
import { convocacoesRouter } from './routes/convocacoes'
import { agendaRouter } from './routes/agenda'
import { rsvpRouter } from './routes/rsvp'
import { notificacoesRouter } from './routes/notificacoes'
export interface AppOptions {
  enableAdminRoutes?: boolean
}

export function createApp(injectedDb?: any, options?: AppOptions) {
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
      sprint: 'S02',
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
      const cfDb = c.env.DB
      c.set('db', drizzle(cfDb))
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

  // ============================================================
  // Rotas da API (S02)
  // ============================================================
  app.route('/api/v1/membros', membrosRouter)
  app.route('/api/v1/funcoes', funcoesRouter)
  app.route('/api/v1/vinculos-funcionais', vinculosFuncionaisRouter)

  // ============================================================
  // Rotas da API (S04 e S05 - Locais, Eventos e Recorrência)
  // ============================================================
  app.route('/api/v1/locais', locaisRouter)
  app.route('/api/v1/eventos', eventosRouter)
  app.route('/api/v1/eventos', eventoRefeicoesRouter)
  app.route('/api/v1/series-recorrencia', seriesRecorrenciaRouter)

  // ============================================================
  // Rotas da API (S06 - Convocações)
  // ============================================================
  app.route('/api/v1/convocacoes', convocacoesRouter)

  // ============================================================
  // Rotas da API (S07 e S08 - Agenda e RSVP)
  // ============================================================
  app.route('/api/v1/minha-agenda', agendaRouter)
  app.route('/api/v1/minha-agenda/rsvp', rsvpRouter)
  app.route('/api/v1/minha-agenda/notificacoes', notificacoesRouter)

  // ============================================================
  // Rotas da API (S03 - Autenticação e Permissões)
  // ============================================================
  app.route('/api/v1/auth/ativar', ativacaoApp)
  app.route('/api/v1/auth/login', loginApp)
  app.route('/api/v1/auth/logout', logoutApp)
  app.route('/api/v1/auth/me', meApp)

  if (options?.enableAdminRoutes) {
    app.route('/api/v1/admin/membros', adminMembrosApp)
  }

  // 404 padrão
  app.notFound(c => {
    return c.json({ error: 'Rota não encontrada' }, 404)
  })

  return app
}

export default createApp()
