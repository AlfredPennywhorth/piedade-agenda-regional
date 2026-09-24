import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import { setupDb } from './setup'
import { hashToken } from '../security/tokens'

describe('PR-SEC-01 — leitura de séries por escopo sem N+1', () => {
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
  }

  async function criarSessao(perfil?: {
    codigo: string
    escopoTipo: 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO'
    escopoId: string
  }) {
    const contaId = crypto.randomUUID()
    const token = crypto.randomUUID()
    const tokenHash = await hashToken(token)

    sqlite.prepare(
      "INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES (?, ?, 'ATIVA', CURRENT_TIMESTAMP)"
    ).run(contaId, ids.membroA)

    if (perfil) {
      sqlite.prepare(
        'INSERT INTO acessos_conta (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id) VALUES (?, ?, ?, ?, ?)'
      ).run(crypto.randomUUID(), contaId, perfil.codigo, perfil.escopoTipo, perfil.escopoId)
    }

    sqlite.prepare(`
      INSERT INTO sessoes
        (id, conta_acesso_id, membro_id, token_hash, expira_em, ultimo_acesso_em)
      VALUES (?, ?, ?, ?, '2099-01-01T00:00:00.000Z', CURRENT_TIMESTAMP)
    `).run(crypto.randomUUID(), contaId, ids.membroA, tokenHash)

    return token
  }

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    app = createApp(drizzle(sqlite))

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

      INSERT INTO series_recorrencia
        (id, titulo, modalidade, frequencia, intervalo, data_inicio, data_fim,
         horario_inicio, horario_fim, timezone, casa_id, ativo)
      VALUES
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Série Casa A', 'ONLINE', 'DIARIA', 1,
         '2030-01-01', '2030-01-02', '09:00', '10:00', 'America/Sao_Paulo', '${ids.casaA}', 1);

      INSERT INTO series_recorrencia
        (id, titulo, modalidade, frequencia, intervalo, data_inicio, data_fim,
         horario_inicio, horario_fim, timezone, regional_id, ativo)
      VALUES
        ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Série Regional A', 'ONLINE', 'DIARIA', 1,
         '2030-01-01', '2030-01-02', '09:00', '10:00', 'America/Sao_Paulo', '${ids.regionalA}', 1),
        ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Série Regional B', 'ONLINE', 'DIARIA', 1,
         '2030-01-01', '2030-01-02', '09:00', '10:00', 'America/Sao_Paulo', '${ids.regionalB}', 1);
    `)
  })

  it('usuário comum vê apenas a série da própria Casa', async () => {
    const token = await criarSessao()
    const res = await app.request('/api/v1/series-recorrencia', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ titulo: string }>
    expect(body.map(item => item.titulo)).toEqual(['Série Casa A'])
  })

  it('Administrador Regional vê séries da própria Regional e descendentes, não da outra', async () => {
    const token = await criarSessao({
      codigo: 'ADMINISTRADOR_SISTEMA',
      escopoTipo: 'REGIONAL',
      escopoId: ids.regionalA,
    })

    const res = await app.request('/api/v1/series-recorrencia', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ titulo: string }>
    const titulos = body.map(item => item.titulo).sort()
    expect(titulos).toEqual(['Série Casa A', 'Série Regional A'])
    expect(titulos).not.toContain('Série Regional B')
  })

  it('Gestor de Agenda Regional também herda os descendentes da própria Regional', async () => {
    const token = await criarSessao({
      codigo: 'GESTOR_AGENDA',
      escopoTipo: 'REGIONAL',
      escopoId: ids.regionalA,
    })

    const res = await app.request('/api/v1/series-recorrencia', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as Array<{ titulo: string }>
    const titulos = body.map(item => item.titulo).sort()
    expect(titulos).toEqual(['Série Casa A', 'Série Regional A'])
  })
})
