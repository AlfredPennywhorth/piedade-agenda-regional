import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'

const migrationPath = resolve(process.cwd(), 'drizzle/0014_acc_pessoas_contas_acesso.sql')

function criarBancoLegado() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(`
    CREATE TABLE membros (
      id text PRIMARY KEY NOT NULL,
      nome text NOT NULL,
      data_nascimento text,
      celular text UNIQUE,
      casa_id text NOT NULL,
      ativo integer DEFAULT true NOT NULL,
      autenticacao_ativa integer DEFAULT false NOT NULL,
      pin_hash text,
      pin_salt text,
      bloqueado_ate text,
      tentativas_pin integer DEFAULT 0 NOT NULL,
      ativado_em text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE links_ativacao (
      id text PRIMARY KEY NOT NULL,
      membro_id text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expira_em text NOT NULL,
      utilizado_em text,
      revogado_em text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (membro_id) REFERENCES membros(id)
    );

    CREATE TABLE sessoes (
      id text PRIMARY KEY NOT NULL,
      membro_id text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expira_em text NOT NULL,
      revogado_em text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      ultimo_acesso_em text,
      user_agent text,
      FOREIGN KEY (membro_id) REFERENCES membros(id)
    );

    CREATE TABLE tentativas_acesso (
      id text PRIMARY KEY NOT NULL,
      membro_id text,
      tipo text NOT NULL,
      sucesso integer NOT NULL,
      motivo text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (membro_id) REFERENCES membros(id)
    );
  `)
  return sqlite
}

describe('Migração 0014 — preservação de dados legados', () => {
  it('separa contas sem converter nascimento em ordenação nem criar conta indevida', () => {
    const sqlite = criarBancoLegado()

    sqlite.exec(`
      INSERT INTO membros (
        id, nome, data_nascimento, celular, casa_id, ativo,
        autenticacao_ativa, pin_hash, pin_salt, bloqueado_ate,
        tentativas_pin, ativado_em
      ) VALUES
        (
          'm-ativo', 'Membro Ativo', '1980-01-01', '5511999990001', 'casa-1', 1,
          1, 'hash-legado', 'salt-legado', '2099-01-01T00:00:00Z',
          2, '2026-01-01T00:00:00Z'
        ),
        (
          'm-pendente', 'Membro Pendente', '1985-02-02', '5511999990002', 'casa-1', 1,
          0, NULL, NULL, NULL, 0, NULL
        ),
        (
          'm-sem-conta', 'Membro sem Conta', '1990-03-03', '5511999990003', 'casa-1', 1,
          0, NULL, NULL, NULL, 0, NULL
        );

      INSERT INTO links_ativacao (id, membro_id, token_hash, expira_em)
      VALUES ('link-1', 'm-pendente', 'token-link', '2099-01-01T00:00:00Z');

      INSERT INTO sessoes (id, membro_id, token_hash, expira_em)
      VALUES ('sessao-1', 'm-ativo', 'token-sessao', '2099-01-01T00:00:00Z');

      INSERT INTO tentativas_acesso (id, membro_id, tipo, sucesso)
      VALUES ('tentativa-1', 'm-ativo', 'LOGIN_PIN', 1);
    `)

    const migration = readFileSync(migrationPath, 'utf8')
    sqlite.exec(migration)

    const contas = sqlite
      .prepare(
        `SELECT membro_id, status, pin_hash, pin_salt, bloqueado_ate, tentativas_pin
         FROM contas_acesso
         ORDER BY membro_id`
      )
      .all() as Array<Record<string, unknown>>

    expect(contas).toEqual([
      {
        membro_id: 'm-ativo',
        status: 'ATIVA',
        pin_hash: 'hash-legado',
        pin_salt: 'salt-legado',
        bloqueado_ate: '2099-01-01T00:00:00Z',
        tentativas_pin: 2,
      },
      {
        membro_id: 'm-pendente',
        status: 'PENDENTE_ATIVACAO',
        pin_hash: null,
        pin_salt: null,
        bloqueado_ate: null,
        tentativas_pin: 0,
      },
    ])

    const membroSemConta = sqlite
      .prepare('SELECT COUNT(*) AS total FROM contas_acesso WHERE membro_id = ?')
      .get('m-sem-conta') as { total: number }
    expect(membroSemConta.total).toBe(0)

    const membroAtivo = sqlite
      .prepare(
        `SELECT data_nascimento, data_ordenacao, codigo_carteirinha
         FROM membros WHERE id = 'm-ativo'`
      )
      .get() as Record<string, unknown>
    expect(membroAtivo).toEqual({
      data_nascimento: '1980-01-01',
      data_ordenacao: null,
      codigo_carteirinha: null,
    })

    const vinculos = sqlite
      .prepare(`
        SELECT
          l.conta_acesso_id AS conta_link,
          s.conta_acesso_id AS conta_sessao,
          t.conta_acesso_id AS conta_tentativa,
          cp.id AS conta_pendente,
          ca.id AS conta_ativa
        FROM links_ativacao l
        CROSS JOIN sessoes s
        CROSS JOIN tentativas_acesso t
        JOIN contas_acesso cp ON cp.membro_id = 'm-pendente'
        JOIN contas_acesso ca ON ca.membro_id = 'm-ativo'
        WHERE l.id = 'link-1'
          AND s.id = 'sessao-1'
          AND t.id = 'tentativa-1'
      `)
      .get() as Record<string, unknown>

    expect(vinculos.conta_link).toBe(vinculos.conta_pendente)
    expect(vinculos.conta_sessao).toBe(vinculos.conta_ativa)
    expect(vinculos.conta_tentativa).toBe(vinculos.conta_ativa)
  })
})
