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
