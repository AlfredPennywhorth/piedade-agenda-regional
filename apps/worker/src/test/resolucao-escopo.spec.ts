import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'
import { obterRegionalDoEscopo } from '../security/permissoes'
import { setupDb } from './setup'

describe('Resolução de Regional por escopo — ACC-09', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle>

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    db = drizzle(sqlite, { schema })

    sqlite.exec(`
      INSERT INTO regionais (id, nome)
      VALUES ('regional-1', 'Regional 1');

      INSERT INTO administracoes (id, regional_id, nome)
      VALUES ('administracao-1', 'regional-1', 'Administração 1');

      INSERT INTO setores (id, administracao_id, nome)
      VALUES ('setor-1', 'administracao-1', 'Setor 1');

      INSERT INTO casas (id, setor_id, nome)
      VALUES ('casa-1', 'setor-1', 'Casa 1');

      INSERT INTO grupos_trabalho (id, nome, regional_id)
      VALUES ('gt-regional', 'GT Regional', 'regional-1');

      INSERT INTO grupos_trabalho (id, nome, administracao_id)
      VALUES ('gt-administracao', 'GT Administração', 'administracao-1');

      INSERT INTO grupos_trabalho (id, nome, setor_id)
      VALUES ('gt-setor', 'GT Setor', 'setor-1');
    `)
  })

  it('resolve Regional diretamente', async () => {
    expect(await obterRegionalDoEscopo(db, 'REGIONAL', 'regional-1')).toBe('regional-1')
  })

  it('resolve Regional a partir da Administração', async () => {
    expect(await obterRegionalDoEscopo(db, 'ADMINISTRACAO', 'administracao-1')).toBe('regional-1')
  })

  it('resolve Regional a partir do Setor', async () => {
    expect(await obterRegionalDoEscopo(db, 'SETOR', 'setor-1')).toBe('regional-1')
  })

  it('resolve Regional a partir da Casa', async () => {
    expect(await obterRegionalDoEscopo(db, 'CASA', 'casa-1')).toBe('regional-1')
  })

  it('resolve Regional para GT regional', async () => {
    expect(await obterRegionalDoEscopo(db, 'GRUPO_TRABALHO', 'gt-regional')).toBe('regional-1')
  })

  it('resolve Regional para GT vinculado à Administração', async () => {
    expect(await obterRegionalDoEscopo(db, 'GRUPO_TRABALHO', 'gt-administracao')).toBe('regional-1')
  })

  it('resolve Regional para GT vinculado ao Setor', async () => {
    expect(await obterRegionalDoEscopo(db, 'GRUPO_TRABALHO', 'gt-setor')).toBe('regional-1')
  })

  it('retorna null para escopo inexistente', async () => {
    expect(await obterRegionalDoEscopo(db, 'CASA', 'casa-inexistente')).toBeNull()
  })
})
