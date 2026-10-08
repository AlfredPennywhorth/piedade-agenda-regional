import { describe, it, expect, beforeEach } from 'vitest'
import { Database } from 'better-sqlite3'
import { setupDb } from './setup'
import { createApp } from '../index'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import BetterSqlite3 from 'better-sqlite3'
import { criarSessaoAutenticadaTeste, mesclarAutorizacao } from './auth-test-helper'

describe('Locais API (S04)', () => {
  let sqlite: Database
  let db: any
  let app: any
  let authToken = ''

  beforeEach(async () => {
    sqlite = new BetterSqlite3(':memory:')
    setupDb(sqlite)
    db = drizzle(sqlite)
    app = createApp(db)
    authToken = (await criarSessaoAutenticadaTeste(sqlite, 'locais-auth')).token
  })

  it('local particular pertence ao criador e não é visível nem ao outro Master', async () => {
    const segundo = await criarSessaoAutenticadaTeste(sqlite, 'locais-outra-conta')
    const payload = { nome: 'Minha sala particular', endereco: 'Rua Particular', numero: '15', cidade: 'São Paulo', uf: 'SP' }
    const criadoRes = await app.request('/api/v1/locais/particulares', mesclarAutorizacao(authToken, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }))
    expect(criadoRes.status).toBe(201)
    const criado = await criadoRes.json() as any
    expect(criado.proprietarioMembroId).toBe('locais-auth-membro')
    const outrosRes = await app.request('/api/v1/locais', mesclarAutorizacao(segundo.token))
    expect((await outrosRes.json() as any[]).some(l => l.id === criado.id)).toBe(false)
    const detalhe = await app.request(`/api/v1/locais/${criado.id}`, mesclarAutorizacao(segundo.token))
    expect(detalhe.status).toBe(404)
    const meuDetalhe = await app.request(`/api/v1/locais/${criado.id}`, mesclarAutorizacao(authToken))
    expect(meuDetalhe.status).toBe(200)
    const edicaoInstitucional = await app.request(`/api/v1/locais/${criado.id}`, mesclarAutorizacao(authToken, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: 'Tentativa institucional' }),
    }))
    expect(edicaoInstitucional.status).toBe(404)
    expect(() => sqlite.prepare(`
      INSERT INTO eventos(id,titulo,modalidade,inicio_em,fim_em,local_id,regional_id,pessoal,criador_membro_id)
      VALUES('evento-institucional-privado','Teste','PRESENCIAL','2030-10-10T10:00:00Z','2030-10-10T11:00:00Z', ?, ?, 0, ?)
    `).run(criado.id, 'locais-auth-regional', 'locais-auth-membro')).toThrow()
    expect(() => sqlite.prepare(`
      INSERT INTO eventos(id,titulo,modalidade,inicio_em,fim_em,local_id,casa_id,pessoal,criador_membro_id)
      VALUES('evento-pessoal-terceiro','Teste','PRESENCIAL','2030-10-10T10:00:00Z','2030-10-10T11:00:00Z', ?, ?, 1, ?)
    `).run(criado.id, 'locais-outra-conta-casa', 'locais-outra-conta-membro')).toThrow()
    sqlite.prepare(`
      INSERT INTO eventos(id,titulo,modalidade,inicio_em,fim_em,local_id,casa_id,pessoal,criador_membro_id)
      VALUES('evento-pessoal-dono','Teste','PRESENCIAL','2030-10-10T10:00:00Z','2030-10-10T11:00:00Z', ?, ?, 1, ?)
    `).run(criado.id, 'locais-auth-casa', 'locais-auth-membro')
  })

  it('1. criar local válido', async () => {
    const payload = {
      nome: 'Local Teste',
      endereco: 'Rua Teste',
      numero: '123',
      cidade: 'São Paulo',
      uf: 'SP',
    }

    const res = await app.request('/api/v1/locais', mesclarAutorizacao(authToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }))

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBeDefined()
    expect(json.nome).toBe('Local Teste')
    expect(json.ativo).toBe(true)

    const audit = sqlite.prepare(
      "SELECT acao, recurso_tipo, recurso_id FROM auditoria_logs WHERE recurso_id = ?"
    ).get(json.id) as any
    expect(audit.acao).toBe('LOCAL_CRIADO')
    expect(audit.recurso_tipo).toBe('LOCAL')
  })

  it('2. obter local', async () => {
    const payload = { nome: 'Local 2', endereco: 'Rua 2', numero: '2', cidade: 'SP', uf: 'SP' }
    const createRes = await app.request('/api/v1/locais', mesclarAutorizacao(authToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }))
    const { id } = await createRes.json()

    const res = await app.request(`/api/v1/locais/${id}`, mesclarAutorizacao(authToken))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.nome).toBe('Local 2')
  })

  it('3. atualizar local', async () => {
    const payload = { nome: 'Local 3', endereco: 'Rua 3', numero: '3', cidade: 'SP', uf: 'SP' }
    const createRes = await app.request('/api/v1/locais', mesclarAutorizacao(authToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }))
    const { id } = await createRes.json()

    const res = await app.request(`/api/v1/locais/${id}`, mesclarAutorizacao(authToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Local Atualizado', numero: 's/n' })
    }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.nome).toBe('Local Atualizado')
    expect(json.numero).toBe('s/n')

    const audit = sqlite.prepare(
      "SELECT acao FROM auditoria_logs WHERE recurso_id = ? ORDER BY criado_em DESC LIMIT 1"
    ).get(id) as any
    expect(audit.acao).toBe('LOCAL_ATUALIZADO')
  })

  it('4. inativar local', async () => {
    const payload = { nome: 'Local 4', endereco: 'Rua 4', numero: '4', cidade: 'SP', uf: 'SP' }
    const createRes = await app.request('/api/v1/locais', mesclarAutorizacao(authToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }))
    const { id } = await createRes.json()

    const res = await app.request(`/api/v1/locais/${id}`, mesclarAutorizacao(authToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: false })
    }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ativo).toBe(false)
  })

  it('5. rejeitar payload inválido', async () => {
    const payload = {
      // Faltam campos obrigatórios
      nome: 'Local Inválido',
    }

    const res = await app.request('/api/v1/locais', mesclarAutorizacao(authToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }))

    expect(res.status).toBe(400)
  })

  // =========================================================================
  // URL PROTOCOL TESTS (S04 Corrreções)
  // =========================================================================
  it('URL https válida no local', async () => {
    const res = await app.request('/api/v1/locais', mesclarAutorizacao(authToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Local Teste',
        endereco: 'Rua Teste',
        numero: '123',
        cidade: 'São Paulo',
        uf: 'SP',
        urlMaps: 'https://maps.google.com/abc'
      })
    }))
    expect(res.status).toBe(201)
  })

  it('URL http válida no local', async () => {
    const res = await app.request('/api/v1/locais', mesclarAutorizacao(authToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Local Teste',
        endereco: 'Rua Teste',
        numero: '123',
        cidade: 'São Paulo',
        uf: 'SP',
        urlMaps: 'http://maps.google.com/abc'
      })
    }))
    expect(res.status).toBe(201)
  })

  it('URL ftp inválida no local', async () => {
    const res = await app.request('/api/v1/locais', mesclarAutorizacao(authToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Local Teste',
        endereco: 'Rua Teste',
        numero: '123',
        cidade: 'São Paulo',
        uf: 'SP',
        urlMaps: 'ftp://maps.google.com/abc'
      })
    }))
    expect(res.status).toBe(400)
  })
})
