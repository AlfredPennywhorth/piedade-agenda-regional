import { beforeEach, describe, expect, it } from 'vitest'
import BetterSqlite3, { Database } from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import { setupDb } from './setup'
import { criarSessaoAutenticadaTeste, mesclarAutorizacao } from './auth-test-helper'

describe('Espaços de Local', () => {
  let sqlite: Database
  let app: any
  let token = ''

  beforeEach(async () => {
    sqlite = new BetterSqlite3(':memory:')
    setupDb(sqlite)
    app = createApp(drizzle(sqlite))
    token = (await criarSessaoAutenticadaTeste(sqlite, 'espacos-local')).token

    sqlite.prepare(`
      INSERT INTO locais (id, nome, endereco, numero, cidade, uf, ativo)
      VALUES ('11111111-1111-4111-8111-111111111111', 'Complexo Brás', 'Rua Teste', '1', 'São Paulo', 'SP', 1),
             ('22222222-2222-4222-8222-222222222222', 'Outro Local', 'Rua Teste', '2', 'São Paulo', 'SP', 1)
    `).run()
  })

  it('cria, lista e edita um espaço vinculado ao Local', async () => {
    const create = await app.request('/api/v1/espacos-locais', mesclarAutorizacao(token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        localId: '11111111-1111-4111-8111-111111111111',
        nome: 'Salão de Reunião',
        capacidade: 120,
      }),
    }))
    expect(create.status).toBe(201)
    const criado = await create.json() as any
    expect(criado.nome).toBe('Salão de Reunião')

    const list = await app.request(
      '/api/v1/espacos-locais?localId=11111111-1111-4111-8111-111111111111',
      mesclarAutorizacao(token)
    )
    expect(list.status).toBe(200)
    const itens = await list.json() as any[]
    expect(itens).toHaveLength(1)

    const patch = await app.request(`/api/v1/espacos-locais/${criado.id}`, mesclarAutorizacao(token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Sala A' }),
    }))
    expect(patch.status).toBe(200)
    expect((await patch.json() as any).nome).toBe('Sala A')
  })

  it('não permite dois espaços ativos com o mesmo nome no mesmo Local', async () => {
    const payload = {
      localId: '11111111-1111-4111-8111-111111111111',
      nome: 'Templo',
    }
    const primeiro = await app.request('/api/v1/espacos-locais', mesclarAutorizacao(token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }))
    expect(primeiro.status).toBe(201)

    const segundo = await app.request('/api/v1/espacos-locais', mesclarAutorizacao(token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }))
    expect(segundo.status).toBe(409)
  })

  it('rejeita evento quando o espaço não pertence ao Local informado', async () => {
    sqlite.prepare(`
      INSERT INTO espacos_local (id, local_id, nome, ativo)
      VALUES ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'Sala B', 1)
    `).run()

    const res = await app.request('/api/v1/eventos', mesclarAutorizacao(token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Reunião Teste',
        modalidade: 'PRESENCIAL',
        inicioEm: '2026-10-01T20:00:00.000Z',
        fimEm: '2026-10-01T21:00:00.000Z',
        localId: '11111111-1111-4111-8111-111111111111',
        espacoId: '33333333-3333-4333-8333-333333333333',
        casaId: 'espacos-local-casa',
      }),
    }))
    expect(res.status).toBe(400)
    expect((await res.json() as any).code).toBe('ESPACO_FORA_DO_LOCAL')
  })
})
