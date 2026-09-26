import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { setupDb } from './setup'
import { registrarCienciaPmo } from './responsabilidade-pmo-test-helper'
import {
  RESPONSABILIDADE_PMO_TEXTO,
  RESPONSABILIDADE_PMO_VERSAO,
} from '../routes/governanca/responsabilidade-regional'

describe('Perfis, escopos e governança — PR-ACC-03', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle>
  let app: ReturnType<typeof createApp>
  const bootstrapSecret = 'segredo-de-bootstrap-com-mais-de-32-caracteres'

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema })
    setupDb(sqlite)
    app = createApp(db)

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES ('regional-1', 'Regional São Paulo');
      INSERT INTO administracoes (id, regional_id, nome)
        VALUES ('administracao-1', 'regional-1', 'Administração');
      INSERT INTO setores (id, administracao_id, nome)
        VALUES ('setor-1', 'administracao-1', 'Setor');
      INSERT INTO casas (id, setor_id, nome)
        VALUES ('casa-1', 'setor-1', 'Casa');

      INSERT INTO membros
        (id, nome, celular, data_ordenacao, codigo_carteirinha, casa_id, ativo)
        VALUES
        ('membro-master', 'Master Inicial', '11999990001', '2000-01-01',
          'CARTEIRA-MASTER', 'casa-1', 1),
        ('membro-pmo', 'PMO Regional', '11999990002', '2001-02-02',
          'CARTEIRA-PMO', 'casa-1', 1);

      INSERT INTO contas_acesso (id, membro_id, status, ativado_em)
        VALUES
        ('conta-master', 'membro-master', 'ATIVA', CURRENT_TIMESTAMP),
        ('conta-pmo', 'membro-pmo', 'ATIVA', CURRENT_TIMESTAMP);
    `)
  })

  async function requisicao(
    path: string,
    init?: RequestInit,
    env: Record<string, string> = {}
  ) {
    return app.request(path, init, {
      APP_ENV: 'test',
      APP_VERSION: 'test',
      PIN_PEPPER: 'pepper-de-teste',
      MASTER_BOOTSTRAP_SECRET: bootstrapSecret,
      ...env,
    } as any)
  }

  it('nega bootstrap sem o segredo configurado correto', async () => {
    const response = await requisicao(
      '/api/v1/bootstrap/master',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bootstrap-Secret': 'incorreto',
        },
        body: JSON.stringify({
          codigoCarteirinha: 'CARTEIRA-MASTER',
          confirmacao: 'CRIAR PRIMEIRO MASTER',
        }),
      }
    )

    expect(response.status).toBe(401)
  })

  it('cria o primeiro Master global uma única vez e audita a operação', async () => {
    const executar = () =>
      requisicao('/api/v1/bootstrap/master', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bootstrap-Secret': bootstrapSecret,
        },
        body: JSON.stringify({
          codigoCarteirinha: 'CARTEIRA-MASTER',
          confirmacao: 'CRIAR PRIMEIRO MASTER',
        }),
      })

    const primeira = await executar()
    expect(primeira.status).toBe(201)

    const acesso = sqlite
      .prepare(
        `SELECT perfil_codigo, escopo_tipo, escopo_id
         FROM acessos_conta WHERE conta_acesso_id = ?`
      )
      .get('conta-master') as any

    expect(acesso).toEqual({
      perfil_codigo: 'MASTER_SISTEMA',
      escopo_tipo: 'GLOBAL',
      escopo_id: null,
    })

    const auditoria = sqlite
      .prepare(`SELECT acao, ator_conta_acesso_id FROM auditoria_logs`)
      .get() as any
    expect(auditoria.acao).toBe('BOOTSTRAP_PRIMEIRO_MASTER')
    expect(auditoria.ator_conta_acesso_id).toBe('conta-master')

    const segunda = await executar()
    expect(segunda.status).toBe(409)
  })

  it('impede Master com escopo institucional', () => {
    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO acessos_conta
            (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          'acesso-invalido',
          'conta-master',
          'MASTER_SISTEMA',
          'REGIONAL',
          'regional-1'
        )
    ).toThrow(/CHECK/)
  })

  it('registra ciência versionada do PMO sem tratá-la como consentimento', async () => {
    sqlite
      .prepare(
        `INSERT INTO acessos_conta
          (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        'acesso-pmo',
        'conta-pmo',
        'ADMINISTRADOR_SISTEMA',
        'REGIONAL',
        'regional-1'
      )

    const token = 'token-sessao-pmo'
    const tokenHash = await hashToken(token)
    const agora = new Date().toISOString()
    sqlite
      .prepare(
        `INSERT INTO sessoes
          (id, conta_acesso_id, membro_id, token_hash, expira_em,
           ultimo_acesso_em, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'sessao-pmo',
        'conta-pmo',
        'membro-pmo',
        tokenHash,
        new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        agora,
        agora
      )

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    const bloqueadoAntesDaCiencia = await requisicao('/api/v1/admin/acessos', { headers })
    expect(bloqueadoAntesDaCiencia.status).toBe(403)

    const consulta = await requisicao(
      '/api/v1/governanca/responsabilidade-regional',
      { headers }
    )
    expect(consulta.status).toBe(200)
    const texto = (await consulta.json()) as any
    expect(texto.versao).toBe(RESPONSABILIDADE_PMO_VERSAO)
    expect(texto.texto).toBe(RESPONSABILIDADE_PMO_TEXTO)
    expect(texto.texto).toContain('não constitui consentimento')
    expect(texto.acessos[0].ciente).toBe(false)

    const ciencia = await requisicao(
      '/api/v1/governanca/responsabilidade-regional/ciencia',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          acessoContaId: 'acesso-pmo',
          versao: RESPONSABILIDADE_PMO_VERSAO,
          ciente: true,
        }),
      }
    )
    expect(ciencia.status).toBe(201)

    const registro = sqlite
      .prepare(
        `SELECT versao_texto, texto_hash, ciente_em
         FROM ciencias_responsabilidade WHERE acesso_conta_id = ?`
      )
      .get('acesso-pmo') as any
    expect(registro.versao_texto).toBe(RESPONSABILIDADE_PMO_VERSAO)
    expect(registro.texto_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(registro.ciente_em).toBeTruthy()

    const liberadoAposCiencia = await requisicao('/api/v1/admin/acessos', { headers })
    expect(liberadoAposCiencia.status).toBe(200)
    const contasAdministradas = (await liberadoAposCiencia.json()) as any[]
    expect(contasAdministradas.length).toBeGreaterThan(0)
    for (const contaAdministrada of contasAdministradas) {
      expect(contaAdministrada).not.toHaveProperty('dataOrdenacao')
      expect(contaAdministrada).not.toHaveProperty('regionalId')
      expect(contaAdministrada).not.toHaveProperty('pinHash')
      expect(contaAdministrada).not.toHaveProperty('pinSalt')
      expect(contaAdministrada).not.toHaveProperty('bloqueadoAte')
      expect(contaAdministrada).not.toHaveProperty('tentativasPin')
    }

    const repetida = await requisicao(
      '/api/v1/governanca/responsabilidade-regional/ciencia',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          acessoContaId: 'acesso-pmo',
          versao: RESPONSABILIDADE_PMO_VERSAO,
          ciente: true,
        }),
      }
    )
    expect(repetida.status).toBe(409)
  })

  it('permite ao Master nomear o Administrador Regional e audita a concessão', async () => {
    const bootstrap = await requisicao('/api/v1/bootstrap/master', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bootstrap-Secret': bootstrapSecret,
      },
      body: JSON.stringify({
        codigoCarteirinha: 'CARTEIRA-MASTER',
        confirmacao: 'CRIAR PRIMEIRO MASTER',
      }),
    })
    expect(bootstrap.status).toBe(201)

    const tokenMaster = 'token-master-admin'
    const hashMaster = await hashToken(tokenMaster)
    const agora = new Date().toISOString()
    sqlite
      .prepare(
        `INSERT INTO sessoes
          (id, conta_acesso_id, membro_id, token_hash, expira_em,
           ultimo_acesso_em, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'sessao-master-admin',
        'conta-master',
        'membro-master',
        hashMaster,
        new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        agora,
        agora
      )

    const conceder = await requisicao('/api/v1/admin/acessos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenMaster}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contaAcessoId: 'conta-pmo',
        perfilCodigo: 'ADMINISTRADOR_SISTEMA',
        escopoTipo: 'REGIONAL',
        escopoId: 'regional-1',
      }),
    })

    expect(conceder.status).toBe(201)
    const acesso = (await conceder.json()) as any
    expect(acesso.perfilCodigo).toBe('ADMINISTRADOR_SISTEMA')
    expect(acesso.escopoId).toBe('regional-1')

    const auditoria = sqlite
      .prepare(
        `SELECT acao FROM auditoria_logs
         WHERE recurso_id = ? AND ator_conta_acesso_id = ?`
      )
      .get(acesso.id, 'conta-master') as any
    expect(auditoria.acao).toBe('ACESSO_CONCEDIDO')
  })

  it('limita o Administrador à própria Regional e protege o último Master', async () => {
    sqlite.exec(`
      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('acesso-master', 'conta-master', 'MASTER_SISTEMA', 'GLOBAL', NULL),
        ('acesso-admin', 'conta-pmo', 'ADMINISTRADOR_SISTEMA', 'REGIONAL', 'regional-1');
      INSERT INTO bootstrap_master (id, conta_acesso_id)
      VALUES ('PRIMEIRO_MASTER', 'conta-master');
    `)
    registrarCienciaPmo(sqlite, 'conta-pmo', 'acesso-admin')

    const agora = new Date().toISOString()
    const tokenAdmin = 'token-pmo-admin'
    const tokenMaster = 'token-master-revogacao'
    const hashAdmin = await hashToken(tokenAdmin)
    const hashMaster = await hashToken(tokenMaster)

    const inserirSessao = sqlite.prepare(
      `INSERT INTO sessoes
        (id, conta_acesso_id, membro_id, token_hash, expira_em,
         ultimo_acesso_em, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    inserirSessao.run(
      'sessao-pmo-admin',
      'conta-pmo',
      'membro-pmo',
      hashAdmin,
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      agora,
      agora
    )
    inserirSessao.run(
      'sessao-master-revogacao',
      'conta-master',
      'membro-master',
      hashMaster,
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      agora,
      agora
    )

    const permitido = await requisicao('/api/v1/admin/acessos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdmin}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contaAcessoId: 'conta-pmo',
        perfilCodigo: 'GESTOR_AGENDA',
        escopoTipo: 'REGIONAL',
        escopoId: 'regional-1',
      }),
    })
    expect(permitido.status).toBe(201)

    const elevarMaster = await requisicao('/api/v1/admin/acessos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdmin}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contaAcessoId: 'conta-pmo',
        perfilCodigo: 'MASTER_SISTEMA',
        escopoTipo: 'GLOBAL',
        escopoId: null,
      }),
    })
    expect(elevarMaster.status).toBe(403)

    const revogarUltimoMaster = await requisicao(
      '/api/v1/admin/acessos/acesso-master',
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenMaster}` },
      }
    )
    expect(revogarUltimoMaster.status).toBe(409)
    expect((await revogarUltimoMaster.json()) as any).toMatchObject({
      code: 'ULTIMO_MASTER',
    })
  })

})
