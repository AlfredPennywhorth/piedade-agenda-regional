import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'
import { obterCapacidadesMembro } from '../security/permissoes'
import { setupDb } from './setup'

describe('ACC-11 — capacidades consolidadas da conta', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle>

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    db = drizzle(sqlite, { schema })

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES ('regional-1', 'Regional 1');
      INSERT INTO administracoes (id, regional_id, nome)
        VALUES ('adm-1', 'regional-1', 'Administração 1');
      INSERT INTO setores (id, administracao_id, nome)
        VALUES ('setor-1', 'adm-1', 'Setor 1');
      INSERT INTO casas (id, setor_id, nome)
        VALUES ('casa-1', 'setor-1', 'Casa 1');
      INSERT INTO membros (id, nome, casa_id, ativo)
        VALUES ('membro-1', 'Membro 1', 'casa-1', 1);
      INSERT INTO contas_acesso (id, membro_id, status, ativado_em)
        VALUES ('conta-1', 'membro-1', 'ATIVA', CURRENT_TIMESTAMP);
    `)
  })

  it('parte de capacidades restritas por padrão', async () => {
    await expect(obterCapacidadesMembro(db, 'membro-1', 'conta-1')).resolves.toEqual({
      podeVisualizarRelatorios: false,
      podeVisualizarAuditoria: false,
      podeOperarPortaria: false,
      podeAdministrarAcessos: false,
    })
  })

  it('perfil técnico de Relatórios habilita somente Relatórios', async () => {
    sqlite.exec(`
      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('acesso-rel', 'conta-1', 'GESTOR_RELATORIOS', 'REGIONAL', 'regional-1');
    `)

    const capacidades = await obterCapacidadesMembro(db, 'membro-1', 'conta-1')
    expect(capacidades.podeVisualizarRelatorios).toBe(true)
    expect(capacidades.podeVisualizarAuditoria).toBe(false)
    expect(capacidades.podeOperarPortaria).toBe(false)
    expect(capacidades.podeAdministrarAcessos).toBe(false)
  })

  it('perfil técnico de Auditor habilita Auditoria', async () => {
    sqlite.exec(`
      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('acesso-aud', 'conta-1', 'AUDITOR', 'REGIONAL', 'regional-1');
    `)

    const capacidades = await obterCapacidadesMembro(db, 'membro-1', 'conta-1')
    expect(capacidades.podeVisualizarAuditoria).toBe(true)
  })

  it('perfil técnico de Portaria habilita Portaria', async () => {
    sqlite.exec(`
      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('acesso-portaria', 'conta-1', 'OPERADOR_PORTARIA_PERMANENTE', 'REGIONAL', 'regional-1');
    `)

    const capacidades = await obterCapacidadesMembro(db, 'membro-1', 'conta-1')
    expect(capacidades.podeOperarPortaria).toBe(true)
  })

  it('Administrador Regional pode administrar acessos', async () => {
    sqlite.exec(`
      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('acesso-admin', 'conta-1', 'ADMINISTRADOR_SISTEMA', 'REGIONAL', 'regional-1');
    `)

    const capacidades = await obterCapacidadesMembro(db, 'membro-1', 'conta-1')
    expect(capacidades.podeAdministrarAcessos).toBe(true)
  })

  it('Master global pode administrar acessos', async () => {
    sqlite.exec(`
      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('acesso-master', 'conta-1', 'MASTER_SISTEMA', 'GLOBAL', NULL);
    `)

    const capacidades = await obterCapacidadesMembro(db, 'membro-1', 'conta-1')
    expect(capacidades.podeAdministrarAcessos).toBe(true)
  })
})
