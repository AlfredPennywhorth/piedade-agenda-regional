// PR-SEC-01 — regressão consolidada da fronteira autenticada
import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import { setupDb } from './setup'

describe('PR-SEC-01 — fronteira anônima das rotas administrativas', () => {
  let sqlite: Database.Database
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    app = createApp(drizzle(sqlite))
  })

  const leiturasProtegidas = [
    '/api/v1/regionais',
    '/api/v1/administracoes',
    '/api/v1/setores',
    '/api/v1/casas',
    '/api/v1/grupos-trabalho',
    '/api/v1/membros',
    '/api/v1/funcoes',
    '/api/v1/vinculos-funcionais',
    '/api/v1/locais',
    '/api/v1/series-recorrencia',
    '/api/v1/eventos',
    '/api/v1/convocacoes',
    '/api/v1/eventos/evento-inexistente/refeicoes',
  ] as const

  for (const path of leiturasProtegidas) {
    it(`GET ${path} retorna 401 sem sessão`, async () => {
      const res = await app.request(path)
      expect(res.status).toBe(401)
    })
  }

  const mutacoesProtegidas = [
    '/api/v1/regionais',
    '/api/v1/administracoes',
    '/api/v1/setores',
    '/api/v1/casas',
    '/api/v1/grupos-trabalho',
    '/api/v1/membros',
    '/api/v1/funcoes',
    '/api/v1/vinculos-funcionais',
    '/api/v1/locais',
    '/api/v1/series-recorrencia',
    '/api/v1/eventos',
    '/api/v1/convocacoes',
    '/api/v1/eventos/evento-inexistente/refeicoes',
  ] as const

  for (const path of mutacoesProtegidas) {
    it(`POST ${path} retorna 401 antes de validar payload`, async () => {
      const res = await app.request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      expect(res.status).toBe(401)
    })
  }

  it('PATCH de refeição retorna 401 antes de validar evento, item ou payload', async () => {
    const res = await app.request(
      '/api/v1/eventos/evento-inexistente/refeicoes/refeicao-inexistente',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }
    )
    expect(res.status).toBe(401)
  })
})
