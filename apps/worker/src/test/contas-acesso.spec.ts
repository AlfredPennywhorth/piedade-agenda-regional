import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { setupDb } from './setup'

describe('Contas de acesso — PR-ACC-01', () => {
  let sqlite: Database.Database

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES ('regional-1', 'Regional São Paulo');
      INSERT INTO administracoes (id, regional_id, nome)
      VALUES ('administracao-1', 'regional-1', 'Administração');
      INSERT INTO setores (id, administracao_id, nome)
      VALUES ('setor-1', 'administracao-1', 'Setor');
      INSERT INTO casas (id, setor_id, nome)
      VALUES ('casa-1', 'setor-1', 'Casa');
    `)
  })

  it('permite que uma pessoa exista sem conta de acesso', () => {
    sqlite
      .prepare(
        `INSERT INTO membros
          (id, nome, celular, data_ordenacao, codigo_carteirinha, casa_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        'membro-1',
        'Pessoa sem acesso',
        '5511999990001',
        '2001-05-10',
        'CARTEIRA-001',
        'casa-1'
      )

    const contas = sqlite
      .prepare('SELECT COUNT(*) AS total FROM contas_acesso WHERE membro_id = ?')
      .get('membro-1') as { total: number }

    expect(contas.total).toBe(0)
  })

  it('garante no máximo uma conta por pessoa', () => {
    sqlite
      .prepare(
        `INSERT INTO membros
          (id, nome, celular, data_ordenacao, codigo_carteirinha, casa_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        'membro-1',
        'Pessoa com acesso',
        '5511999990002',
        '1999-03-20',
        'CARTEIRA-002',
        'casa-1'
      )

    sqlite
      .prepare(
        `INSERT INTO contas_acesso (id, membro_id, status)
         VALUES (?, ?, ?)`
      )
      .run('conta-1', 'membro-1', 'PENDENTE_ATIVACAO')

    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO contas_acesso (id, membro_id, status)
           VALUES (?, ?, ?)`
        )
        .run('conta-2', 'membro-1', 'ATIVA')
    ).toThrow(/UNIQUE/)
  })

  it('restringe os estados aceitos para a conta', () => {
    sqlite
      .prepare(
        `INSERT INTO membros
          (id, nome, celular, data_ordenacao, codigo_carteirinha, casa_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        'membro-1',
        'Pessoa com acesso',
        '5511999990003',
        '2010-08-15',
        'CARTEIRA-003',
        'casa-1'
      )

    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO contas_acesso (id, membro_id, status)
           VALUES (?, ?, ?)`
        )
        .run('conta-1', 'membro-1', 'STATUS_INVALIDO')
    ).toThrow(/CHECK/)
  })

  it('garante unicidade institucional do código da carteirinha', () => {
    const inserir = sqlite.prepare(
      `INSERT INTO membros
        (id, nome, celular, data_ordenacao, codigo_carteirinha, casa_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )

    inserir.run(
      'membro-1',
      'Primeira pessoa',
      '5511999990004',
      '2000-01-01',
      'CARTEIRA-UNICA',
      'casa-1'
    )

    expect(() =>
      inserir.run(
        'membro-2',
        'Segunda pessoa',
        '5511999990005',
        '2002-02-02',
        'CARTEIRA-UNICA',
        'casa-1'
      )
    ).toThrow(/UNIQUE/)
  })
})
