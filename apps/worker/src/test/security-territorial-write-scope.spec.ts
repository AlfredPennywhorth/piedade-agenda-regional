import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import { setupDb } from './setup'
import { hashToken } from '../security/tokens'

describe('PR-SEC-01 — escrita territorial por Regional', () => {
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
    membro: '99999999-9999-4999-8999-999999999999',
  }

  async function criarSessao(perfilCodigo: 'ADMINISTRADOR_SISTEMA' | 'MASTER_SISTEMA') {
    const contaId = crypto.randomUUID()
    const token = crypto.randomUUID()
    const tokenHash = await hashToken(token)

    sqlite.prepare(
      "INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES (?, ?, 'ATIVA', CURRENT_TIMESTAMP)"
    ).run(contaId, ids.membro)

    if (perfilCodigo === 'MASTER_SISTEMA') {
      sqlite.prepare(
        "INSERT INTO acessos_conta (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id) VALUES (?, ?, 'MASTER_SISTEMA', 'GLOBAL', NULL)"
      ).run(crypto.randomUUID(), contaId)
    } else {
      sqlite.prepare(
        "INSERT INTO acessos_conta (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id) VALUES (?, ?, 'ADMINISTRADOR_SISTEMA', 'REGIONAL', ?)"
      ).run(crypto.randomUUID(), contaId, ids.regionalA)
    }

    sqlite.prepare(`
      INSERT INTO sessoes
        (id, conta_acesso_id, membro_id, token_hash, expira_em, ultimo_acesso_em)
      VALUES (?, ?, ?, ?, '2099-01-01T00:00:00.000Z', CURRENT_TIMESTAMP)
    `).run(crypto.randomUUID(), contaId, ids.membro, tokenHash)

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
      VALUES ('${ids.membro}', 'Administrador A', '${ids.casaA}', 1);
    `)
  })

  it('Administrador Regional cria Administração somente na própria Regional', async () => {
    const token = await criarSessao('ADMINISTRADOR_SISTEMA')

    const ok = await app.request('/api/v1/administracoes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Nova Administração A', regionalId: ids.regionalA }),
    })
    expect(ok.status).toBe(201)
    const admCriada = await ok.json() as any
    const auditAdm = sqlite.prepare(
      "SELECT acao, escopo_tipo, escopo_id FROM auditoria_logs WHERE recurso_id = ?"
    ).get(admCriada.id) as any
    expect(auditAdm).toMatchObject({
      acao: 'ADMINISTRACAO_CRIADA',
      escopo_tipo: 'ADMINISTRACAO',
      escopo_id: admCriada.id,
    })

    const fora = await app.request('/api/v1/administracoes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Nova Administração B', regionalId: ids.regionalB }),
    })
    expect(fora.status).toBe(403)
  })

  it('Administrador Regional cria Setor, Casa e GT somente na própria Regional', async () => {
    const token = await criarSessao('ADMINISTRADOR_SISTEMA')
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    const setorOk = await app.request('/api/v1/setores', {
      method: 'POST', headers,
      body: JSON.stringify({ nome: 'Novo Setor A', administracaoId: ids.admA }),
    })
    expect(setorOk.status).toBe(201)
    const setorCriado = await setorOk.json() as any
    expect(sqlite.prepare(
      "SELECT acao, escopo_id FROM auditoria_logs WHERE recurso_id = ?"
    ).get(setorCriado.id)).toMatchObject({
      acao: 'SETOR_CRIADO',
      escopo_id: setorCriado.id,
    })

    expect((await app.request('/api/v1/setores', {
      method: 'POST', headers,
      body: JSON.stringify({ nome: 'Novo Setor B', administracaoId: ids.admB }),
    })).status).toBe(403)

    const casaOk = await app.request('/api/v1/casas', {
      method: 'POST', headers,
      body: JSON.stringify({ nome: 'Nova Casa A', setorId: ids.setorA }),
    })
    expect(casaOk.status).toBe(201)
    const casaCriada = await casaOk.json() as any
    expect(sqlite.prepare(
      "SELECT acao, escopo_id FROM auditoria_logs WHERE recurso_id = ?"
    ).get(casaCriada.id)).toMatchObject({
      acao: 'CASA_CRIADA',
      escopo_id: casaCriada.id,
    })

    expect((await app.request('/api/v1/casas', {
      method: 'POST', headers,
      body: JSON.stringify({ nome: 'Nova Casa B', setorId: ids.setorB }),
    })).status).toBe(403)

    const gtOk = await app.request('/api/v1/grupos-trabalho', {
      method: 'POST', headers,
      body: JSON.stringify({ nome: 'GT Regional A', regionalId: ids.regionalA }),
    })
    expect(gtOk.status).toBe(201)
    const gtCriado = await gtOk.json() as any
    expect(sqlite.prepare(
      "SELECT acao, escopo_id FROM auditoria_logs WHERE recurso_id = ?"
    ).get(gtCriado.id)).toMatchObject({
      acao: 'GRUPO_TRABALHO_CRIADO',
      escopo_id: gtCriado.id,
    })

    expect((await app.request('/api/v1/grupos-trabalho', {
      method: 'POST', headers,
      body: JSON.stringify({ nome: 'GT Regional B', regionalId: ids.regionalB }),
    })).status).toBe(403)
  })

  it('PATCH não permite mover Administração, Setor ou Casa para outra Regional', async () => {
    const token = await criarSessao('ADMINISTRADOR_SISTEMA')
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    expect((await app.request(`/api/v1/administracoes/${ids.admA}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ regionalId: ids.regionalB }),
    })).status).toBe(403)

    expect((await app.request(`/api/v1/setores/${ids.setorA}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ administracaoId: ids.admB }),
    })).status).toBe(403)

    expect((await app.request(`/api/v1/casas/${ids.casaA}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ setorId: ids.setorB }),
    })).status).toBe(403)

    const logsBloqueados = sqlite.prepare(
      "SELECT COUNT(*) AS total FROM auditoria_logs WHERE recurso_id IN (?, ?, ?)"
    ).get(ids.admA, ids.setorA, ids.casaA) as any
    expect(logsBloqueados.total).toBe(0)
  })

  it('Master audita criação de Regional no próprio escopo', async () => {
    const token = await criarSessao('MASTER_SISTEMA')
    const res = await app.request('/api/v1/regionais', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Regional Nova' }),
    })
    expect(res.status).toBe(201)
    const regional = await res.json() as any
    expect(sqlite.prepare(
      "SELECT acao, escopo_tipo, escopo_id FROM auditoria_logs WHERE recurso_id = ?"
    ).get(regional.id)).toMatchObject({
      acao: 'REGIONAL_CRIADA',
      escopo_tipo: 'REGIONAL',
      escopo_id: regional.id,
    })
  })

  it('Master mantém escrita global', async () => {
    const token = await criarSessao('MASTER_SISTEMA')
    const res = await app.request('/api/v1/administracoes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Administração Master B', regionalId: ids.regionalB }),
    })
    expect(res.status).toBe(201)
    const regional = await res.json() as any
    expect(sqlite.prepare(
      "SELECT acao, escopo_tipo, escopo_id FROM auditoria_logs WHERE recurso_id = ?"
    ).get(regional.id)).toMatchObject({
      acao: 'ADMINISTRACAO_CRIADA',
      escopo_tipo: 'ADMINISTRACAO',
      escopo_id: regional.id,
    })
  })
})
