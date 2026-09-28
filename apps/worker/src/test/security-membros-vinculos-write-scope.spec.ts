import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import { setupDb } from './setup'
import { hashToken } from '../security/tokens'
import { registrarCienciaPmo } from './responsabilidade-pmo-test-helper'

describe('PR-SEC-01 — escrita de Membros e Vínculos por Regional', () => {
  let sqlite: any
  let app: any

  const id = {
    regionalA: '11111111-1111-4111-8111-111111111111',
    regionalB: '22222222-2222-4222-8222-222222222222',
    admA: '33333333-3333-4333-8333-333333333333',
    admA2: '34343434-3434-4434-8434-343434343434',
    admB: '44444444-4444-4444-8444-444444444444',
    setorA: '55555555-5555-4555-8555-555555555555',
    setorA2: '56565656-5656-4656-8656-565656565656',
    setorB: '66666666-6666-4666-8666-666666666666',
    casaA: '77777777-7777-4777-8777-777777777777',
    casaA2: '78787878-7878-4787-8787-787878787878',
    casaB: '88888888-8888-4888-8888-888888888888',
    adminA: '99999999-9999-4999-8999-999999999999',
    comumA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    comumB: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    funcao: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    vinculoA: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    vinculoB: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  }

  async function criarSessaoAdminA() {
    const contaId = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    const token = 'token-admin-regional-a'
    const tokenHash = await hashToken(token)

    sqlite.prepare(
      "INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES (?, ?, 'ATIVA', CURRENT_TIMESTAMP)"
    ).run(contaId, id.adminA)

    const acessoId = '12121212-1212-4212-8212-121212121212'
    sqlite.prepare(`
      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id, ativo)
      VALUES (?, ?, 'ADMINISTRADOR_SISTEMA', 'REGIONAL', ?, 1)
    `).run(acessoId, contaId, id.regionalA)
    registrarCienciaPmo(sqlite, contaId, acessoId)

    sqlite.prepare(`
      INSERT INTO sessoes
        (id, conta_acesso_id, membro_id, token_hash, expira_em, ultimo_acesso_em)
      VALUES (?, ?, ?, ?, '2099-01-01T00:00:00.000Z', CURRENT_TIMESTAMP)
    `).run('13131313-1313-4313-8313-131313131313', contaId, id.adminA, tokenHash)

    return token
  }

  function req(token: string, path: string, options?: RequestInit) {
    const headers = new Headers(options?.headers)
    headers.set('Authorization', `Bearer ${token}`)
    if (options?.body) headers.set('Content-Type', 'application/json')
    return app.request(new Request(`http://localhost${path}`, { ...options, headers }))
  }

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    const db = drizzle(sqlite)
    setupDb(sqlite)
    app = createApp(db)

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES
        ('${id.regionalA}', 'Regional A'),
        ('${id.regionalB}', 'Regional B');

      INSERT INTO administracoes (id, regional_id, nome) VALUES
        ('${id.admA}', '${id.regionalA}', 'Administração A'),
        ('${id.admA2}', '${id.regionalA}', 'Administração A2'),
        ('${id.admB}', '${id.regionalB}', 'Administração B');

      INSERT INTO setores (id, administracao_id, nome) VALUES
        ('${id.setorA}', '${id.admA}', 'Setor A'),
        ('${id.setorA2}', '${id.admA2}', 'Setor A2'),
        ('${id.setorB}', '${id.admB}', 'Setor B');

      INSERT INTO casas (id, setor_id, nome) VALUES
        ('${id.casaA}', '${id.setorA}', 'Casa A'),
        ('${id.casaA2}', '${id.setorA2}', 'Casa A2'),
        ('${id.casaB}', '${id.setorB}', 'Casa B');

      INSERT INTO membros (id, nome, data_ordenacao, codigo_carteirinha, casa_id, ativo) VALUES
        ('${id.adminA}', 'Administrador A', '2000-01-01', 'ADM-A', '${id.casaA}', 1),
        ('${id.comumA}', 'Membro A', '2000-01-01', 'MEM-A', '${id.casaA}', 1),
        ('${id.comumB}', 'Membro B', '2000-01-01', 'MEM-B', '${id.casaB}', 1);

      INSERT INTO funcoes (id, nome, codigo, ativo)
      VALUES ('${id.funcao}', 'Função Teste', 'FUNCAO_TESTE', 1);

      INSERT INTO vinculos_funcionais
        (id, membro_id, funcao_id, regional_id, ativo)
      VALUES
        ('${id.vinculoA}', '${id.comumA}', '${id.funcao}', '${id.regionalA}', 1),
        ('${id.vinculoB}', '${id.comumB}', '${id.funcao}', '${id.regionalB}', 1);
    `)
  })

  it('Administrador Regional cria membro apenas em Casa da própria Regional', async () => {
    const token = await criarSessaoAdminA()

    const ok = await req(token, '/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Novo Membro A',
        dataOrdenacao: '2010-05-10',
        codigoCarteirinha: 'NOVO-A',
        casaId: id.casaA,
      }),
    })
    expect(ok.status).toBe(201)
    const membroCriado = await ok.json() as any
    const auditMembro = sqlite.prepare(
      "SELECT acao, escopo_tipo, escopo_id FROM auditoria_logs WHERE recurso_id = ?"
    ).get(membroCriado.id) as any
    expect(auditMembro).toMatchObject({
      acao: 'MEMBRO_CRIADO',
      escopo_tipo: 'CASA',
      escopo_id: id.casaA,
    })

    const fora = await req(token, '/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Novo Membro B',
        dataOrdenacao: '2010-05-10',
        codigoCarteirinha: 'NOVO-B',
        casaId: id.casaB,
      }),
    })
    expect(fora.status).toBe(403)
  })

  it('Administrador Regional altera membro da própria Regional e não altera outra Regional', async () => {
    const token = await criarSessaoAdminA()

    const ok = await req(token, `/api/v1/membros/${id.comumA}`, {
      method: 'PATCH',
      body: JSON.stringify({ nome: 'Membro A Atualizado' }),
    })
    expect(ok.status).toBe(200)

    const fora = await req(token, `/api/v1/membros/${id.comumB}`, {
      method: 'PATCH',
      body: JSON.stringify({ nome: 'Tentativa indevida' }),
    })
    expect(fora.status).toBe(403)
  })

  it('movimentação de membro preserva auditoria na Casa de origem e destino', async () => {
    const token = await criarSessaoAdminA()

    const res = await req(token, `/api/v1/membros/${id.comumA}`, {
      method: 'PATCH',
      body: JSON.stringify({ casaId: id.casaA2 }),
    })
    expect(res.status).toBe(200)

    const logs = sqlite.prepare(
      "SELECT escopo_tipo, escopo_id FROM auditoria_logs WHERE recurso_id = ? AND acao = 'MEMBRO_ATUALIZADO' ORDER BY escopo_id"
    ).all(id.comumA) as any[]

    expect(logs).toHaveLength(2)
    expect(logs.map(log => [log.escopo_tipo, log.escopo_id])).toEqual(
      expect.arrayContaining([
        ['CASA', id.casaA],
        ['CASA', id.casaA2],
      ])
    )
  })

  it('Administrador Regional não move membro para Casa de outra Regional', async () => {
    const token = await criarSessaoAdminA()

    const res = await req(token, `/api/v1/membros/${id.comumA}`, {
      method: 'PATCH',
      body: JSON.stringify({ casaId: id.casaB }),
    })
    expect(res.status).toBe(403)
    const logsIndevidos = sqlite.prepare(
      "SELECT COUNT(*) AS total FROM auditoria_logs WHERE recurso_id = ?"
    ).get(id.comumA) as any
    expect(logsIndevidos.total).toBe(0)
  })

  it('Administrador Regional não altera membro que possua Master ativo', async () => {
    const token = await criarSessaoAdminA()

    const contaMasterId = '14141414-1414-4414-8414-141414141414'
    const acessoMasterId = '15151515-1515-4515-8515-151515151515'

    sqlite.prepare(
      "INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES (?, ?, 'ATIVA', CURRENT_TIMESTAMP)"
    ).run(contaMasterId, id.comumA)

    sqlite.prepare(`
      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id, ativo)
      VALUES (?, ?, 'MASTER_SISTEMA', 'GLOBAL', NULL, 1)
    `).run(acessoMasterId, contaMasterId)

    const res = await req(token, `/api/v1/membros/${id.comumA}`, {
      method: 'PATCH',
      body: JSON.stringify({ ativo: false }),
    })

    expect(res.status).toBe(403)

    const membro = sqlite.prepare('SELECT ativo FROM membros WHERE id = ?').get(id.comumA) as { ativo: number }
    expect(membro.ativo).toBe(1)
  })

  it('Administrador Regional cria vínculo apenas quando membro e escopo pertencem à sua Regional', async () => {
    const token = await criarSessaoAdminA()

    const ok = await req(token, '/api/v1/vinculos-funcionais', {
      method: 'POST',
      body: JSON.stringify({
        membroId: id.adminA,
        funcaoId: id.funcao,
        regionalId: id.regionalA,
      }),
    })
    expect(ok.status).toBe(201)
    const vinculoCriado = await ok.json() as any
    const auditVinculo = sqlite.prepare(
      "SELECT acao, escopo_tipo, escopo_id FROM auditoria_logs WHERE recurso_id = ?"
    ).get(vinculoCriado.id) as any
    expect(auditVinculo).toMatchObject({
      acao: 'VINCULO_FUNCIONAL_CRIADO',
      escopo_tipo: 'REGIONAL',
      escopo_id: id.regionalA,
    })

    const membroFora = await req(token, '/api/v1/vinculos-funcionais', {
      method: 'POST',
      body: JSON.stringify({
        membroId: id.comumB,
        funcaoId: id.funcao,
        regionalId: id.regionalA,
      }),
    })
    expect(membroFora.status).toBe(403)

    const escopoFora = await req(token, '/api/v1/vinculos-funcionais', {
      method: 'POST',
      body: JSON.stringify({
        membroId: id.comumA,
        funcaoId: id.funcao,
        regionalId: id.regionalB,
      }),
    })
    expect(escopoFora.status).toBe(403)
  })

  it('movimentação de vínculo preserva auditoria no escopo de origem e destino', async () => {
    const token = await criarSessaoAdminA()

    const vinculoCasaId = 'abababab-abab-4bab-8bab-abababababab'
    sqlite.prepare(`
      INSERT INTO vinculos_funcionais
        (id, membro_id, funcao_id, casa_id, ativo)
      VALUES (?, ?, ?, ?, 1)
    `).run(vinculoCasaId, id.comumA, id.funcao, id.casaA)

    const res = await req(token, `/api/v1/vinculos-funcionais/${vinculoCasaId}`, {
      method: 'PATCH',
      body: JSON.stringify({ casaId: id.casaA2 }),
    })
    expect(res.status).toBe(200)

    const logs = sqlite.prepare(
      "SELECT escopo_tipo, escopo_id FROM auditoria_logs WHERE recurso_id = ? AND acao = 'VINCULO_FUNCIONAL_ATUALIZADO' ORDER BY escopo_id"
    ).all(vinculoCasaId) as any[]

    expect(logs).toHaveLength(2)
    expect(logs.map(log => [log.escopo_tipo, log.escopo_id])).toEqual(
      expect.arrayContaining([
        ['CASA', id.casaA],
        ['CASA', id.casaA2],
      ])
    )
  })

  it('Administrador Regional não altera vínculo de outra Regional nem move vínculo para fora', async () => {
    const token = await criarSessaoAdminA()

    const fora = await req(token, `/api/v1/vinculos-funcionais/${id.vinculoB}`, {
      method: 'PATCH',
      body: JSON.stringify({ ativo: false }),
    })
    expect(fora.status).toBe(403)

    const mover = await req(token, `/api/v1/vinculos-funcionais/${id.vinculoA}`, {
      method: 'PATCH',
      body: JSON.stringify({
        regionalId: id.regionalB,
      }),
    })
    expect(mover.status).toBe(403)
  })
})
