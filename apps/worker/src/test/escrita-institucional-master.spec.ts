import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { setupDb } from './setup'

describe('ACC-12 — escrita institucional restrita a Master', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle>
  let app: ReturnType<typeof createApp>
  let tokenUsuario = ''

  beforeEach(async () => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    db = drizzle(sqlite, { schema })
    app = createApp(db)

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES ('regional-base', 'Regional Base');
      INSERT INTO administracoes (id, regional_id, nome)
        VALUES ('adm-base', 'regional-base', 'Administração Base');
      INSERT INTO setores (id, administracao_id, nome)
        VALUES ('setor-base', 'adm-base', 'Setor Base');
      INSERT INTO casas (id, setor_id, nome)
        VALUES ('casa-base', 'setor-base', 'Casa Base');
      INSERT INTO membros (id, nome, casa_id, ativo)
        VALUES ('membro-user', 'Usuário Comum', 'casa-base', 1);
      INSERT INTO contas_acesso (id, membro_id, status, ativado_em)
        VALUES ('conta-user', 'membro-user', 'ATIVA', CURRENT_TIMESTAMP);
      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
        VALUES ('acesso-user', 'conta-user', 'USUARIO_COMUM', 'CASA', 'casa-base');
    `)

    tokenUsuario = 'token-usuario-comum'
    const tokenHash = await hashToken(tokenUsuario)
    const agora = new Date().toISOString()
    sqlite.prepare(`
      INSERT INTO sessoes
        (id, conta_acesso_id, membro_id, token_hash, expira_em,
         ultimo_acesso_em, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'sessao-user',
      'conta-user',
      'membro-user',
      tokenHash,
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      agora,
      agora
    )
  })

  function headers() {
    return {
      Authorization: `Bearer ${tokenUsuario}`,
      'Content-Type': 'application/json',
    }
  }

  const casos = [
    ['/api/v1/regionais', { nome: 'Regional Nova' }],
    ['/api/v1/administracoes', { nome: 'Adm Nova', regionalId: 'regional-base' }],
    ['/api/v1/setores', { nome: 'Setor Novo', administracaoId: 'adm-base' }],
    ['/api/v1/casas', { nome: 'Casa Nova', setorId: 'setor-base' }],
    ['/api/v1/grupos-trabalho', { nome: 'GT Novo', regionalId: 'regional-base' }],
    ['/api/v1/membros', { nome: 'Membro Novo', casaId: 'casa-base' }],
    ['/api/v1/funcoes', { nome: 'Função Nova' }],
    ['/api/v1/vinculos-funcionais', {
      membroId: 'membro-user',
      funcaoId: 'funcao-inexistente',
      regionalId: 'regional-base',
    }],
    ['/api/v1/locais', {
      nome: 'Local Novo',
      endereco: 'Rua X',
      numero: '1',
      cidade: 'São Paulo',
      uf: 'SP',
    }],
  ] as const

  for (const [path, body] of casos) {
    it(`nega POST de usuário comum em ${path}`, async () => {
      const response = await app.request(path, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      })

      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' })
    })
  }

  it('mantém leitura autenticada disponível enquanto a matriz de leitura não é homologada', async () => {
    const response = await app.request('/api/v1/regionais', {
      headers: { Authorization: `Bearer ${tokenUsuario}` },
    })

    expect(response.status).toBe(200)
  })
})
