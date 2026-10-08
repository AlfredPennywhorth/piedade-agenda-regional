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

    sqlite.exec(`
      INSERT INTO regionais (id, nome, ativo)
      VALUES ('44444444-4444-4444-8444-444444444444', 'Regional Espaços', 1);

      INSERT INTO locais (id, nome, endereco, numero, cidade, uf, ativo)
      VALUES ('11111111-1111-4111-8111-111111111111', 'Complexo Brás', 'Rua Teste', '1', 'São Paulo', 'SP', 1),
             ('22222222-2222-4222-8222-222222222222', 'Outro Local', 'Rua Teste', '2', 'São Paulo', 'SP', 1);
    `)
  })

  it('permite espaço privado apenas no local do próprio usuário', async () => {
    const outro = await criarSessaoAutenticadaTeste(sqlite, 'espacos-outro')
    const local = await app.request('/api/v1/locais/particulares', mesclarAutorizacao(token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Local privado', endereco: 'Rua Privada', numero: '7', cidade: 'São Paulo', uf: 'SP' }),
    }))
    expect(local.status).toBe(201)
    const { id: localId } = await local.json() as any
    const outroPost = await app.request('/api/v1/espacos-locais/particulares', mesclarAutorizacao(outro.token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId, nome: 'Tentativa indevida' }),
    }))
    expect(outroPost.status).toBe(404)
    const meuPost = await app.request('/api/v1/espacos-locais/particulares', mesclarAutorizacao(token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId, nome: 'Sala de visita' }),
    }))
    expect(meuPost.status).toBe(201)
    const espaco = await meuPost.json() as any
    expect(espaco.proprietarioMembroId).toBe('espacos-local-membro')
    const listaOutro = await app.request('/api/v1/espacos-locais', mesclarAutorizacao(outro.token))
    expect((await listaOutro.json() as any[]).some(e => e.id === espaco.id)).toBe(false)
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

  it('impede mover um espaço para outro Local', async () => {
    const create = await app.request('/api/v1/espacos-locais', mesclarAutorizacao(token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        localId: '11111111-1111-4111-8111-111111111111',
        nome: '3º andar',
      }),
    }))
    expect(create.status).toBe(201)
    const criado = await create.json() as any

    const patch = await app.request(`/api/v1/espacos-locais/${criado.id}`, mesclarAutorizacao(token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: '22222222-2222-4222-8222-222222222222' }),
    }))

    expect(patch.status).toBe(409)
    expect((await patch.json() as any).code).toBe('ESPACO_LOCAL_IMUTAVEL')
  })

  it('permite editar evento existente que mantém referência histórica a espaço inativo', async () => {
    const dataEvento = new Date()
    dataEvento.setUTCDate(dataEvento.getUTCDate() + 30)
    const dataEventoIso = dataEvento.toISOString().slice(0, 10)

    sqlite.exec(`
      INSERT INTO espacos_local (id, local_id, nome, ativo)
      VALUES ('66666666-6666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111', 'Sala histórica', 0);

      INSERT INTO eventos (
        id, titulo, modalidade, inicio_em, fim_em, local_id, espaco_id, regional_id, ativo
      )
      VALUES (
        '77777777-7777-4777-8777-777777777777',
        'Evento histórico',
        'PRESENCIAL',
        '${dataEventoIso}T20:00:00.000Z',
        '${dataEventoIso}T21:00:00.000Z',
        '11111111-1111-4111-8111-111111111111',
        '66666666-6666-4666-8666-666666666666',
        '44444444-4444-4444-8444-444444444444',
        1
      );
    `)

    const res = await app.request(
      '/api/v1/eventos/77777777-7777-4777-8777-777777777777',
      mesclarAutorizacao(token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: 'Evento histórico ajustado' }),
      })
    )

    expect(res.status).toBe(200)
    expect((await res.json() as any).titulo).toBe('Evento histórico ajustado')
  })

  it('rejeita espaço inativo em uma nova série recorrente', async () => {
    sqlite.prepare(`
      INSERT INTO espacos_local (id, local_id, nome, ativo)
      VALUES ('88888888-8888-4888-8888-888888888888', '11111111-1111-4111-8111-111111111111', 'Sala aposentada', 0)
    `).run()

    const res = await app.request('/api/v1/series-recorrencia', mesclarAutorizacao(token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Série em espaço inativo',
        modalidade: 'PRESENCIAL',
        localId: '11111111-1111-4111-8111-111111111111',
        espacoId: '88888888-8888-4888-8888-888888888888',
        horarioInicio: '19:00',
        horarioFim: '20:00',
        dataInicio: '2026-10-01',
        dataFim: '2026-10-01',
        frequencia: 'DIARIA',
        intervalo: 1,
        regionalId: '44444444-4444-4444-8444-444444444444',
      }),
    }))

    expect(res.status).toBe(409)
    expect((await res.json() as any).code).toBe('ESPACO_INATIVO')
  })

  it('rejeita espaço inativo em um novo evento', async () => {
    sqlite.prepare(`
      INSERT INTO espacos_local (id, local_id, nome, ativo)
      VALUES ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'Sala desativada', 0)
    `).run()

    const res = await app.request('/api/v1/eventos', mesclarAutorizacao(token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Reunião em espaço inativo',
        modalidade: 'PRESENCIAL',
        inicioEm: '2026-10-01T20:00:00.000Z',
        fimEm: '2026-10-01T21:00:00.000Z',
        localId: '11111111-1111-4111-8111-111111111111',
        espacoId: '55555555-5555-4555-8555-555555555555',
        regionalId: '44444444-4444-4444-8444-444444444444',
      }),
    }))

    expect(res.status).toBe(409)
    expect((await res.json() as any).code).toBe('ESPACO_INATIVO')
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
        regionalId: '44444444-4444-4444-8444-444444444444',
      }),
    }))
    expect(res.status).toBe(400)
    expect((await res.json() as any).code).toBe('ESPACO_FORA_DO_LOCAL')
  })
})
