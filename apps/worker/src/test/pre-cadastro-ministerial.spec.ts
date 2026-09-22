import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { setupDb } from './setup'

describe('DATA-04A — pré-cadastro ministerial', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle>
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    db = drizzle(sqlite, { schema })
    app = createApp(db)

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES
        ('regional-a', 'Regional A'),
        ('regional-b', 'Regional B');

      INSERT INTO administracoes (id, regional_id, nome) VALUES
        ('adm-a', 'regional-a', 'Administração A'),
        ('adm-b', 'regional-b', 'Administração B');

      INSERT INTO setores (id, administracao_id, nome) VALUES
        ('setor-a', 'adm-a', 'Setor A'),
        ('setor-b', 'adm-b', 'Setor B');

      INSERT INTO casas (id, setor_id, nome, codigo) VALUES
        ('casa-a', 'setor-a', 'Casa A', 'BR-21-0001'),
        ('casa-b', 'setor-b', 'Casa B', 'BR-22-0001');

      INSERT INTO membros (id, nome, casa_id, ativo) VALUES
        ('m-master', 'Master', 'casa-a', 1),
        ('m-admin-a', 'Administrador A', 'casa-a', 1),
        ('m-comum', 'Usuário Comum', 'casa-a', 1),
        ('m-vinculado', 'João Vinculado', 'casa-a', 1);

      INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES
        ('c-master', 'm-master', 'ATIVA', CURRENT_TIMESTAMP),
        ('c-admin-a', 'm-admin-a', 'ATIVA', CURRENT_TIMESTAMP),
        ('c-comum', 'm-comum', 'ATIVA', CURRENT_TIMESTAMP);

      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('a-master', 'c-master', 'MASTER_SISTEMA', 'GLOBAL', NULL),
        ('a-admin-a', 'c-admin-a', 'ADMINISTRADOR_SISTEMA', 'REGIONAL', 'regional-a'),
        ('a-comum', 'c-comum', 'USUARIO_COMUM', 'CASA', 'casa-a');

      INSERT INTO pre_cadastros_ministeriais
        (id, nome, ministerio, rrm, regional_id, administracao_origem,
         localidade_origem, codigo_casa_referencia, casa_id, data_ordenacao,
         status_origem, membro_id, ativo)
      VALUES
        ('pre-a1', 'João da Silva', 'Diácono', 'REGIONAL A', 'regional-a',
         'Administração A', 'BR-21-0001 - Casa A', 'BR-21-0001', 'casa-a',
         '2010-01-01', 'Ativo', NULL, 1),
        ('pre-a2', 'João Vinculado', 'Diácono', 'REGIONAL A', 'regional-a',
         'Administração A', 'BR-21-0001 - Casa A', 'BR-21-0001', 'casa-a',
         '2005-01-01', 'Ativo', 'm-vinculado', 1),
        ('pre-b1', 'José da Silva', 'Diácono', 'REGIONAL B', 'regional-b',
         'Administração B', 'BR-22-0001 - Casa B', 'BR-22-0001', 'casa-b',
         '2012-01-01', 'Ativo', NULL, 1),
        ('pre-inativo', 'João Inativo', 'Diácono', 'REGIONAL A', 'regional-a',
         'Administração A', 'BR-21-0001 - Casa A', 'BR-21-0001', 'casa-a',
         '2015-01-01', 'Inativo', NULL, 0);
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
      id,
      contaId,
      membroId,
      hash,
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      agora,
      agora
    )
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

  it('retorna 401 sem autenticação', async () => {
    const response = await app.request(
      '/api/v1/admin/pre-cadastros-ministeriais?busca=Jo'
    )
    expect(response.status).toBe(401)
  })

  it('nega usuário comum', async () => {
    await sessao('s-comum', 'c-comum', 'm-comum', 'token-comum')

    const response = await app.request(
      '/api/v1/admin/pre-cadastros-ministeriais?busca=Jo',
      { headers: auth('token-comum') }
    )

    expect(response.status).toBe(403)
  })

  it('Administrador Regional enxerga somente a própria Regional', async () => {
    await sessao('s-admin', 'c-admin-a', 'm-admin-a', 'token-admin')

    const response = await app.request(
      '/api/v1/admin/pre-cadastros-ministeriais?busca=Silva',
      { headers: auth('token-admin') }
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as any
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({
      id: 'pre-a1',
      nome: 'João da Silva',
      regionalId: 'regional-a',
      vinculado: false,
    })
  })

  it('Administrador Regional recebe 403 ao pedir outra Regional', async () => {
    await sessao('s-admin', 'c-admin-a', 'm-admin-a', 'token-admin')

    const response = await app.request(
      '/api/v1/admin/pre-cadastros-ministeriais?busca=Jose&regionalId=regional-b',
      { headers: auth('token-admin') }
    )

    expect(response.status).toBe(403)
  })

  it('Master pode pesquisar em todas as Regionais', async () => {
    await sessao('s-master', 'c-master', 'm-master', 'token-master')

    const response = await app.request(
      '/api/v1/admin/pre-cadastros-ministeriais?busca=Silva',
      { headers: auth('token-master') }
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as any
    expect(body.data.map((item: any) => item.id).sort()).toEqual(['pre-a1', 'pre-b1'])
  })

  it('Master pode restringir a busca a uma Regional', async () => {
    await sessao('s-master', 'c-master', 'm-master', 'token-master')

    const response = await app.request(
      '/api/v1/admin/pre-cadastros-ministeriais?busca=Silva&regionalId=regional-b',
      { headers: auth('token-master') }
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as any
    expect(body.data).toHaveLength(1)
    expect(body.data[0].regionalId).toBe('regional-b')
  })

  it('rejeita busca com menos de dois caracteres', async () => {
    await sessao('s-master', 'c-master', 'm-master', 'token-master')

    const response = await app.request(
      '/api/v1/admin/pre-cadastros-ministeriais?busca=J',
      { headers: auth('token-master') }
    )

    expect(response.status).toBe(400)
  })

  it('indica quando o pré-cadastro já foi vinculado a um membro', async () => {
    await sessao('s-master', 'c-master', 'm-master', 'token-master')

    const response = await app.request(
      '/api/v1/admin/pre-cadastros-ministeriais?busca=Vinculado',
      { headers: auth('token-master') }
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as any
    expect(body.data[0]).toMatchObject({
      id: 'pre-a2',
      membroId: 'm-vinculado',
      vinculado: true,
    })
  })

  it('não retorna registros inativos', async () => {
    await sessao('s-master', 'c-master', 'm-master', 'token-master')

    const response = await app.request(
      '/api/v1/admin/pre-cadastros-ministeriais?busca=Inativo',
      { headers: auth('token-master') }
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as any
    expect(body.data).toEqual([])
  })
})
