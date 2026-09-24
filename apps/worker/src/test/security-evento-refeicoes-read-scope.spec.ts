import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import { setupDb } from './setup'
import { hashToken } from '../security/tokens'

describe('PR-SEC-01 — leitura de refeições por escopo do evento', () => {
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
    membroA: '99999999-9999-4999-8999-999999999999',
    eventoA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    eventoB: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  }

  async function criarSessao() {
    const contaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const token = 'token-refeicoes-a'
    const tokenHash = await hashToken(token)

    sqlite.prepare(
      "INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES (?, ?, 'ATIVA', CURRENT_TIMESTAMP)"
    ).run(contaId, ids.membroA)

    sqlite.prepare(`
      INSERT INTO sessoes
        (id, conta_acesso_id, membro_id, token_hash, expira_em, ultimo_acesso_em)
      VALUES (?, ?, ?, ?, '2099-01-01T00:00:00.000Z', CURRENT_TIMESTAMP)
    `).run('dddddddd-dddd-4ddd-8ddd-dddddddddddd', contaId, ids.membroA, tokenHash)

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
      VALUES ('${ids.membroA}', 'Membro A', '${ids.casaA}', 1);

      INSERT INTO eventos
        (id, titulo, modalidade, inicio_em, fim_em, regional_id, ativo)
      VALUES
        ('${ids.eventoA}', 'Evento A', 'ONLINE', '2030-01-01T12:00:00.000Z', '2030-01-01T13:00:00.000Z', '${ids.regionalA}', 1),
        ('${ids.eventoB}', 'Evento B', 'ONLINE', '2030-01-02T12:00:00.000Z', '2030-01-02T13:00:00.000Z', '${ids.regionalB}', 1);

      INSERT INTO evento_refeicoes (id, evento_id, tipo, ativo)
      VALUES
        ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '${ids.eventoA}', 'ALMOCO', 1),
        ('ffffffff-ffff-4fff-8fff-ffffffffffff', '${ids.eventoB}', 'JANTAR', 1);
    `)
  })

  it('permite consultar refeições de evento no escopo territorial do membro', async () => {
    const token = await criarSessao()
    const res = await app.request(
      new Request(`http://localhost/api/v1/eventos/${ids.eventoA}/refeicoes`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ tipo: string }>
    expect(body.map(item => item.tipo)).toContain('ALMOCO')
  })

  it('bloqueia refeições de evento de outra Regional', async () => {
    const token = await criarSessao()
    const res = await app.request(
      new Request(`http://localhost/api/v1/eventos/${ids.eventoB}/refeicoes`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    )

    expect(res.status).toBe(403)
  })

  it('preserva leitura quando o membro é organizador do evento externo', async () => {
    const token = await criarSessao()
    sqlite.prepare('UPDATE eventos SET organizador_membro_id = ? WHERE id = ?')
      .run(ids.membroA, ids.eventoB)

    const res = await app.request(
      new Request(`http://localhost/api/v1/eventos/${ids.eventoB}/refeicoes`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    )

    expect(res.status).toBe(200)
  })
})
