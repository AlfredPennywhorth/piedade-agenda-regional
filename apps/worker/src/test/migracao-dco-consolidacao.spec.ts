import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

const TARGET = 'a6fed6a4-7561-4ad9-b4e2-01fd73607859'
const TECHNICAL = 'd0c0d0c0-0000-4000-8000-000000000001'

describe('Migration 0035 - consolidação DCO institucional', () => {
  it('preserva histórico e deixa uma única DCO operacional ativa', () => {
    const sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')

    sqlite.exec(`
      CREATE TABLE funcoes (
        id text PRIMARY KEY NOT NULL,
        nome text NOT NULL,
        codigo text,
        descricao text,
        ativo integer DEFAULT 1 NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE UNIQUE INDEX idx_funcoes_dco_unico ON funcoes(codigo) WHERE codigo = 'DCO';

      CREATE TABLE membros (id text PRIMARY KEY NOT NULL);
      CREATE TABLE casas (id text PRIMARY KEY NOT NULL);

      CREATE TABLE vinculos_funcionais (
        id text PRIMARY KEY NOT NULL,
        membro_id text NOT NULL REFERENCES membros(id),
        funcao_id text NOT NULL REFERENCES funcoes(id),
        regional_id text,
        administracao_id text,
        setor_id text,
        casa_id text REFERENCES casas(id),
        grupo_trabalho_id text,
        ativo integer DEFAULT 1 NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE UNIQUE INDEX idx_vinculo_unico_casa
        ON vinculos_funcionais(membro_id, funcao_id, casa_id)
        WHERE casa_id IS NOT NULL AND ativo = 1;

      CREATE TABLE convocacoes (
        id text PRIMARY KEY NOT NULL,
        status text NOT NULL
      );

      CREATE TABLE convocacao_funcoes (
        id text PRIMARY KEY NOT NULL,
        convocacao_id text NOT NULL REFERENCES convocacoes(id),
        funcao_id text NOT NULL REFERENCES funcoes(id),
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE UNIQUE INDEX idx_convocacao_funcao_unico
        ON convocacao_funcoes(convocacao_id, funcao_id);

      CREATE TABLE convocacao_destinatarios (
        id text PRIMARY KEY NOT NULL
      );

      CREATE TABLE convocacao_destinatario_evidencias (
        id text PRIMARY KEY NOT NULL,
        convocacao_destinatario_id text NOT NULL REFERENCES convocacao_destinatarios(id),
        funcao_id text NOT NULL REFERENCES funcoes(id),
        vinculo_funcional_id text NOT NULL REFERENCES vinculos_funcionais(id),
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      INSERT INTO funcoes (id, nome, codigo, ativo) VALUES
        ('${TARGET}', 'Diácono Casa de Oração', NULL, 1),
        ('${TECHNICAL}', 'Diácono Casa de Oração', 'DCO', 1);

      INSERT INTO membros (id) VALUES ('m1'), ('m2');
      INSERT INTO casas (id) VALUES ('c1'), ('c2');

      -- colisão: já existe vínculo institucional equivalente para m1/c1
      INSERT INTO vinculos_funcionais
        (id, membro_id, funcao_id, casa_id, ativo)
      VALUES
        ('v-target', 'm1', '${TARGET}', 'c1', 1),
        ('v-collision', 'm1', '${TECHNICAL}', 'c1', 1),
        ('v-promote', 'm2', '${TECHNICAL}', 'c2', 1);

      INSERT INTO convocacoes (id, status) VALUES
        ('draft-a', 'RASCUNHO'),
        ('draft-b', 'RASCUNHO'),
        ('published', 'PUBLICADA');

      INSERT INTO convocacao_funcoes (id, convocacao_id, funcao_id) VALUES
        ('cf-draft-a-source', 'draft-a', '${TECHNICAL}'),
        ('cf-draft-b-target', 'draft-b', '${TARGET}'),
        ('cf-draft-b-source', 'draft-b', '${TECHNICAL}'),
        ('cf-published-source', 'published', '${TECHNICAL}');

      INSERT INTO convocacao_destinatarios (id) VALUES ('dest-1'), ('dest-2');

      INSERT INTO convocacao_destinatario_evidencias
        (id, convocacao_destinatario_id, funcao_id, vinculo_funcional_id)
      VALUES
        ('ev-collision', 'dest-1', '${TECHNICAL}', 'v-collision'),
        ('ev-promote', 'dest-2', '${TECHNICAL}', 'v-promote');
    `)

    const dirname = path.dirname(fileURLToPath(import.meta.url))
    const migration = readFileSync(
      path.resolve(dirname, '../../drizzle/0035_consolidar_dco_institucional.sql'),
      'utf8'
    )
    sqlite.exec(migration)

    const funcoes = sqlite.prepare(
      "SELECT id, codigo, ativo FROM funcoes WHERE nome = 'Diácono Casa de Oração' ORDER BY id"
    ).all() as any[]

    expect(funcoes.find(f => f.id === TARGET)).toMatchObject({ codigo: 'DCO', ativo: 1 })
    expect(funcoes.find(f => f.id === TECHNICAL)).toMatchObject({ codigo: null, ativo: 0 })

    expect(sqlite.prepare("SELECT funcao_id, ativo FROM vinculos_funcionais WHERE id = 'v-collision'").get())
      .toMatchObject({ funcao_id: TECHNICAL, ativo: 0 })
    expect(sqlite.prepare("SELECT funcao_id, ativo FROM vinculos_funcionais WHERE id = 'v-promote'").get())
      .toMatchObject({ funcao_id: TARGET, ativo: 1 })

    expect(sqlite.prepare("SELECT funcao_id FROM convocacao_destinatario_evidencias WHERE id = 'ev-collision'").get())
      .toMatchObject({ funcao_id: TECHNICAL })
    expect(sqlite.prepare("SELECT funcao_id FROM convocacao_destinatario_evidencias WHERE id = 'ev-promote'").get())
      .toMatchObject({ funcao_id: TARGET })

    const draftA = sqlite.prepare("SELECT funcao_id FROM convocacao_funcoes WHERE convocacao_id = 'draft-a'").all() as any[]
    const draftB = sqlite.prepare("SELECT funcao_id FROM convocacao_funcoes WHERE convocacao_id = 'draft-b'").all() as any[]
    const published = sqlite.prepare("SELECT funcao_id FROM convocacao_funcoes WHERE convocacao_id = 'published'").all() as any[]

    expect(draftA.map(x => x.funcao_id)).toEqual([TARGET])
    expect(draftB.map(x => x.funcao_id)).toEqual([TARGET])
    expect(published.map(x => x.funcao_id)).toEqual([TECHNICAL])
  })

  it('não altera a DCO técnica em ambiente novo sem função institucional preexistente', () => {
    const sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE funcoes (
        id text PRIMARY KEY NOT NULL,
        nome text NOT NULL,
        codigo text,
        descricao text,
        ativo integer DEFAULT 1 NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE UNIQUE INDEX idx_funcoes_dco_unico ON funcoes(codigo) WHERE codigo = 'DCO';
      CREATE TABLE vinculos_funcionais (
        id text PRIMARY KEY NOT NULL, membro_id text NOT NULL, funcao_id text NOT NULL,
        regional_id text, administracao_id text, setor_id text, casa_id text,
        grupo_trabalho_id text, ativo integer DEFAULT 1 NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE TABLE convocacoes (id text PRIMARY KEY NOT NULL, status text NOT NULL);
      CREATE TABLE convocacao_funcoes (
        id text PRIMARY KEY NOT NULL, convocacao_id text NOT NULL, funcao_id text NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE TABLE convocacao_destinatario_evidencias (
        id text PRIMARY KEY NOT NULL, convocacao_destinatario_id text NOT NULL,
        funcao_id text NOT NULL, vinculo_funcional_id text NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      INSERT INTO funcoes (id, nome, codigo, ativo)
      VALUES ('${TECHNICAL}', 'Diácono Casa de Oração', 'DCO', 1);
    `)

    const dirname = path.dirname(fileURLToPath(import.meta.url))
    const migration = readFileSync(
      path.resolve(dirname, '../../drizzle/0035_consolidar_dco_institucional.sql'),
      'utf8'
    )
    sqlite.exec(migration)

    expect(sqlite.prepare("SELECT codigo, ativo FROM funcoes WHERE id = ?").get(TECHNICAL))
      .toMatchObject({ codigo: 'DCO', ativo: 1 })
  })
})
