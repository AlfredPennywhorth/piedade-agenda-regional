import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { setupDb } from './setup'

describe('ACC-10 — segregação de administração de acessos entre Regionais', () => {
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

      INSERT INTO casas (id, setor_id, nome) VALUES
        ('casa-a', 'setor-a', 'Casa A'),
        ('casa-b', 'setor-b', 'Casa B');

      INSERT INTO membros (id, nome, casa_id, ativo) VALUES
        ('membro-master', 'Master', 'casa-a', 1),
        ('membro-admin-a', 'Admin A', 'casa-a', 1),
        ('membro-alvo', 'Alvo', 'casa-a', 1);

      INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES
        ('conta-master', 'membro-master', 'ATIVA', CURRENT_TIMESTAMP),
        ('conta-admin-a', 'membro-admin-a', 'ATIVA', CURRENT_TIMESTAMP),
        ('conta-alvo', 'membro-alvo', 'ATIVA', CURRENT_TIMESTAMP);

      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('acesso-master', 'conta-master', 'MASTER_SISTEMA', 'GLOBAL', NULL),
        ('acesso-admin-a', 'conta-admin-a', 'ADMINISTRADOR_SISTEMA', 'REGIONAL', 'regional-a');
    `)
  })

  async function criarSessao(
    id: string,
    contaId: string,
    membroId: string,
    token: string
  ) {
    const tokenHash = await hashToken(token)
    const agora = new Date().toISOString()

    sqlite
      .prepare(
        `INSERT INTO sessoes
          (id, conta_acesso_id, membro_id, token_hash, expira_em,
           ultimo_acesso_em, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        contaId,
        membroId,
        tokenHash,
        new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        agora,
        agora
      )
  }

  async function requisicao(path: string, token: string, init: RequestInit) {
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    headers.set('Content-Type', 'application/json')

    return app.request(path, { ...init, headers })
  }

  it('Administrador Regional concede perfil dentro da própria Regional', async () => {
    await criarSessao('sessao-admin-a', 'conta-admin-a', 'membro-admin-a', 'token-admin-a')

    const response = await requisicao(
      '/api/v1/admin/acessos',
      'token-admin-a',
      {
        method: 'POST',
        body: JSON.stringify({
          contaAcessoId: 'conta-alvo',
          perfilCodigo: 'GESTOR_AGENDA',
          escopoTipo: 'SETOR',
          escopoId: 'setor-a',
        }),
      }
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      contaAcessoId: 'conta-alvo',
      perfilCodigo: 'GESTOR_AGENDA',
      escopoTipo: 'SETOR',
      escopoId: 'setor-a',
    })
  })

  it('Administrador Regional recebe 403 ao conceder perfil em outra Regional', async () => {
    await criarSessao('sessao-admin-a', 'conta-admin-a', 'membro-admin-a', 'token-admin-a')

    const response = await requisicao(
      '/api/v1/admin/acessos',
      'token-admin-a',
      {
        method: 'POST',
        body: JSON.stringify({
          contaAcessoId: 'conta-alvo',
          perfilCodigo: 'GESTOR_AGENDA',
          escopoTipo: 'CASA',
          escopoId: 'casa-b',
        }),
      }
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' })
  })

  it('Administrador Regional recebe 403 ao revogar acesso de outra Regional', async () => {
    sqlite.exec(`
      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('acesso-alvo-b', 'conta-alvo', 'GESTOR_AGENDA', 'REGIONAL', 'regional-b');
    `)
    await criarSessao('sessao-admin-a', 'conta-admin-a', 'membro-admin-a', 'token-admin-a')

    const response = await requisicao(
      '/api/v1/admin/acessos/acesso-alvo-b',
      'token-admin-a',
      { method: 'DELETE' }
    )

    expect(response.status).toBe(403)

    const acesso = sqlite
      .prepare('SELECT ativo FROM acessos_conta WHERE id = ?')
      .get('acesso-alvo-b') as any
    expect(acesso.ativo).toBe(1)
  })

  it('Master concede perfil em qualquer Regional', async () => {
    await criarSessao('sessao-master', 'conta-master', 'membro-master', 'token-master')

    const response = await requisicao(
      '/api/v1/admin/acessos',
      'token-master',
      {
        method: 'POST',
        body: JSON.stringify({
          contaAcessoId: 'conta-alvo',
          perfilCodigo: 'GESTOR_AGENDA',
          escopoTipo: 'ADMINISTRACAO',
          escopoId: 'adm-b',
        }),
      }
    )

    expect(response.status).toBe(201)
  })

  it('escopo institucional inexistente falha fechado sem virar autorização', async () => {
    await criarSessao('sessao-admin-a', 'conta-admin-a', 'membro-admin-a', 'token-admin-a')

    const response = await requisicao(
      '/api/v1/admin/acessos',
      'token-admin-a',
      {
        method: 'POST',
        body: JSON.stringify({
          contaAcessoId: 'conta-alvo',
          perfilCodigo: 'GESTOR_AGENDA',
          escopoTipo: 'SETOR',
          escopoId: 'setor-inexistente',
        }),
      }
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'ESCOPO_INVALIDO' })
  })
})
