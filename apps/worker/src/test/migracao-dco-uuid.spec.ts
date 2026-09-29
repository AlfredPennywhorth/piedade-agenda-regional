import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { CreateVinculoFuncionalSchema } from '@piedade/shared'

describe('Migration 0034 - DCO canônica com UUID', () => {
  it('substitui o identificador legado e preserva referências', () => {
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

      CREATE TABLE vinculos_funcionais (
        id text PRIMARY KEY NOT NULL,
        funcao_id text NOT NULL REFERENCES funcoes(id)
      );

      CREATE TABLE convocacao_funcoes (
        id text PRIMARY KEY NOT NULL,
        funcao_id text NOT NULL REFERENCES funcoes(id)
      );

      CREATE TABLE convocacao_destinatario_evidencias (
        id text PRIMARY KEY NOT NULL,
        funcao_id text NOT NULL REFERENCES funcoes(id)
      );

      INSERT INTO funcoes (id, nome, codigo, descricao, ativo)
      VALUES ('funcao-dco-canonica', 'Diácono Casa de Oração', 'DCO', 'Legado', 1);

      INSERT INTO vinculos_funcionais (id, funcao_id)
      VALUES ('v1', 'funcao-dco-canonica');

      INSERT INTO convocacao_funcoes (id, funcao_id)
      VALUES ('cf1', 'funcao-dco-canonica');

      INSERT INTO convocacao_destinatario_evidencias (id, funcao_id)
      VALUES ('e1', 'funcao-dco-canonica');
    `)

    const dirname = path.dirname(fileURLToPath(import.meta.url))
    const migration = readFileSync(
      path.resolve(dirname, '../../drizzle/0034_dco_canonical_uuid.sql'),
      'utf8'
    )
    sqlite.exec(migration)

    const dco = sqlite.prepare("SELECT id, codigo FROM funcoes WHERE codigo = 'DCO'").get() as any
    expect(dco.id).toBe('d0c0d0c0-0000-4000-8000-000000000001')

    const vinculo = sqlite.prepare('SELECT funcao_id FROM vinculos_funcionais WHERE id = ?').get('v1') as any
    const convocacaoFuncao = sqlite.prepare('SELECT funcao_id FROM convocacao_funcoes WHERE id = ?').get('cf1') as any
    const evidencia = sqlite.prepare('SELECT funcao_id FROM convocacao_destinatario_evidencias WHERE id = ?').get('e1') as any

    expect(vinculo.funcao_id).toBe(dco.id)
    expect(convocacaoFuncao.funcao_id).toBe(dco.id)
    expect(evidencia.funcao_id).toBe(dco.id)

    expect(CreateVinculoFuncionalSchema.safeParse({
      membroId: '11111111-1111-4111-8111-111111111111',
      funcaoId: dco.id,
      casaId: '22222222-2222-4222-8222-222222222222',
    }).success).toBe(true)
  })
})
