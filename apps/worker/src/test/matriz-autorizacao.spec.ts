import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'
import { obterCapacidadesMembro } from '../security/permissoes'
import { setupDb } from './setup'

describe('QA-AUTH-01 — matriz de capacidades por perfil técnico', () => {
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

      INSERT INTO membros (id, nome, casa_id, ativo) VALUES
        ('m-comum', 'Usuário Comum', 'casa-1', 1),
        ('m-rel', 'Gestor Relatórios', 'casa-1', 1),
        ('m-aud', 'Auditor', 'casa-1', 1),
        ('m-port', 'Operador Portaria', 'casa-1', 1),
        ('m-admin', 'Administrador Regional', 'casa-1', 1),
        ('m-master', 'Master', 'casa-1', 1);

      INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES
        ('c-comum', 'm-comum', 'ATIVA', CURRENT_TIMESTAMP),
        ('c-rel', 'm-rel', 'ATIVA', CURRENT_TIMESTAMP),
        ('c-aud', 'm-aud', 'ATIVA', CURRENT_TIMESTAMP),
        ('c-port', 'm-port', 'ATIVA', CURRENT_TIMESTAMP),
        ('c-admin', 'm-admin', 'ATIVA', CURRENT_TIMESTAMP),
        ('c-master', 'm-master', 'ATIVA', CURRENT_TIMESTAMP);

      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('a-comum', 'c-comum', 'USUARIO_COMUM', 'CASA', 'casa-1'),
        ('a-rel', 'c-rel', 'GESTOR_RELATORIOS', 'REGIONAL', 'regional-1'),
        ('a-aud', 'c-aud', 'AUDITOR', 'REGIONAL', 'regional-1'),
        ('a-port', 'c-port', 'OPERADOR_PORTARIA_PERMANENTE', 'REGIONAL', 'regional-1'),
        ('a-admin', 'c-admin', 'ADMINISTRADOR_SISTEMA', 'REGIONAL', 'regional-1'),
        ('a-master', 'c-master', 'MASTER_SISTEMA', 'GLOBAL', NULL);
    `)
  })

  it.each([
    {
      membroId: 'm-comum',
      contaId: 'c-comum',
      esperado: {
        podeVisualizarRelatorios: false,
        podeVisualizarAuditoria: false,
        podeOperarPortaria: false,
        podeAdministrarAcessos: false,
      },
    },
    {
      membroId: 'm-rel',
      contaId: 'c-rel',
      esperado: {
        podeVisualizarRelatorios: true,
        podeVisualizarAuditoria: false,
        podeOperarPortaria: false,
        podeAdministrarAcessos: false,
      },
    },
    {
      membroId: 'm-aud',
      contaId: 'c-aud',
      esperado: {
        podeVisualizarRelatorios: false,
        podeVisualizarAuditoria: true,
        podeOperarPortaria: false,
        podeAdministrarAcessos: false,
      },
    },
    {
      membroId: 'm-port',
      contaId: 'c-port',
      esperado: {
        podeVisualizarRelatorios: false,
        podeVisualizarAuditoria: false,
        podeOperarPortaria: true,
        podeAdministrarAcessos: false,
      },
    },
    {
      membroId: 'm-admin',
      contaId: 'c-admin',
      esperado: {
        podeVisualizarRelatorios: false,
        podeVisualizarAuditoria: false,
        podeOperarPortaria: false,
        podeAdministrarAcessos: true,
      },
    },
    {
      membroId: 'm-master',
      contaId: 'c-master',
      esperado: {
        // O backend de Relatórios já autoriza Master global; /auth/me deve
        // refletir a mesma autorização para não esconder o módulo no frontend.
        podeVisualizarRelatorios: true,
        podeVisualizarAuditoria: false,
        podeOperarPortaria: false,
        podeAdministrarAcessos: true,
      },
    },
  ])('$membroId expõe somente as capacidades previstas', async ({ membroId, contaId, esperado }) => {
    await expect(obterCapacidadesMembro(db, membroId, contaId)).resolves.toEqual(esperado)
  })
})
