import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { setupDb } from './setup'

describe('DATA-05 — representantes setoriais dos GTs Regionais', () => {
  let sqlite: Database.Database

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)

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

      INSERT INTO grupos_trabalho
        (id, nome, regional_id, administracao_id, setor_id, ativo)
      VALUES
        ('gt-regional-a', 'GT Regional A', 'regional-a', NULL, NULL, 1),
        ('gt-adm-a', 'GT Legado Administração A', NULL, 'adm-a', NULL, 1);

      INSERT INTO pre_cadastros_ministeriais
        (id, nome, ministerio, rrm, regional_id, casa_id, data_ordenacao, ativo)
      VALUES
        ('pre-a', 'Diácono A', 'Diácono', 'REGIONAL A', 'regional-a', 'casa-a', '2010-01-01', 1),
        ('pre-b', 'Diácono B', 'Diácono', 'REGIONAL B', 'regional-b', 'casa-b', '2011-01-01', 1);
    `)
  })

  it('aceita responsável de Setor pertencente à mesma Regional do GT', () => {
    expect(() => sqlite.exec(`
      INSERT INTO participacoes_grupos_trabalho
        (id, grupo_trabalho_id, setor_representado_id, pre_cadastro_ministerial_id, papel)
      VALUES
        ('p-1', 'gt-regional-a', 'setor-a', 'pre-a', 'RESPONSAVEL');
    `)).not.toThrow()
  })

  it('aceita suplente de Setor pertencente à mesma Regional do GT', () => {
    expect(() => sqlite.exec(`
      INSERT INTO participacoes_grupos_trabalho
        (id, grupo_trabalho_id, setor_representado_id, pre_cadastro_ministerial_id, papel)
      VALUES
        ('p-2', 'gt-regional-a', 'setor-a', 'pre-a', 'SUPLENTE');
    `)).not.toThrow()
  })

  it('rejeita papel fora da lista canônica', () => {
    expect(() => sqlite.exec(`
      INSERT INTO participacoes_grupos_trabalho
        (id, grupo_trabalho_id, setor_representado_id, pre_cadastro_ministerial_id, papel)
      VALUES
        ('p-3', 'gt-regional-a', 'setor-a', 'pre-a', 'COORDENADOR');
    `)).toThrow()
  })

  it('rejeita participação em GT legado que não seja Regional', () => {
    expect(() => sqlite.exec(`
      INSERT INTO participacoes_grupos_trabalho
        (id, grupo_trabalho_id, setor_representado_id, pre_cadastro_ministerial_id, papel)
      VALUES
        ('p-4', 'gt-adm-a', 'setor-a', 'pre-a', 'RESPONSAVEL');
    `)).toThrow(/GT_DEVE_SER_REGIONAL/)
  })

  it('rejeita Setor de outra Regional', () => {
    expect(() => sqlite.exec(`
      INSERT INTO participacoes_grupos_trabalho
        (id, grupo_trabalho_id, setor_representado_id, pre_cadastro_ministerial_id, papel)
      VALUES
        ('p-5', 'gt-regional-a', 'setor-b', 'pre-b', 'RESPONSAVEL');
    `)).toThrow(/SETOR_FORA_DA_REGIONAL_DO_GT/)
  })

  it('impede duplicidade ativa da mesma participação e papel', () => {
    sqlite.exec(`
      INSERT INTO participacoes_grupos_trabalho
        (id, grupo_trabalho_id, setor_representado_id, pre_cadastro_ministerial_id, papel)
      VALUES
        ('p-6', 'gt-regional-a', 'setor-a', 'pre-a', 'RESPONSAVEL');
    `)

    expect(() => sqlite.exec(`
      INSERT INTO participacoes_grupos_trabalho
        (id, grupo_trabalho_id, setor_representado_id, pre_cadastro_ministerial_id, papel)
      VALUES
        ('p-7', 'gt-regional-a', 'setor-a', 'pre-a', 'RESPONSAVEL');
    `)).toThrow()
  })
})
