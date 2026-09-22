import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { setupDb } from './setup'

describe('DATA-04B — finalização do pré-cadastro ministerial', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle>
  let app: ReturnType<typeof createApp>

  const regionalA = '00000000-0000-4000-8000-000000000101'
  const regionalB = '00000000-0000-4000-8000-000000000102'
  const admA = '00000000-0000-4000-8000-000000000103'
  const admB = '00000000-0000-4000-8000-000000000104'
  const setorA = '00000000-0000-4000-8000-000000000105'
  const setorB = '00000000-0000-4000-8000-000000000106'
  const casaA = '00000000-0000-4000-8000-000000000107'
  const casaB = '00000000-0000-4000-8000-000000000108'

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    db = drizzle(sqlite, { schema })
    app = createApp(db)

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES
        ('${regionalA}', 'Regional A'),
        ('${regionalB}', 'Regional B');

      INSERT INTO administracoes (id, regional_id, nome) VALUES
        ('${admA}', '${regionalA}', 'Administração A'),
        ('${admB}', '${regionalB}', 'Administração B');

      INSERT INTO setores (id, administracao_id, nome) VALUES
        ('${setorA}', '${admA}', 'Setor A'),
        ('${setorB}', '${admB}', 'Setor B');

      INSERT INTO casas (id, setor_id, nome, codigo) VALUES
        ('${casaA}', '${setorA}', 'Casa A', 'BR-21-0001'),
        ('${casaB}', '${setorB}', 'Casa B', 'BR-22-0001');

      INSERT INTO membros (id, nome, casa_id, ativo, codigo_carteirinha, celular) VALUES
        ('m-master', 'Master', '${casaA}', 1, 'MASTER-001', '11911111111'),
        ('m-admin-a', 'Administrador A', '${casaA}', 1, 'ADMIN-001', '11922222222'),
        ('m-existente', 'Existente', '${casaA}', 1, 'CARD-EXISTENTE', '11933333333');

      INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES
        ('c-master', 'm-master', 'ATIVA', CURRENT_TIMESTAMP),
        ('c-admin-a', 'm-admin-a', 'ATIVA', CURRENT_TIMESTAMP);

      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('a-master', 'c-master', 'MASTER_SISTEMA', 'GLOBAL', NULL),
        ('a-admin-a', 'c-admin-a', 'ADMINISTRADOR_SISTEMA', 'REGIONAL', '${regionalA}');

      INSERT INTO pre_cadastros_ministeriais
        (id, nome, ministerio, rrm, regional_id, localidade_origem,
         codigo_casa_referencia, casa_id, data_ordenacao, status_origem, ativo)
      VALUES
        ('pre-a', 'João Novo', 'Diácono', 'REGIONAL A', '${regionalA}',
         'BR-21-0001 - Casa A', 'BR-21-0001', '${casaA}', '2010-03-15', 'Ativo', 1),
        ('pre-b', 'José Outra Regional', 'Diácono', 'REGIONAL B', '${regionalB}',
         'BR-22-0001 - Casa B', 'BR-22-0001', '${casaB}', '2012-05-20', 'Ativo', 1),
        ('pre-sem-casa', 'Pedro Sem Casa', 'Diácono', 'REGIONAL A', '${regionalA}',
         'BR-21-9999 - Casa Ausente', 'BR-21-9999', NULL, '2015-01-01', 'Ativo', 1),
        ('pre-sem-data', 'Paulo Sem Data', 'Diácono', 'REGIONAL A', '${regionalA}',
         'BR-21-0001 - Casa A', 'BR-21-0001', '${casaA}', NULL, 'Ativo', 1);
    `)
  })

  async function sessao(id: string, contaId: string, membroId: string, token: string) {
    const hash = await hashToken(token)
    const agora = new Date().toISOString()
    sqlite.prepare(`
      INSERT INTO sessoes
        (id, conta_acesso_id, membro_id, token_hash, expira_em, ultimo_acesso_em, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, contaId, membroId, hash,
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      agora, agora
    )
  }

  const headers = (token: string) => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  })

  it('Administrador Regional finaliza pré-cadastro da própria Regional', async () => {
    await sessao('s-admin', 'c-admin-a', 'm-admin-a', 'token-admin')

    const response = await app.request('/api/v1/admin/pre-cadastros-ministeriais/pre-a/finalizar', {
      method: 'POST',
      headers: headers('token-admin'),
      body: JSON.stringify({
        codigoCarteirinha: 'CARD-001',
        celular: '(11) 98888-7777',
      }),
    })

    expect(response.status).toBe(201)
    const body = (await response.json()) as any
    expect(body).toMatchObject({
      nome: 'João Novo',
      dataOrdenacao: '2010-03-15',
      codigoCarteirinha: 'CARD-001',
      celular: '11988887777',
      casaId: casaA,
      preCadastroMinisterialId: 'pre-a',
      contaCriada: false,
    })

    const membro = sqlite.prepare(
      'SELECT nome, codigo_carteirinha, celular, casa_id FROM membros WHERE id = ?'
    ).get(body.id) as any
    expect(membro).toMatchObject({
      nome: 'João Novo',
      codigo_carteirinha: 'CARD-001',
      celular: '11988887777',
      casa_id: casaA,
    })

    const pre = sqlite.prepare(
      'SELECT membro_id FROM pre_cadastros_ministeriais WHERE id = ?'
    ).get('pre-a') as any
    expect(pre.membro_id).toBe(body.id)

    const conta = sqlite.prepare(
      'SELECT id FROM contas_acesso WHERE membro_id = ?'
    ).get(body.id)
    expect(conta).toBeUndefined()
  })

  it('Administrador Regional não finaliza pré-cadastro de outra Regional', async () => {
    await sessao('s-admin', 'c-admin-a', 'm-admin-a', 'token-admin')

    const response = await app.request('/api/v1/admin/pre-cadastros-ministeriais/pre-b/finalizar', {
      method: 'POST',
      headers: headers('token-admin'),
      body: JSON.stringify({
        codigoCarteirinha: 'CARD-002',
        celular: '11988880002',
      }),
    })

    expect(response.status).toBe(403)
  })

  it('Master pode finalizar pré-cadastro autorizado globalmente', async () => {
    await sessao('s-master', 'c-master', 'm-master', 'token-master')

    const response = await app.request('/api/v1/admin/pre-cadastros-ministeriais/pre-b/finalizar', {
      method: 'POST',
      headers: headers('token-master'),
      body: JSON.stringify({
        codigoCarteirinha: 'CARD-003',
        celular: '11988880003',
      }),
    })

    expect(response.status).toBe(201)
  })

  it('exige celular para finalizar o cadastro', async () => {
    await sessao('s-master', 'c-master', 'm-master', 'token-master')

    const response = await app.request('/api/v1/admin/pre-cadastros-ministeriais/pre-a/finalizar', {
      method: 'POST',
      headers: headers('token-master'),
      body: JSON.stringify({ codigoCarteirinha: 'CARD-SEM-CELULAR' }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('rejeita carteirinha já vinculada', async () => {
    await sessao('s-master', 'c-master', 'm-master', 'token-master')

    const response = await app.request('/api/v1/admin/pre-cadastros-ministeriais/pre-a/finalizar', {
      method: 'POST',
      headers: headers('token-master'),
      body: JSON.stringify({
        codigoCarteirinha: 'CARD-EXISTENTE',
        celular: '11988880004',
      }),
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'CARTEIRINHA_JA_VINCULADA' })
  })

  it('rejeita celular já vinculado', async () => {
    await sessao('s-master', 'c-master', 'm-master', 'token-master')

    const response = await app.request('/api/v1/admin/pre-cadastros-ministeriais/pre-a/finalizar', {
      method: 'POST',
      headers: headers('token-master'),
      body: JSON.stringify({
        codigoCarteirinha: 'CARD-004',
        celular: '11933333333',
      }),
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'CELULAR_JA_VINCULADO' })
  })

  it('exige Casa conciliada quando o pré-cadastro não possui uma', async () => {
    await sessao('s-master', 'c-master', 'm-master', 'token-master')

    const response = await app.request(
      '/api/v1/admin/pre-cadastros-ministeriais/pre-sem-casa/finalizar',
      {
        method: 'POST',
        headers: headers('token-master'),
        body: JSON.stringify({
          codigoCarteirinha: 'CARD-005',
          celular: '11988880005',
        }),
      }
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'CASA_NAO_CONCILIADA' })
  })

  it('permite confirmar manualmente Casa da mesma Regional', async () => {
    await sessao('s-master', 'c-master', 'm-master', 'token-master')

    const response = await app.request(
      '/api/v1/admin/pre-cadastros-ministeriais/pre-sem-casa/finalizar',
      {
        method: 'POST',
        headers: headers('token-master'),
        body: JSON.stringify({
          codigoCarteirinha: 'CARD-006',
          celular: '11988880006',
          casaId: casaA,
        }),
      }
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ casaId: casaA })
  })

  it('bloqueia Casa de outra Regional', async () => {
    await sessao('s-master', 'c-master', 'm-master', 'token-master')

    const response = await app.request(
      '/api/v1/admin/pre-cadastros-ministeriais/pre-a/finalizar',
      {
        method: 'POST',
        headers: headers('token-master'),
        body: JSON.stringify({
          codigoCarteirinha: 'CARD-007',
          celular: '11988880007',
          casaId: casaB,
        }),
      }
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'REGIONAL_DIVERGENTE' })
  })

  it('não finaliza registro sem data de ordenação', async () => {
    await sessao('s-master', 'c-master', 'm-master', 'token-master')

    const response = await app.request(
      '/api/v1/admin/pre-cadastros-ministeriais/pre-sem-data/finalizar',
      {
        method: 'POST',
        headers: headers('token-master'),
        body: JSON.stringify({
          codigoCarteirinha: 'CARD-008',
          celular: '11988880008',
        }),
      }
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'PRE_CADASTRO_INCOMPLETO' })
  })

  it('segunda finalização do mesmo pré-cadastro é recusada', async () => {
    await sessao('s-master', 'c-master', 'm-master', 'token-master')

    const primeira = await app.request(
      '/api/v1/admin/pre-cadastros-ministeriais/pre-a/finalizar',
      {
        method: 'POST',
        headers: headers('token-master'),
        body: JSON.stringify({
          codigoCarteirinha: 'CARD-009',
          celular: '11988880009',
        }),
      }
    )
    expect(primeira.status).toBe(201)

    const segunda = await app.request(
      '/api/v1/admin/pre-cadastros-ministeriais/pre-a/finalizar',
      {
        method: 'POST',
        headers: headers('token-master'),
        body: JSON.stringify({
          codigoCarteirinha: 'CARD-010',
          celular: '11988880010',
        }),
      }
    )

    expect(segunda.status).toBe(409)
    expect(await segunda.json()).toMatchObject({ code: 'PRE_CADASTRO_JA_VINCULADO' })
  })
})
