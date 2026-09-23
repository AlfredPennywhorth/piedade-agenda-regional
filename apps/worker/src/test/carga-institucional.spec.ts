import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { setupDb } from './setup'

describe('DATA-06 — contrato da carga institucional', () => {
  let sqlite: Database.Database

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES
        ('regional-sp', 'Regional São Paulo'),
        ('regional-outra', 'Regional Outra');

      INSERT INTO administracoes (id, regional_id, nome) VALUES
        ('adm-sp', 'regional-sp', 'Administração São Paulo'),
        ('adm-outra', 'regional-outra', 'Administração Outra');

      INSERT INTO setores (id, administracao_id, nome) VALUES
        ('setor-a', 'adm-sp', 'Setor A'),
        ('setor-b', 'adm-sp', 'Setor B'),
        ('setor-outra', 'adm-outra', 'Setor Outra');

      INSERT INTO casas (id, setor_id, nome, codigo) VALUES
        ('casa-a', 'setor-a', 'Casa A', 'BR-21-0001'),
        ('casa-b', 'setor-b', 'Casa B', 'BR-21-0002');

      INSERT INTO grupos_trabalho
        (id, nome, regional_id, administracao_id, setor_id, ativo)
      VALUES
        ('gt-regional', 'GT Regional', 'regional-sp', NULL, NULL, 1),
        ('gt-setorial', 'GT Setorial inválido', NULL, NULL, 'setor-a', 1);

      INSERT INTO pre_cadastros_ministeriais
        (id, nome, ministerio, rrm, regional_id, casa_id, ativo)
      VALUES
        ('pre-1', 'Diácono Exemplo', 'Diácono', 'SÃO PAULO - SP', 'regional-sp', 'casa-a', 1);
    `)
  })

  it('carga estrutural pode ser aplicada do zero e reaplicada sem duplicar registros', () => {
    sqlite.exec(`
      DELETE FROM pre_cadastros_ministeriais;
      DELETE FROM grupos_trabalho;
      DELETE FROM casas;
      DELETE FROM setores;
    `)

    expect(sqlite.prepare("SELECT COUNT(*) total FROM setores").get()).toEqual({ total: 0 })
    expect(sqlite.prepare("SELECT COUNT(*) total FROM casas").get()).toEqual({ total: 0 })
    expect(sqlite.prepare("SELECT COUNT(*) total FROM grupos_trabalho").get()).toEqual({ total: 0 })
    expect(sqlite.prepare("SELECT COUNT(*) total FROM pre_cadastros_ministeriais").get()).toEqual({ total: 0 })

    const carga = `
      INSERT OR IGNORE INTO setores
        (id, administracao_id, nome, ativo)
      VALUES
        ('setor-a', 'adm-sp', 'Setor A', 1);

      INSERT OR IGNORE INTO casas
        (id, setor_id, nome, codigo, ativo)
      VALUES
        ('casa-a', 'setor-a', 'Casa A', 'BR-21-0001', 1);

      INSERT OR IGNORE INTO grupos_trabalho
        (id, nome, ativo, regional_id, administracao_id, setor_id)
      VALUES
        ('gt-regional', 'GT Regional', 1, 'regional-sp', NULL, NULL);

      INSERT OR IGNORE INTO pre_cadastros_ministeriais
        (id, nome, ministerio, rrm, regional_id, casa_id, ativo)
      VALUES
        ('pre-1', 'Diácono Exemplo', 'Diácono', 'SÃO PAULO - SP', 'regional-sp', 'casa-a', 1);
    `

    sqlite.exec(carga)
    sqlite.exec(carga)

    expect(
      sqlite.prepare("SELECT COUNT(*) total FROM setores WHERE id = 'setor-a'").get()
    ).toEqual({ total: 1 })
    expect(
      sqlite.prepare("SELECT COUNT(*) total FROM casas WHERE id = 'casa-a'").get()
    ).toEqual({ total: 1 })
    expect(
      sqlite.prepare("SELECT COUNT(*) total FROM grupos_trabalho WHERE id = 'gt-regional'").get()
    ).toEqual({ total: 1 })
    expect(
      sqlite.prepare("SELECT COUNT(*) total FROM pre_cadastros_ministeriais WHERE id = 'pre-1'").get()
    ).toEqual({ total: 1 })
  })

  it('participação válida exige GT Regional e Setor da mesma Regional', () => {
    sqlite.prepare(`
      INSERT INTO participacoes_grupos_trabalho
        (id, grupo_trabalho_id, setor_representado_id, pre_cadastro_ministerial_id, papel, ativo)
      VALUES
        ('part-ok', 'gt-regional', 'setor-a', 'pre-1', 'RESPONSAVEL', 1)
    `).run()

    const item = sqlite.prepare(`
      SELECT grupo_trabalho_id, setor_representado_id, papel
      FROM participacoes_grupos_trabalho
      WHERE id = 'part-ok'
    `).get()

    expect(item).toEqual({
      grupo_trabalho_id: 'gt-regional',
      setor_representado_id: 'setor-a',
      papel: 'RESPONSAVEL',
    })
  })

  it('rejeita participação em GT que não seja Regional', () => {
    expect(() =>
      sqlite.prepare(`
        INSERT INTO participacoes_grupos_trabalho
          (id, grupo_trabalho_id, setor_representado_id, pre_cadastro_ministerial_id, papel, ativo)
        VALUES
          ('part-gt-invalido', 'gt-setorial', 'setor-a', 'pre-1', 'RESPONSAVEL', 1)
      `).run()
    ).toThrow(/GT_DEVE_SER_REGIONAL/)
  })

  it('rejeita representante de Setor pertencente a outra Regional', () => {
    expect(() =>
      sqlite.prepare(`
        INSERT INTO participacoes_grupos_trabalho
          (id, grupo_trabalho_id, setor_representado_id, pre_cadastro_ministerial_id, papel, ativo)
        VALUES
          ('part-regional-invalida', 'gt-regional', 'setor-outra', 'pre-1', 'RESPONSAVEL', 1)
      `).run()
    ).toThrow(/SETOR_FORA_DA_REGIONAL_DO_GT/)
  })

  it('impede duplicação ativa do mesmo papel/vínculo de GT', () => {
    const insert = sqlite.prepare(`
      INSERT INTO participacoes_grupos_trabalho
        (id, grupo_trabalho_id, setor_representado_id, pre_cadastro_ministerial_id, papel, ativo)
      VALUES (?, 'gt-regional', 'setor-a', 'pre-1', 'SUPLENTE', 1)
    `)

    insert.run('part-1')
    expect(() => insert.run('part-2')).toThrow(/UNIQUE constraint failed/)
  })

  it('falha se a ordem da carga tentar referenciar Casa antes da estrutura territorial', () => {
    expect(() =>
      sqlite.prepare(`
        INSERT INTO pre_cadastros_ministeriais
          (id, nome, ministerio, rrm, regional_id, casa_id, ativo)
        VALUES
          ('pre-sem-casa', 'Outro Diácono', 'Diácono', 'SÃO PAULO - SP',
           'regional-sp', 'casa-inexistente', 1)
      `).run()
    ).toThrow(/FOREIGN KEY constraint failed/)
  })
})
