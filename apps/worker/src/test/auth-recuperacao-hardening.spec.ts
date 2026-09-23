import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { setupDb } from './setup'
import { gerarSalt, hashPin } from '../security/pin'
import { hashToken } from '../security/tokens'

describe('Hardening de recuperação e confirmação de PIN', () => {
  let sqlite: Database.Database
  let app: ReturnType<typeof createApp>

  beforeEach(async () => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    app = createApp(drizzle(sqlite, { schema }))

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES ('regional-1', 'Regional Um');
      INSERT INTO administracoes (id, regional_id, nome)
      VALUES ('adm-1', 'regional-1', 'Administração Um');
      INSERT INTO setores (id, administracao_id, nome)
      VALUES ('setor-1', 'adm-1', 'Setor Um');
      INSERT INTO casas (id, setor_id, nome)
      VALUES ('casa-1', 'setor-1', 'Casa Um');
      INSERT INTO membros
        (id, nome, celular, data_ordenacao, codigo_carteirinha, casa_id, ativo)
      VALUES
        ('membro-1', 'Pessoa Teste', '11999999999', '2000-01-01', 'CART-1', 'casa-1', 1);
    `)

    const salt = gerarSalt()
    const pinHash = await hashPin('123456', salt, 'pepper-de-teste')
    sqlite.prepare(
      `INSERT INTO contas_acesso
        (id, membro_id, status, pin_hash, pin_salt, ativado_em)
       VALUES (?, ?, 'ATIVA', ?, ?, CURRENT_TIMESTAMP)`
    ).run('conta-1', 'membro-1', pinHash, salt)
  })

  async function requisicao(path: string, init?: RequestInit) {
    return app.request(path, init, {
      APP_ENV: 'test',
      APP_VERSION: 'test',
      PIN_PEPPER: 'pepper-de-teste',
      MASTER_BOOTSTRAP_SECRET: 'segredo-bootstrap-teste-com-32-caracteres',
    } as any)
  }

  it('limita submissões anônimas de recuperação de PIN por origem', async () => {
    for (let tentativa = 1; tentativa <= 10; tentativa++) {
      const response = await requisicao('/api/v1/auth/recuperacao-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.10',
        },
        body: JSON.stringify({ celular: '11999999999' }),
      })
      expect(response.status).toBe(202)
    }

    const bloqueada = await requisicao('/api/v1/auth/recuperacao-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.10',
      },
      body: JSON.stringify({ celular: '11999999999' }),
    })

    expect(bloqueada.status).toBe(429)
    expect(Number(bloqueada.headers.get('Retry-After'))).toBeGreaterThan(0)
  })

  it('bloqueia temporariamente após cinco confirmações erradas do PIN atual', async () => {
    const token = 'sessao-perfil'
    const agora = new Date().toISOString()
    sqlite.prepare(
      `INSERT INTO sessoes
        (id, conta_acesso_id, membro_id, token_hash, expira_em, ultimo_acesso_em, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'sessao-1',
      'conta-1',
      'membro-1',
      await hashToken(token),
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      agora,
      agora
    )

    for (let tentativa = 1; tentativa <= 4; tentativa++) {
      const response = await requisicao('/api/v1/auth/me/alterar-pin', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pinAtual: '654321',
          novoPin: '111111',
          confirmacaoNovoPin: '111111',
        }),
      })
      expect(response.status).toBe(401)
    }

    const quinta = await requisicao('/api/v1/auth/me/alterar-pin', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pinAtual: '654321',
        novoPin: '111111',
        confirmacaoNovoPin: '111111',
      }),
    })

    expect(quinta.status).toBe(429)
    expect(Number(quinta.headers.get('Retry-After'))).toBeGreaterThan(0)

    const conta = sqlite.prepare(
      `SELECT tentativas_pin, bloqueado_ate FROM contas_acesso WHERE id = 'conta-1'`
    ).get() as any
    expect(conta.tentativas_pin).toBe(5)
    expect(conta.bloqueado_ate).toBeTruthy()
  })
})
