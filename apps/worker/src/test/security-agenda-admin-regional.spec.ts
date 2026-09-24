import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import { setupDb } from './setup'
import { hashToken } from '../security/tokens'

describe('PR-SEC-01 — Administrador Regional na gestão da Agenda', () => {
  let sqlite: any
  let app: any

  const ids = {
    regionalA: '11111111-1111-4111-8111-111111111111',
    regionalB: '22222222-2222-4222-8222-222222222222',
    admA: '33333333-3333-4333-8333-333333333333',
    admB: '44444444-4444-4444-8444-444444444444',
    setorA: '55555555-5555-4555-8555-555555555555',
    setorB: '66666666-6666-4666-8666-666666666666',
    casaA: '77777777-7777-4777-8777-777777777777',
    casaB: '88888888-8888-4888-8888-888888888888',
    membroAdminA: '99999999-9999-4999-8999-999999999999',
  }

  async function criarSessaoAdminRegionalA() {
    const contaId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const token = 'token-admin-regional-a'
    const tokenHash = await hashToken(token)

    sqlite.prepare(
      "INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES (?, ?, 'ATIVA', CURRENT_TIMESTAMP)"
    ).run(contaId, ids.membroAdminA)

    sqlite.prepare(
      "INSERT INTO acessos_conta (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id) VALUES (?, ?, 'ADMINISTRADOR_SISTEMA', 'REGIONAL', ?)"
    ).run('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', contaId, ids.regionalA)

    sqlite.prepare(`
      INSERT INTO sessoes
        (id, conta_acesso_id, membro_id, token_hash, expira_em, ultimo_acesso_em)
      VALUES (?, ?, ?, ?, '2099-01-01T00:00:00.000Z', CURRENT_TIMESTAMP)
    `).run('cccccccc-cccc-4ccc-8ccc-cccccccccccc', contaId, ids.membroAdminA, tokenHash)

    return token
  }

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    const db = drizzle(sqlite)
    setupDb(sqlite)
    app = createApp(db)

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES
        ('${ids.regionalA}', 'Regional A'),
        ('${ids.regionalB}', 'Regional B');

      INSERT INTO administracoes (id, regional_id, nome) VALUES
        ('${ids.admA}', '${ids.regionalA}', 'Administração A'),
        ('${ids.admB}', '${ids.regionalB}', 'Administração B');

      INSERT INTO setores (id, administracao_id, nome) VALUES
        ('${ids.setorA}', '${ids.admA}', 'Setor A'),
        ('${ids.setorB}', '${ids.admB}', 'Setor B');

      INSERT INTO casas (id, setor_id, nome) VALUES
        ('${ids.casaA}', '${ids.setorA}', 'Casa A'),
        ('${ids.casaB}', '${ids.setorB}', 'Casa B');

      INSERT INTO membros (id, nome, casa_id, ativo)
      VALUES ('${ids.membroAdminA}', 'Admin Regional A', '${ids.casaA}', 1);
    `)
  })

  const seriePayload = {
    titulo: 'Série Teste',
    modalidade: 'ONLINE',
    urlOnline: 'https://meet.google.com/teste',
    horarioInicio: '09:00',
    horarioFim: '10:00',
    dataInicio: '2030-01-01',
    dataFim: '2030-01-02',
    frequencia: 'DIARIA',
    intervalo: 1,
  }

  it('permite criar série na Regional administrada', async () => {
    const token = await criarSessaoAdminRegionalA()
    const res = await app.request(
      new Request('http://localhost/api/v1/series-recorrencia', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...seriePayload, regionalId: ids.regionalA }),
      })
    )

    expect(res.status).toBe(201)
  })

  it('nega criar série em outra Regional', async () => {
    const token = await criarSessaoAdminRegionalA()
    const res = await app.request(
      new Request('http://localhost/api/v1/series-recorrencia', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...seriePayload, regionalId: ids.regionalB }),
      })
    )

    expect(res.status).toBe(403)
  })

  it('permite criar evento em Setor descendente da Regional administrada', async () => {
    const token = await criarSessaoAdminRegionalA()
    const res = await app.request(
      new Request('http://localhost/api/v1/eventos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          titulo: 'Evento A',
          modalidade: 'ONLINE',
          urlOnline: 'https://meet.google.com/evento-a',
          inicioEm: '2030-02-01T12:00:00.000Z',
          fimEm: '2030-02-01T13:00:00.000Z',
          setorId: ids.setorA,
        }),
      })
    )

    expect(res.status).toBe(201)
  })

  it('nega criar evento em Casa de outra Regional', async () => {
    const token = await criarSessaoAdminRegionalA()
    const res = await app.request(
      new Request('http://localhost/api/v1/eventos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          titulo: 'Evento B',
          modalidade: 'ONLINE',
          urlOnline: 'https://meet.google.com/evento-b',
          inicioEm: '2030-02-02T12:00:00.000Z',
          fimEm: '2030-02-02T13:00:00.000Z',
          casaId: ids.casaB,
        }),
      })
    )

    expect(res.status).toBe(403)
  })
})
