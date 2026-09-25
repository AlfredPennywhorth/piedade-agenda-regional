import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { setupDb } from './setup'
import { registrarCienciaPmo } from './responsabilidade-pmo-test-helper'

describe('Administração de contas — PR-ACC-05', () => {
  let sqlite: Database.Database
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    app = createApp(drizzle(sqlite, { schema }))

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES
        ('regional-1', 'Regional Um'),
        ('regional-2', 'Regional Dois');
      INSERT INTO administracoes (id, regional_id, nome) VALUES
        ('adm-1', 'regional-1', 'Administração Um'),
        ('adm-2', 'regional-2', 'Administração Dois');
      INSERT INTO setores (id, administracao_id, nome) VALUES
        ('setor-1', 'adm-1', 'Setor Um'),
        ('setor-2', 'adm-2', 'Setor Dois');
      INSERT INTO casas (id, setor_id, nome) VALUES
        ('casa-1', 'setor-1', 'Casa Um'),
        ('casa-2', 'setor-2', 'Casa Dois');

      INSERT INTO membros
        (id, nome, celular, data_ordenacao, codigo_carteirinha, casa_id, ativo)
      VALUES
        ('membro-admin', 'Administrador Um', '11900000001', '2000-01-01', 'CART-ADMIN', 'casa-1', 1),
        ('membro-master', 'Master', '11900000002', '2000-01-02', 'CART-MASTER-ACC05', 'casa-1', 1),
        ('membro-comum', 'Usuário Comum', '11900000003', '2000-01-03', 'CART-COMUM', 'casa-1', 1),
        ('membro-sem-conta', 'Pessoa Sem Conta', '11900000004', '2000-01-04', 'CART-SEM-CONTA', 'casa-1', 1),
        ('membro-reset', 'Pessoa Reset', '11900000005', '2000-01-05', 'CART-RESET', 'casa-1', 1),
        ('membro-outra-regional', 'Pessoa Outra Regional', '11900000006', '2000-01-06', 'CART-OUTRA', 'casa-2', 1);

      INSERT INTO contas_acesso
        (id, membro_id, status, pin_hash, pin_salt, ativado_em)
      VALUES
        ('conta-admin', 'membro-admin', 'ATIVA', 'hash-admin', 'salt-admin', CURRENT_TIMESTAMP),
        ('conta-master', 'membro-master', 'ATIVA', 'hash-master', 'salt-master', CURRENT_TIMESTAMP),
        ('conta-comum', 'membro-comum', 'ATIVA', 'hash-comum', 'salt-comum', CURRENT_TIMESTAMP),
        ('conta-reset', 'membro-reset', 'ATIVA', 'hash-antigo', 'salt-antigo', CURRENT_TIMESTAMP),
        ('conta-outra', 'membro-outra-regional', 'ATIVA', 'hash-outra', 'salt-outra', CURRENT_TIMESTAMP);

      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('acesso-admin', 'conta-admin', 'ADMINISTRADOR_SISTEMA', 'REGIONAL', 'regional-1'),
        ('acesso-master', 'conta-master', 'MASTER_SISTEMA', 'GLOBAL', NULL),
        ('acesso-comum', 'conta-comum', 'USUARIO_COMUM', 'CASA', 'casa-1');
    `)
    registrarCienciaPmo(sqlite, 'conta-admin', 'acesso-admin')
  })

  async function requisicao(path: string, init?: RequestInit) {
    return app.request(path, init, {
      APP_ENV: 'test',
      APP_VERSION: 'test',
      PIN_PEPPER: 'pepper-de-teste',
      MASTER_BOOTSTRAP_SECRET: 'segredo-bootstrap-teste-com-32-caracteres',
    } as any)
  }

  async function criarSessao(
    id: string,
    contaId: string,
    membroId: string,
    token: string
  ) {
    const agora = new Date().toISOString()
    sqlite.prepare(
      `INSERT INTO sessoes
        (id, conta_acesso_id, membro_id, token_hash, expira_em, ultimo_acesso_em, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      contaId,
      membroId,
      await hashToken(token),
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      agora,
      agora
    )
  }

  it('exige autenticação para consultar contas', async () => {
    const response = await requisicao('/api/v1/admin/acessos')
    expect(response.status).toBe(401)
  })

  it('nega a administração a usuário comum', async () => {
    const token = 'token-comum-acc05'
    await criarSessao('sessao-comum', 'conta-comum', 'membro-comum', token)

    const response = await requisicao('/api/v1/admin/acessos', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(403)
  })

  it('limita o Administrador aos membros da própria Regional', async () => {
    const token = 'token-admin-lista'
    await criarSessao('sessao-admin-lista', 'conta-admin', 'membro-admin', token)

    const response = await requisicao('/api/v1/admin/acessos', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    const pessoas = (await response.json()) as Array<{
      membroId: string
      regionalId: string
      pinHash?: string
      pinSalt?: string
    }>

    expect(pessoas.length).toBeGreaterThan(0)
    expect(pessoas.every(pessoa => pessoa.regionalId === 'regional-1')).toBe(true)
    expect(pessoas.some(pessoa => pessoa.membroId === 'membro-outra-regional')).toBe(false)
    expect(pessoas.every(pessoa => !('pinHash' in pessoa) && !('pinSalt' in pessoa))).toBe(true)
  })

  it('permite ao Master consultar membros de todas as Regionais', async () => {
    const token = 'token-master-lista'
    await criarSessao('sessao-master-lista', 'conta-master', 'membro-master', token)

    const response = await requisicao('/api/v1/admin/acessos', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    const pessoas = (await response.json()) as Array<{ membroId: string }>
    expect(pessoas.some(pessoa => pessoa.membroId === 'membro-sem-conta')).toBe(true)
    expect(pessoas.some(pessoa => pessoa.membroId === 'membro-outra-regional')).toBe(true)
  })

  it('sinaliza recuperação de PIN pendente na listagem administrativa', async () => {
    const token = 'token-admin-recuperacao'
    await criarSessao('sessao-admin-recuperacao', 'conta-admin', 'membro-admin', token)

    sqlite.prepare(
      `INSERT INTO tentativas_acesso
        (id, conta_acesso_id, membro_id, tipo, sucesso, motivo, created_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`
    ).run(
      'tentativa-recuperacao',
      'conta-reset',
      'membro-reset',
      'RECUPERACAO_PIN_SOLICITADA',
      'Solicitação registrada',
      new Date().toISOString()
    )

    const response = await requisicao('/api/v1/admin/acessos', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    const pessoas = (await response.json()) as Array<{
      membroId: string
      recuperacaoPinPendente?: boolean
      recuperacaoPinSolicitadaEm?: string | null
    }>
    const pessoa = pessoas.find(item => item.membroId === 'membro-reset')
    expect(pessoa?.recuperacaoPinPendente).toBe(true)
    expect(pessoa?.recuperacaoPinSolicitadaEm).toBeTruthy()
  })

  it('gera ativação individual, armazena somente o hash e registra auditoria', async () => {
    const tokenAdmin = 'token-admin-ativacao'
    await criarSessao('sessao-admin-ativacao', 'conta-admin', 'membro-admin', tokenAdmin)

    const response = await requisicao(
      '/api/v1/admin/acessos/membros/membro-sem-conta/link-ativacao',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenAdmin}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      }
    )

    expect(response.status).toBe(201)
    const body = (await response.json()) as { token: string; expiraEm: string }
    expect(body.token).toBeTruthy()
    expect(new Date(body.expiraEm).getTime()).toBeGreaterThan(Date.now())

    const conta = sqlite.prepare(
      'SELECT id, status, pin_hash, pin_salt FROM contas_acesso WHERE membro_id = ?'
    ).get('membro-sem-conta') as any
    expect(conta.status).toBe('PENDENTE_ATIVACAO')
    expect(conta.pin_hash).toBeNull()
    expect(conta.pin_salt).toBeNull()

    const acessoPadrao = sqlite.prepare(
      `SELECT perfil_codigo, escopo_tipo, escopo_id, ativo
       FROM acessos_conta
       WHERE conta_acesso_id = ? AND perfil_codigo = 'USUARIO_COMUM'`
    ).get(conta.id) as any
    expect(acessoPadrao).toMatchObject({
      perfil_codigo: 'USUARIO_COMUM',
      escopo_tipo: 'CASA',
      escopo_id: 'casa-1',
      ativo: 1,
    })

    const link = sqlite.prepare(
      'SELECT token_hash, utilizado_em, revogado_em FROM links_ativacao WHERE conta_acesso_id = ?'
    ).get(conta.id) as any
    expect(link.token_hash).toBe(await hashToken(body.token))
    expect(link.token_hash).not.toBe(body.token)
    expect(link.utilizado_em).toBeNull()
    expect(link.revogado_em).toBeNull()

    const auditoria = sqlite.prepare(
      `SELECT acao, ator_conta_acesso_id, escopo_id
       FROM auditoria_logs WHERE recurso_id = ?`
    ).get(conta.id) as any
    expect(auditoria).toMatchObject({
      acao: 'LINK_ATIVACAO_GERADO',
      ator_conta_acesso_id: 'conta-admin',
      escopo_id: 'regional-1',
    })
  })

  it('redefine PIN, revoga sessões e links anteriores e registra auditoria', async () => {
    const tokenAdmin = 'token-admin-reset'
    const tokenAnterior = 'token-sessao-anterior'
    await criarSessao('sessao-admin-reset', 'conta-admin', 'membro-admin', tokenAdmin)
    await criarSessao('sessao-anterior', 'conta-reset', 'membro-reset', tokenAnterior)

    sqlite.prepare(
      `INSERT INTO links_ativacao
        (id, conta_acesso_id, membro_id, token_hash, expira_em)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      'link-anterior',
      'conta-reset',
      'membro-reset',
      await hashToken('link-anterior-bruto'),
      new Date(Date.now() + 60 * 60 * 1000).toISOString()
    )

    const response = await requisicao(
      '/api/v1/admin/acessos/membros/membro-reset/reset-pin',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenAdmin}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      }
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { token: string }

    const conta = sqlite.prepare(
      `SELECT status, pin_hash, pin_salt, tentativas_pin, bloqueado_ate
       FROM contas_acesso WHERE id = 'conta-reset'`
    ).get() as any
    expect(conta).toMatchObject({
      status: 'PENDENTE_ATIVACAO',
      pin_hash: null,
      pin_salt: null,
      tentativas_pin: 0,
      bloqueado_ate: null,
    })

    const sessao = sqlite.prepare(
      `SELECT revogado_em FROM sessoes WHERE id = 'sessao-anterior'`
    ).get() as any
    expect(sessao.revogado_em).toBeTruthy()

    const linkAnterior = sqlite.prepare(
      `SELECT revogado_em FROM links_ativacao WHERE id = 'link-anterior'`
    ).get() as any
    expect(linkAnterior.revogado_em).toBeTruthy()

    const novoLink = sqlite.prepare(
      `SELECT token_hash FROM links_ativacao
       WHERE conta_acesso_id = 'conta-reset' AND revogado_em IS NULL`
    ).get() as any
    expect(novoLink.token_hash).toBe(await hashToken(body.token))
    expect(novoLink.token_hash).not.toBe(body.token)

    const auditoria = sqlite.prepare(
      `SELECT acao, ator_conta_acesso_id
       FROM auditoria_logs
       WHERE recurso_id = 'conta-reset' AND acao = 'PIN_REDEFINICAO_SOLICITADA'`
    ).get() as any
    expect(auditoria).toMatchObject({
      acao: 'PIN_REDEFINICAO_SOLICITADA',
      ator_conta_acesso_id: 'conta-admin',
    })
  })

  it('impede Administrador de operar conta de outra Regional', async () => {
    const token = 'token-admin-fora-escopo'
    await criarSessao('sessao-admin-fora', 'conta-admin', 'membro-admin', token)

    const response = await requisicao(
      '/api/v1/admin/acessos/membros/membro-outra-regional/reset-pin',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      }
    )

    expect(response.status).toBe(403)
  })

  it('bloqueia conta, revoga sessões e registra auditoria', async () => {
    const tokenAdmin = 'token-admin-bloqueio'
    await criarSessao('sessao-admin-bloqueio', 'conta-admin', 'membro-admin', tokenAdmin)
    await criarSessao('sessao-alvo-bloqueio', 'conta-reset', 'membro-reset', 'token-alvo')

    const response = await requisicao(
      '/api/v1/admin/acessos/membros/membro-reset/status',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tokenAdmin}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'BLOQUEADA' }),
      }
    )

    expect(response.status).toBe(200)
    const conta = sqlite.prepare(
      `SELECT status FROM contas_acesso WHERE id = 'conta-reset'`
    ).get() as any
    expect(conta.status).toBe('BLOQUEADA')

    const sessao = sqlite.prepare(
      `SELECT revogado_em FROM sessoes WHERE id = 'sessao-alvo-bloqueio'`
    ).get() as any
    expect(sessao.revogado_em).toBeTruthy()

    const auditoria = sqlite.prepare(
      `SELECT acao, ator_conta_acesso_id FROM auditoria_logs
       WHERE recurso_id = 'conta-reset' AND acao = 'CONTA_BLOQUEADA'`
    ).get() as any
    expect(auditoria).toMatchObject({
      acao: 'CONTA_BLOQUEADA',
      ator_conta_acesso_id: 'conta-admin',
    })
  })

  it('desbloqueia conta já ativada e limpa controles de bloqueio', async () => {
    sqlite.prepare(
      `UPDATE contas_acesso
       SET status = 'BLOQUEADA', tentativas_pin = 5, bloqueado_ate = ?
       WHERE id = 'conta-reset'`
    ).run(new Date(Date.now() + 60 * 60 * 1000).toISOString())

    const tokenAdmin = 'token-admin-desbloqueio'
    await criarSessao('sessao-admin-desbloqueio', 'conta-admin', 'membro-admin', tokenAdmin)

    const response = await requisicao(
      '/api/v1/admin/acessos/membros/membro-reset/status',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tokenAdmin}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'ATIVA' }),
      }
    )

    expect(response.status).toBe(200)
    const conta = sqlite.prepare(
      `SELECT status, tentativas_pin, bloqueado_ate
       FROM contas_acesso WHERE id = 'conta-reset'`
    ).get() as any
    expect(conta).toMatchObject({
      status: 'ATIVA',
      tentativas_pin: 0,
      bloqueado_ate: null,
    })

    const auditoria = sqlite.prepare(
      `SELECT acao FROM auditoria_logs
       WHERE recurso_id = 'conta-reset' AND acao = 'CONTA_DESBLOQUEADA'`
    ).get() as any
    expect(auditoria.acao).toBe('CONTA_DESBLOQUEADA')
  })

  it('impede que o administrador bloqueie a própria conta', async () => {
    const tokenAdmin = 'token-admin-auto-bloqueio'
    await criarSessao('sessao-admin-auto-bloqueio', 'conta-admin', 'membro-admin', tokenAdmin)

    const response = await requisicao(
      '/api/v1/admin/acessos/membros/membro-admin/status',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tokenAdmin}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'BLOQUEADA' }),
      }
    )

    expect(response.status).toBe(409)
    expect((await response.json()) as any).toMatchObject({ code: 'AUTO_BLOQUEIO' })
  })

  it('revoga sessões manualmente sem alterar o estado da conta', async () => {
    const tokenAdmin = 'token-admin-revogacao'
    await criarSessao('sessao-admin-revogacao', 'conta-admin', 'membro-admin', tokenAdmin)
    await criarSessao('sessao-alvo-revogacao', 'conta-reset', 'membro-reset', 'token-alvo-revogacao')

    const response = await requisicao(
      '/api/v1/admin/acessos/membros/membro-reset/revogar-sessoes',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenAdmin}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      }
    )

    expect(response.status).toBe(200)
    const conta = sqlite.prepare(
      `SELECT status FROM contas_acesso WHERE id = 'conta-reset'`
    ).get() as any
    expect(conta.status).toBe('ATIVA')

    const sessao = sqlite.prepare(
      `SELECT revogado_em FROM sessoes WHERE id = 'sessao-alvo-revogacao'`
    ).get() as any
    expect(sessao.revogado_em).toBeTruthy()

    const auditoria = sqlite.prepare(
      `SELECT acao, ator_conta_acesso_id FROM auditoria_logs
       WHERE recurso_id = 'conta-reset' AND acao = 'SESSOES_REVOGADAS'`
    ).get() as any
    expect(auditoria).toMatchObject({
      acao: 'SESSOES_REVOGADAS',
      ator_conta_acesso_id: 'conta-admin',
    })
  })


  it('impede concessão de perfil a uma conta pertencente a outra Regional', async () => {
    const tokenAdmin = 'token-admin-concessao-fora'
    await criarSessao('sessao-admin-concessao-fora', 'conta-admin', 'membro-admin', tokenAdmin)

    const response = await requisicao('/api/v1/admin/acessos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdmin}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contaAcessoId: 'conta-outra',
        perfilCodigo: 'GESTOR_AGENDA',
        escopoTipo: 'REGIONAL',
        escopoId: 'regional-1',
      }),
    })

    expect(response.status).toBe(403)
    const acesso = sqlite.prepare(
      `SELECT id FROM acessos_conta
       WHERE conta_acesso_id = 'conta-outra' AND perfil_codigo = 'GESTOR_AGENDA'`
    ).get()
    expect(acesso).toBeUndefined()
  })

  it('impede Administrador regional de gerar link de ativação para conta Master', async () => {
    const tokenAdmin = 'token-admin-link-master'
    await criarSessao('sessao-admin-link-master', 'conta-admin', 'membro-admin', tokenAdmin)

    const response = await requisicao(
      '/api/v1/admin/acessos/membros/membro-master/link-ativacao',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenAdmin}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      }
    )

    expect(response.status).toBe(403)
    expect((await response.json()) as any).toMatchObject({ code: 'FORBIDDEN' })

    const links = sqlite.prepare(
      `SELECT COUNT(*) AS total FROM links_ativacao WHERE conta_acesso_id = 'conta-master'`
    ).get() as { total: number }
    expect(links.total).toBe(0)
  })

  it('impede Administrador regional de bloquear qualquer conta Master', async () => {
    const tokenAdmin = 'token-admin-protege-master'
    await criarSessao('sessao-admin-protege-master', 'conta-admin', 'membro-admin', tokenAdmin)

    const response = await requisicao(
      '/api/v1/admin/acessos/membros/membro-master/status',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tokenAdmin}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'BLOQUEADA' }),
      }
    )

    expect(response.status).toBe(403)
    expect((await response.json()) as any).toMatchObject({ code: 'FORBIDDEN' })
    const conta = sqlite.prepare(
      `SELECT status FROM contas_acesso WHERE id = 'conta-master'`
    ).get() as any
    expect(conta.status).toBe('ATIVA')
  })

  it('impede Administrador regional de redefinir PIN de qualquer conta Master', async () => {
    const tokenAdmin = 'token-admin-reset-master'
    await criarSessao('sessao-admin-reset-master', 'conta-admin', 'membro-admin', tokenAdmin)

    const response = await requisicao(
      '/api/v1/admin/acessos/membros/membro-master/reset-pin',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenAdmin}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      }
    )

    expect(response.status).toBe(403)
    expect((await response.json()) as any).toMatchObject({ code: 'FORBIDDEN' })
    const conta = sqlite.prepare(
      `SELECT status, pin_hash FROM contas_acesso WHERE id = 'conta-master'`
    ).get() as any
    expect(conta).toMatchObject({ status: 'ATIVA', pin_hash: 'hash-master' })
  })


  it('protege o acesso padrão de Usuário Comum contra revogação', async () => {
    const tokenMaster = 'token-master-protege-comum'
    await criarSessao('sessao-master-protege-comum', 'conta-master', 'membro-master', tokenMaster)

    const response = await requisicao('/api/v1/admin/acessos/acesso-comum', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenMaster}` },
    })

    expect(response.status).toBe(409)
    expect((await response.json()) as any).toMatchObject({ code: 'ACESSO_PADRAO' })

    const acesso = sqlite.prepare(
      `SELECT ativo FROM acessos_conta WHERE id = 'acesso-comum'`
    ).get() as { ativo: number }
    expect(acesso.ativo).toBe(1)
  })


  it('rejeita concessão manual de Usuário Comum fora do fluxo automático', async () => {
    const tokenMaster = 'token-master-comum-manual'
    await criarSessao('sessao-master-comum-manual', 'conta-master', 'membro-master', tokenMaster)

    const response = await requisicao('/api/v1/admin/acessos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenMaster}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contaAcessoId: 'conta-reset',
        perfilCodigo: 'USUARIO_COMUM',
        escopoTipo: 'REGIONAL',
        escopoId: 'regional-1',
      }),
    })

    expect(response.status).toBe(409)
    expect((await response.json()) as any).toMatchObject({
      code: 'ACESSO_PADRAO_AUTOMATICO',
    })
  })

})
