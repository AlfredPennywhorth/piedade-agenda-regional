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
  MASTER_BOOTSTRAP_SECRET: string
  DB: D1Database
  CORS_ORIGIN?: string
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
import { adminAcessosApp } from './routes/admin/acessos'
import { adminPreCadastrosMinisteriaisApp } from './routes/admin/pre-cadastros-ministeriais'
import { locaisRouter } from './routes/locais'
import { eventosRouter } from './routes/eventos'
import { eventoRefeicoesRouter } from './routes/evento-refeicoes'
import { seriesRecorrenciaRouter } from './routes/series-recorrencia'
import { convocacoesRouter } from './routes/convocacoes'
import { agendaRouter } from './routes/agenda'
import { rsvpRouter } from './routes/rsvp'
import { notificacoesRouter } from './routes/notificacoes'
import { checkinRouter } from './routes/checkin'
import { portariaRouter } from './routes/portaria'
import { portariaPublicaRouter } from './routes/portaria-publica'
import { relatoriosRouter } from './routes/relatorios'
import { auditoriaRouter } from './routes/auditoria'
import { bootstrapMasterApp } from './routes/bootstrap/master'
import { responsabilidadeRegionalApp } from './routes/governanca/responsabilidade-regional'
export interface AppOptions {
  enableAdminRoutes?: boolean
}

export function createApp(injectedDb?: any, options?: AppOptions) {
  const app = new Hono<{ Bindings: Env; Variables: { db: any } }>()

  // Middlewares globais
  app.use('*', logger())
  app.use('*', async (c, next) => {
    c.header(
      'Content-Security-Policy',
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
    )
    c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    c.header('X-Content-Type-Options', 'nosniff')
    c.header('X-Frame-Options', 'DENY')
    await next()
  })
  app.use(
    '/api/*',
    cors({
      origin: (origin, c) => {
        const allowed = c.env?.APP_ENV === 'development' ? ['http://localhost:5173'] : []
        const customOrigin = c.env?.CORS_ORIGIN
        if (customOrigin) {
          const origins = customOrigin
            .split(',')
            .map((o: string) => o.trim())
            .filter(Boolean)
          allowed.push(...origins)
        }
        return origin && allowed.includes(origin) ? origin : ''
      },
      allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    })
  )

  const noStore = async (c: any, next: any) => {
    c.header('Cache-Control', 'no-store')
    c.header('Pragma', 'no-cache')
    await next()
  }
  app.use('/api/v1/auth/*', noStore)
  app.use('/api/v1/membros/*', noStore)
  app.use('/api/v1/convocacoes/*', noStore)
  app.use('/api/v1/checkin/*', noStore)
  app.use('/api/v1/portaria/*', noStore)
  app.use('/api/v1/portaria-publica/*', noStore)
  app.use('/api/v1/relatorios/*', noStore)
  app.use('/api/v1/auditoria/*', noStore)
  app.use('/api/v1/bootstrap/*', noStore)
  app.use('/api/v1/governanca/*', noStore)
  app.use('/api/v1/admin/acessos/*', noStore)
  app.use('/api/v1/admin/pre-cadastros-ministeriais/*', noStore)

  // ============================================================
  // Rotas de infraestrutura — S00
  // ============================================================

  app.get('/', c => {
    return c.json({
      app: 'Agenda Regional São Paulo',
      version: c.env?.APP_VERSION ?? '0.0.1-s12',
      sprint: 'S12',
      status: 'operational',
    })
  })

  app.get('/health', c => {
    return c.json({
      healthy: true,
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
  // Rotas da API (S11 - Portaria e Check-in)
  // ============================================================
  app.route('/api/v1/checkin', checkinRouter)
  app.route('/api/v1/portaria', portariaRouter)
  app.route('/api/v1/portaria-publica', portariaPublicaRouter)

  // ============================================================
  // Rotas da API (S12 - Relatórios e Auditoria)
  // ============================================================
  app.route('/api/v1/relatorios', relatoriosRouter)
  app.route('/api/v1/auditoria', auditoriaRouter)

  // ============================================================
  // Rotas da API (S03 - Autenticação e Permissões)
  // ============================================================
  app.route('/api/v1/auth/ativar', ativacaoApp)
  app.route('/api/v1/auth/login', loginApp)
  app.route('/api/v1/auth/logout', logoutApp)
  app.route('/api/v1/auth/me', meApp)
  app.route('/api/v1/bootstrap/master', bootstrapMasterApp)
  app.route('/api/v1/governanca/responsabilidade-regional', responsabilidadeRegionalApp)
  app.route('/api/v1/admin/acessos', adminAcessosApp)
  app.route('/api/v1/admin/pre-cadastros-ministeriais', adminPreCadastrosMinisteriaisApp)

  if (options?.enableAdminRoutes) {
    app.route('/api/v1/admin/membros', adminMembrosApp)
  }

  // 404 padrão
  app.notFound(c => {
    return c.json({ error: 'Rota não encontrada' }, 404)
  })

  app.onError((_error, c) => {
    console.error('Erro interno da aplicação')
    return c.json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' }, 500)
  })

  return app
}

export default createApp()
