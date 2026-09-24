import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'
import {
  carregarContextoPermissoes,
  obterEscoposTerritoriaisVisiveis,
} from '../security/permissoes'
import { setupDb } from './setup'

describe('SEC — visibilidade territorial', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle>

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    db = drizzle(sqlite, { schema })

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES
        ('regional-1', 'Regional 1'),
        ('regional-2', 'Regional 2');

      INSERT INTO administracoes (id, regional_id, nome) VALUES
        ('adm-1', 'regional-1', 'Administração 1'),
        ('adm-2', 'regional-2', 'Administração 2');

      INSERT INTO setores (id, administracao_id, nome) VALUES
        ('setor-1', 'adm-1', 'Setor 1'),
        ('setor-1b', 'adm-1', 'Setor 1B'),
        ('setor-2', 'adm-2', 'Setor 2');

      INSERT INTO casas (id, setor_id, nome) VALUES
        ('casa-1', 'setor-1', 'Casa 1'),
        ('casa-1b', 'setor-1b', 'Casa 1B'),
        ('casa-2', 'setor-2', 'Casa 2');

      INSERT INTO grupos_trabalho (id, nome, regional_id, ativo) VALUES
        ('gt-1', 'GT 1', 'regional-1', 1),
        ('gt-2', 'GT 2', 'regional-2', 1);

      INSERT INTO membros (id, nome, casa_id, ativo) VALUES
        ('m-comum', 'Comum', 'casa-1', 1),
        ('m-admin', 'Admin', 'casa-1', 1),
        ('m-master', 'Master', 'casa-1', 1);

      INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES
        ('c-comum', 'm-comum', 'ATIVA', CURRENT_TIMESTAMP),
        ('c-admin', 'm-admin', 'ATIVA', CURRENT_TIMESTAMP),
        ('c-master', 'm-master', 'ATIVA', CURRENT_TIMESTAMP);

      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('a-comum', 'c-comum', 'USUARIO_COMUM', 'CASA', 'casa-1'),
        ('a-admin', 'c-admin', 'ADMINISTRADOR_SISTEMA', 'REGIONAL', 'regional-1'),
        ('a-master', 'c-master', 'MASTER_SISTEMA', 'GLOBAL', NULL);
    `)
  })

  it('usuário comum enxerga somente a própria Casa e sua cadeia ancestral', async () => {
    const contexto = await carregarContextoPermissoes(db, 'm-comum', 'c-comum')
    const visiveis = await obterEscoposTerritoriaisVisiveis(db, contexto)

    expect(visiveis.tudo).toBe(false)
    expect([...visiveis.regionaisIds]).toEqual(['regional-1'])
    expect([...visiveis.administracoesIds]).toEqual(['adm-1'])
    expect([...visiveis.setoresIds]).toEqual(['setor-1'])
    expect([...visiveis.casasIds]).toEqual(['casa-1'])
    expect(visiveis.casasIds.has('casa-1b')).toBe(false)
    expect(visiveis.regionaisIds.has('regional-2')).toBe(false)
  })

  it('Administrador Regional enxerga todos os descendentes e GTs da própria Regional', async () => {
    const contexto = await carregarContextoPermissoes(db, 'm-admin', 'c-admin')
    const visiveis = await obterEscoposTerritoriaisVisiveis(db, contexto)

    expect(visiveis.tudo).toBe(false)
    expect(visiveis.regionaisIds.has('regional-1')).toBe(true)
    expect(visiveis.administracoesIds.has('adm-1')).toBe(true)
    expect(visiveis.setoresIds.has('setor-1')).toBe(true)
    expect(visiveis.setoresIds.has('setor-1b')).toBe(true)
    expect(visiveis.casasIds.has('casa-1')).toBe(true)
    expect(visiveis.casasIds.has('casa-1b')).toBe(true)
    expect(visiveis.gruposTrabalhoIds.has('gt-1')).toBe(true)

    expect(visiveis.regionaisIds.has('regional-2')).toBe(false)
    expect(visiveis.casasIds.has('casa-2')).toBe(false)
    expect(visiveis.gruposTrabalhoIds.has('gt-2')).toBe(false)
  })

  it('Master recebe visibilidade global', async () => {
    const contexto = await carregarContextoPermissoes(db, 'm-master', 'c-master')
    const visiveis = await obterEscoposTerritoriaisVisiveis(db, contexto)

    expect(visiveis.tudo).toBe(true)
  })
})
