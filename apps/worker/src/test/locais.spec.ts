import { describe, it, expect, beforeEach } from 'vitest'
import { Database } from 'better-sqlite3'
import { setupDb } from './setup'
import { createApp } from '../index'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import BetterSqlite3 from 'better-sqlite3'

describe('Locais API (S04)', () => {
  let sqlite: Database
  let db: any
  let app: any

  beforeEach(() => {
    sqlite = new BetterSqlite3(':memory:')
    setupDb(sqlite)
    db = drizzle(sqlite)
    app = createApp(db)
  })

  it('1. criar local válido', async () => {
    const payload = {
      nome: 'Local Teste',
      endereco: 'Rua Teste',
      numero: '123',
      cidade: 'São Paulo',
      uf: 'SP',
    }

    const res = await app.request('/api/v1/locais', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBeDefined()
    expect(json.nome).toBe('Local Teste')
    expect(json.ativo).toBe(true)
  })

  it('2. obter local', async () => {
    const payload = { nome: 'Local 2', endereco: 'Rua 2', numero: '2', cidade: 'SP', uf: 'SP' }
    const createRes = await app.request('/api/v1/locais', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const { id } = await createRes.json()

    const res = await app.request(`/api/v1/locais/${id}`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.nome).toBe('Local 2')
  })

  it('3. atualizar local', async () => {
    const payload = { nome: 'Local 3', endereco: 'Rua 3', numero: '3', cidade: 'SP', uf: 'SP' }
    const createRes = await app.request('/api/v1/locais', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const { id } = await createRes.json()

    const res = await app.request(`/api/v1/locais/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Local Atualizado', numero: 's/n' })
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.nome).toBe('Local Atualizado')
    expect(json.numero).toBe('s/n')
  })

  it('4. inativar local', async () => {
    const payload = { nome: 'Local 4', endereco: 'Rua 4', numero: '4', cidade: 'SP', uf: 'SP' }
    const createRes = await app.request('/api/v1/locais', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const { id } = await createRes.json()

    const res = await app.request(`/api/v1/locais/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: false })
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ativo).toBe(false)
  })

  it('5. rejeitar payload inválido', async () => {
    const payload = {
      // Faltam campos obrigatórios
      nome: 'Local Inválido',
    }

    const res = await app.request('/api/v1/locais', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    expect(res.status).toBe(400)
  })
})
