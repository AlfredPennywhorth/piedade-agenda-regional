import { describe, it, expect, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { setupDb } from './setup'

describe('Autenticação e Sessões S03', () => {
  let sqlite: any
  let db: ReturnType<typeof drizzle>
  let app: any

  const req = async (path: string, options?: RequestInit) => {
    const request = new Request(`http://localhost${path}`, options)
    return app.request(request)
  }

  const regionalId = 'reg-1'
  const admId = 'adm-1'
  const setorId = 'set-1'
  const casaId = 'casa-1'
  const membroId = 'mem-1'
  const membroInativoId = 'mem-inativo'
  const membroAtivoNormalizadoId = 'mem-ativo-norm'
  let tokenAtivacaoPuro = ''
  let sessionTokenPuro = ''

  beforeAll(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema })
    app = createApp(db, { enableAdminRoutes: true })
    setupDb(sqlite)

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES ('${regionalId}', 'Reg 1');
      INSERT INTO administracoes (id, regional_id, nome) VALUES ('${admId}', '${regionalId}', 'Adm 1');
      INSERT INTO setores (id, administracao_id, nome) VALUES ('${setorId}', '${admId}', 'Set 1');
      INSERT INTO casas (id, setor_id, nome) VALUES ('${casaId}', '${setorId}', 'Casa 1');
      
      INSERT INTO membros (id, nome, celular, data_nascimento, casa_id, ativo)
      VALUES ('${membroId}', 'João Silva', '11999999999', '1990-01-01', '${casaId}', 1);

      INSERT INTO membros (id, nome, celular, data_nascimento, casa_id, ativo)
      VALUES ('${membroInativoId}', 'Maria Silva', '11988888888', '1990-01-01', '${casaId}', 0);
      
      INSERT INTO membros (id, nome, celular, data_nascimento, casa_id, ativo)
      VALUES ('${membroAtivoNormalizadoId}', 'Pedro Normalizado', '11977777777', '1990-01-01', '${casaId}', 1);
      
      INSERT INTO funcoes (id, nome) VALUES ('func-1', 'Função 1');
      INSERT INTO vinculos_funcionais (id, membro_id, funcao_id, regional_id, ativo) VALUES ('vinc-1', '${membroId}', 'func-1', '${regionalId}', 1);
    `)
  })

  it('0. Banco de dados inicializado possui coluna ultimo_acesso_em e não possui updated_at na tabela sessoes', () => {
    const tableInfo = sqlite.prepare("PRAGMA table_info('sessoes')").all() as any[]
    const hasUpdatedAt = tableInfo.some(col => col.name === 'updated_at')
    const hasUltimoAcessoEm = tableInfo.some(col => col.name === 'ultimo_acesso_em')
    expect(hasUpdatedAt).toBe(false)
    expect(hasUltimoAcessoEm).toBe(true)
  })

  // 1-5: Geração de Link (Admin)
  it('1. Admin pode gerar link de ativação para membro válido', async () => {
    const res = await req(`/api/v1/admin/membros/${membroId}/link-ativacao`, { method: 'POST' })
    const json = (await res.json()) as any
    expect(res.status).toBe(201)
    expect(json.token).toBeDefined()
    tokenAtivacaoPuro = json.token
  })

  it('2. Link gerado possui formato correto na resposta', async () => {
    expect(tokenAtivacaoPuro.length).toBeGreaterThan(10)
  })

  it('3. Link gerado é salvo no banco com token_hash (nunca token puro)', async () => {
    const link = sqlite
      .prepare('SELECT * FROM links_ativacao WHERE membro_id = ?')
      .get(membroId) as any
    expect(link.token_hash).toBeDefined()
    expect(link.token_hash).not.toBe(tokenAtivacaoPuro)
  })

  it('4. Admin não pode gerar link para membro inativo', async () => {
    const res = await req(`/api/v1/admin/membros/${membroInativoId}/link-ativacao`, {
      method: 'POST',
    })
    expect(res.status).toBe(404)
  })

  it('5. Admin não pode gerar link para membro inexistente', async () => {
    const res = await req(`/api/v1/admin/membros/inexistente/link-ativacao`, { method: 'POST' })
    expect(res.status).toBe(404)
  })

  // 6-19: Validações de Ativação (Falhas)
  it('6. Ativação falha se token não for enviado', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        celular: '11999999999',
        dataNascimento: '1990-01-01',
        pin: '123456',
        confirmacaoPin: '123456',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('7. Ativação falha se token for inválido (tamanho)', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: '',
        celular: '11999999999',
        dataNascimento: '1990-01-01',
        pin: '123456',
        confirmacaoPin: '123456',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('8. Ativação falha se token não existir no banco', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'inexistente12345678',
        celular: '11999999999',
        dataNascimento: '1990-01-01',
        pin: '123456',
        confirmacaoPin: '123456',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('9. Ativação falha se celular não for enviado', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenAtivacaoPuro,
        dataNascimento: '1990-01-01',
        pin: '123456',
        confirmacaoPin: '123456',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('10. Ativação falha se celular não bater com o cadastro', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenAtivacaoPuro,
        celular: '11000000000',
        dataNascimento: '1990-01-01',
        pin: '123456',
        confirmacaoPin: '123456',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('11. Contrato de ativação não coleta data de nascimento', async () => {
    const { ativacaoSchema } = await import('@piedade/shared')
    const parsed = ativacaoSchema.safeParse({
      token: tokenAtivacaoPuro,
      celular: '11999999999',
      pin: '123456',
      confirmacaoPin: '123456',
    })
    expect(parsed.success).toBe(true)
  })

  it('12. Data de nascimento enviada por cliente antigo é descartada', async () => {
    const { ativacaoSchema } = await import('@piedade/shared')
    const parsed = ativacaoSchema.parse({
      token: tokenAtivacaoPuro,
      celular: '11999999999',
      dataNascimento: '2000-01-01',
      pin: '123456',
      confirmacaoPin: '123456',
    })
    expect('dataNascimento' in parsed).toBe(false)
  })

  it('13. Ativação falha se PIN não for enviado', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenAtivacaoPuro,
        celular: '11999999999',
        dataNascimento: '1990-01-01',
        confirmacaoPin: '123456',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('14. Ativação falha se PIN tiver menos de 6 dígitos', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenAtivacaoPuro,
        celular: '11999999999',
        dataNascimento: '1990-01-01',
        pin: '12345',
        confirmacaoPin: '12345',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('15. Ativação falha se confirmacaoPin não for enviado', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenAtivacaoPuro,
        celular: '11999999999',
        dataNascimento: '1990-01-01',
        pin: '123456',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('16. Ativação falha se confirmacaoPin for diferente do PIN', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenAtivacaoPuro,
        celular: '11999999999',
        dataNascimento: '1990-01-01',
        pin: '123456',
        confirmacaoPin: '654321',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('17. Ativação falha se membro associado ao token foi inativado', async () => {
    sqlite.exec(`UPDATE membros SET ativo = 0 WHERE id = '${membroId}'`)
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenAtivacaoPuro,
        celular: '11999999999',
        dataNascimento: '1990-01-01',
        pin: '123456',
        confirmacaoPin: '123456',
      }),
    })
    expect(res.status).toBe(400)
    sqlite.exec(`UPDATE membros SET ativo = 1 WHERE id = '${membroId}'`)
  })

  it('18. Ativação falha se token já expirou', async () => {
    sqlite.exec(
      `UPDATE links_ativacao SET expira_em = '2000-01-01T00:00:00Z' WHERE membro_id = '${membroId}'`
    )
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenAtivacaoPuro,
        celular: '11999999999',
        dataNascimento: '1990-01-01',
        pin: '123456',
        confirmacaoPin: '123456',
      }),
    })
    expect(res.status).toBe(400)
    sqlite.exec(
      `UPDATE links_ativacao SET expira_em = '2099-01-01T00:00:00Z' WHERE membro_id = '${membroId}'`
    )
  })

  it('19. Ativação falha se token já foi revogado', async () => {
    sqlite.exec(
      `UPDATE links_ativacao SET revogado_em = CURRENT_TIMESTAMP WHERE membro_id = '${membroId}'`
    )
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenAtivacaoPuro,
        celular: '11999999999',
        dataNascimento: '1990-01-01',
        pin: '123456',
        confirmacaoPin: '123456',
      }),
    })
    expect(res.status).toBe(400)
    sqlite.exec(`UPDATE links_ativacao SET revogado_em = NULL WHERE membro_id = '${membroId}'`)
  })

  // 20-27: Sucesso na Ativação e Verificações no Banco
  it('20. Ativação com dados corretos retorna 200 e gera token de sessão', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenAtivacaoPuro,
        celular: '11999999999',
        dataNascimento: '1990-01-01',
        pin: '123456',
        confirmacaoPin: '123456',
      }),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    expect(json.sessionToken).toBeDefined()
    sessionTokenPuro = json.sessionToken
  })

  it('21. Ativação bem-sucedida gera pin_hash e pin_salt para a conta', async () => {
    const membro = sqlite
      .prepare('SELECT pin_hash, pin_salt FROM contas_acesso WHERE membro_id = ?')
      .get(membroId) as any
    expect(membro.pin_hash).not.toBeNull()
    expect(membro.pin_salt).not.toBeNull()
  })

  it('22. Ativação bem-sucedida marca a conta como ATIVA', async () => {
    const membro = sqlite
      .prepare('SELECT status FROM contas_acesso WHERE membro_id = ?')
      .get(membroId) as any
    expect(membro.status).toBe('ATIVA')
  })

  it('23. Ativação bem-sucedida zera as tentativas_pin', async () => {
    const membro = sqlite
      .prepare('SELECT tentativas_pin FROM contas_acesso WHERE membro_id = ?')
      .get(membroId) as any
    expect(membro.tentativas_pin).toBe(0)
  })

  it('24. Ativação bem-sucedida remove bloqueado_ate se existisse', async () => {
    const membro = sqlite
      .prepare('SELECT bloqueado_ate FROM contas_acesso WHERE membro_id = ?')
      .get(membroId) as any
    expect(membro.bloqueado_ate).toBeNull()
  })

  it('25. Ativação bem-sucedida preenche ativado_em', async () => {
    const membro = sqlite
      .prepare('SELECT ativado_em FROM contas_acesso WHERE membro_id = ?')
      .get(membroId) as any
    expect(membro.ativado_em).not.toBeNull()
  })

  it('26. Ativação bem-sucedida salva sessão válida (hash) no banco', async () => {
    const sessao = sqlite.prepare('SELECT * FROM sessoes WHERE membro_id = ?').get(membroId) as any
    expect(sessao).toBeDefined()
    expect(sessao.token_hash).not.toBe(sessionTokenPuro)
  })

  it('27. Ativação falha se tentar usar o mesmo token novamente', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenAtivacaoPuro,
        celular: '11999999999',
        dataNascimento: '1990-01-01',
        pin: '123456',
        confirmacaoPin: '123456',
      }),
    })
    expect(res.status).toBe(400)
  })

  // 28-38: Login
  it('28. Login falha se identificador (celular) não for enviado', async () => {
    const res = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '123456' }),
    })
    expect(res.status).toBe(400)
  })

  it('29. Login falha se PIN não for enviado', async () => {
    const res = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '11999999999' }),
    })
    expect(res.status).toBe(400)
  })

  it('30. Login falha genérica se celular não existir', async () => {
    const res = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '11000000000', pin: '123456' }),
    })
    expect(res.status).toBe(401)
  })

  it('31. Login falha genérica se membro for inativo', async () => {
    sqlite.exec(`UPDATE membros SET ativo = 0 WHERE id = '${membroId}'`)
    const res = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '11999999999', pin: '123456' }),
    })
    expect(res.status).toBe(401)
    sqlite.exec(`UPDATE membros SET ativo = 1 WHERE id = '${membroId}'`)
  })

  it('32. Login falha genérica se membro não tiver autenticação ativa', async () => {
    sqlite.exec(`UPDATE contas_acesso SET status = 'PENDENTE_ATIVACAO' WHERE membro_id = '${membroId}'`)
    const res = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '11999999999', pin: '123456' }),
    })
    expect(res.status).toBe(401)
    sqlite.exec(`UPDATE contas_acesso SET status = 'ATIVA' WHERE membro_id = '${membroId}'`)
  })

  it('33. Login falha com PIN incorreto', async () => {
    sqlite.exec('DELETE FROM rate_limits_autenticacao')
    const res = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '11999999999', pin: '654321' }),
    })
    expect(res.status).toBe(401)
  })

  it('34. Login com PIN incorreto incrementa tentativas_pin no banco', async () => {
    const membro = sqlite
      .prepare('SELECT tentativas_pin FROM contas_acesso WHERE membro_id = ?')
      .get(membroId) as any
    expect(membro.tentativas_pin).toBe(1)
  })

  it('35. Login com 5 falhas consecutivas bloqueia a conta', async () => {
    for (let i = 0; i < 4; i++) {
      await req('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: '11999999999', pin: '000000' }),
      })
    }
    const membro = sqlite
      .prepare('SELECT tentativas_pin, bloqueado_ate FROM contas_acesso WHERE membro_id = ?')
      .get(membroId) as any
    expect(membro.tentativas_pin).toBe(5)
    expect(membro.bloqueado_ate).not.toBeNull()
  })

  it('36. Login bloqueado retorna erro 429 mesmo se informar PIN correto', async () => {
    const res = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '11999999999', pin: '123456' }),
    })
    expect(res.status).toBe(429)
  })

  it('37. Login bem-sucedido (após bloqueio expirado) zera contadores e gera token de sessão', async () => {
    sqlite.exec(
      `UPDATE contas_acesso SET bloqueado_ate = '2000-01-01T00:00:00Z' WHERE membro_id = '${membroId}'`
    )
    sqlite.exec(`UPDATE rate_limits_autenticacao SET bloqueado_ate = '2000-01-01T00:00:00Z'`)

    const res = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '11999999999', pin: '123456' }),
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    sessionTokenPuro = json.sessionToken

    const membro = sqlite
      .prepare('SELECT tentativas_pin, bloqueado_ate FROM contas_acesso WHERE membro_id = ?')
      .get(membroId) as any
    expect(membro.tentativas_pin).toBe(0)
    expect(membro.bloqueado_ate).toBeNull()
  })

  // 38-40: Sessão, Logout e Recuperação
  it('38. Endpoint protegido /auth/me/vinculos retorna 200 com os dados corretos', async () => {
    const res = await req('/api/v1/auth/me/vinculos', {
      headers: { Authorization: `Bearer ${sessionTokenPuro}` },
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    expect(json.vinculosAtivos).toHaveLength(1)
  })

  it('38.1 Sessão expira por inatividade após 12 horas', async () => {
    sqlite.exec(
      `UPDATE sessoes SET ultimo_acesso_em = '2000-01-01T00:00:00.000Z' WHERE token_hash = (SELECT token_hash FROM sessoes WHERE membro_id = '${membroId}' AND revogado_em IS NULL ORDER BY created_at DESC LIMIT 1)`
    )

    const res = await req('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${sessionTokenPuro}` },
    })

    expect(res.status).toBe(401)
    sqlite.exec(
      `UPDATE sessoes SET ultimo_acesso_em = CURRENT_TIMESTAMP WHERE membro_id = '${membroId}' AND revogado_em IS NULL`
    )
  })

  it('38.2 Sessão expira após 30 dias mesmo com atividade recente', async () => {
    sqlite.exec(
      `UPDATE sessoes SET created_at = '2000-01-01T00:00:00.000Z', ultimo_acesso_em = CURRENT_TIMESTAMP, expira_em = '2099-01-01T00:00:00.000Z' WHERE membro_id = '${membroId}' AND revogado_em IS NULL`
    )

    const res = await req('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${sessionTokenPuro}` },
    })

    expect(res.status).toBe(401)
    sqlite.exec(
      `UPDATE sessoes SET created_at = CURRENT_TIMESTAMP, ultimo_acesso_em = CURRENT_TIMESTAMP WHERE membro_id = '${membroId}' AND revogado_em IS NULL`
    )
  })

  it('39. Logout revoga a sessão e bloqueia acessos subsequentes', async () => {
    const resLogout = await req('/api/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionTokenPuro}` },
    })
    expect(resLogout.status).toBe(200)

    const resMe = await req('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${sessionTokenPuro}` },
    })
    expect(resMe.status).toBe(401)
  })

  it('39.1 Logout revoga somente a sessão atual', async () => {
    const primeiroLogin = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '11999999999', pin: '123456' }),
    })
    const primeiroToken = ((await primeiroLogin.json()) as any).sessionToken
    const segundoLogin = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '11999999999', pin: '123456' }),
    })
    const segundoToken = ((await segundoLogin.json()) as any).sessionToken

    await req('/api/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${primeiroToken}` },
    })
    const outraSessao = await req('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${segundoToken}` },
    })
    expect(outraSessao.status).toBe(200)
  })

  it('39.2 Rate limit protege identificador inexistente sem persistir seu valor', async () => {
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      await req('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: '11966666666', pin: '123456' }),
      })
    }

    const limite = sqlite
      .prepare('SELECT * FROM rate_limits_autenticacao WHERE falhas_consecutivas = 5')
      .get() as any
    expect(limite).toBeDefined()
    expect(limite.chave_hash).not.toContain('11966666666')

    const bloqueada = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '11966666666', pin: '123456' }),
    })
    expect(bloqueada.status).toBe(429)
    expect(Number(bloqueada.headers.get('Retry-After'))).toBeGreaterThan(0)
    const aposBloqueio = sqlite
      .prepare('SELECT falhas_consecutivas FROM rate_limits_autenticacao WHERE chave_hash = ?')
      .get(limite.chave_hash) as any
    expect(aposBloqueio.falhas_consecutivas).toBe(5)
  })

  it('39.3 Rate limit aplica todas as faixas progressivas e conserva 15 minutos após a décima falha', async () => {
    sqlite.exec('DELETE FROM rate_limits_autenticacao')
    const identificador = '11955555555'
    const bloqueiosEsperados = [30, 60, 120, 300, 600, 900, 900]

    for (let falha = 1; falha <= 11; falha++) {
      const resposta = await req('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador, pin: '123456' }),
      })

      if (falha < 5) {
        expect(resposta.status).toBe(401)
        continue
      }

      expect(resposta.status).toBe(429)
      const bloqueioEsperado = bloqueiosEsperados[falha - 5]
      expect(Number(resposta.headers.get('Retry-After'))).toBeGreaterThanOrEqual(
        bloqueioEsperado - 1
      )

      const limite = sqlite
        .prepare('SELECT chave_hash, falhas_consecutivas FROM rate_limits_autenticacao')
        .get() as any
      expect(limite.falhas_consecutivas).toBe(falha)
      sqlite
        .prepare('UPDATE rate_limits_autenticacao SET bloqueado_ate = ? WHERE chave_hash = ?')
        .run('2000-01-01T00:00:00.000Z', limite.chave_hash)
    }
  })

  it('40. Reset administrativo limpa PIN e revoga todas as sessões e links', async () => {
    const resReset = await req(`/api/v1/admin/membros/${membroId}/reset-autenticacao`, {
      method: 'POST',
    })
    expect(resReset.status).toBe(200)

    const membro = sqlite
      .prepare('SELECT pin_hash, status FROM contas_acesso WHERE membro_id = ?')
      .get(membroId) as any
    expect(membro.pin_hash).toBeNull()
    expect(membro.status).toBe('PENDENTE_ATIVACAO')

    const sessoesCount = sqlite
      .prepare('SELECT COUNT(*) as count FROM sessoes WHERE membro_id = ? AND revogado_em IS NULL')
      .get(membroId) as any
    expect(sessoesCount.count).toBe(0)
  })

  it('41. Atomicidade: falha no meio da transação reverte alterações anteriores (rollback)', async () => {
    // Membro 1 acabou de ser resetado no teste 40.
    // Vamos gerar um novo link de ativação
    const resLink = await req(`/api/v1/admin/membros/${membroId}/link-ativacao`, { method: 'POST' })
    const { token } = (await resLink.json()) as any

    // Criamos um gatilho temporário no SQLite para forçar um erro na tabela sessoes
    // Como a sessão é inserida no final do executeAtomic de ativação, as tabelas links_ativacao e membros
    // já teriam sido alteradas se fosse execução sequencial. Com transação (atomicidade), elas devem sofrer rollback.
    sqlite.exec(`
      CREATE TRIGGER force_error_on_session BEFORE INSERT ON sessoes
      BEGIN
        SELECT RAISE(ABORT, 'Simulated failure');
      END;
    `)

    // Tenta ativar (os dados básicos estão corretos)
    const resAtivar = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        celular: '11999999999',
        dataNascimento: '1990-01-01',
        pin: '654321',
        confirmacaoPin: '654321',
      }),
    })

    // Deve falhar pois o banco rejeitou o insert
    expect(resAtivar.status).toBe(500)

    // Removemos o trigger
    sqlite.exec('DROP TRIGGER force_error_on_session')

    // VERIFICAÇÃO DO ROLLBACK
    // 1. O link gerado NÃO deve ter sido marcado como utilizado
    const linkBanco = sqlite
      .prepare(
        'SELECT utilizado_em FROM links_ativacao WHERE membro_id = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(membroId) as any
    expect(linkBanco.utilizado_em).toBeNull()

    // 2. A conta deve permanecer pendente e sem PIN após o rollback
    const membro = sqlite
      .prepare('SELECT status, pin_hash FROM contas_acesso WHERE membro_id = ?')
      .get(membroId) as any
    expect(membro.status).toBe('PENDENTE_ATIVACAO')
    expect(membro.pin_hash).toBeNull()
  })

  it('42. Hash versionado (PHC): hash gerado contém versão, algoritmo, salt e iterações', async () => {
    const { hashPin, gerarSalt } = await import('../security/pin')
    const salt = gerarSalt()
    const pepper = 'meu-pepper'
    const phc = await hashPin('123456', salt, pepper)

    // $v1$pbkdf2-sha256$i=100000$salt$hash
    const parts = phc.split('$')
    expect(parts.length).toBe(6)
    expect(parts[1]).toBe('v1')
    expect(parts[2]).toBe('pbkdf2-sha256')
    expect(parts[3]).toBe('i=100000')
    expect(parts[4]).toBe(salt)
  })

  it('43. Pepper correto e incorreto funcionam conforme esperado', async () => {
    const { hashPin, verifyPin, gerarSalt } = await import('../security/pin')
    const salt = gerarSalt()

    const pin = '123456'
    const pepperCerto = 'chave-secreta'
    const pepperErrado = 'outra-chave'

    const phc = await hashPin(pin, salt, pepperCerto)

    // Testa pepper correto
    const valido = await verifyPin(pin, pepperCerto, phc)
    expect(valido).toBe(true)

    // Testa pepper incorreto
    const invalido = await verifyPin(pin, pepperErrado, phc)
    expect(invalido).toBe(false)
  })

  it('44. Versão desconhecida de Hash deve ser rejeitada', async () => {
    const { verifyPin } = await import('../security/pin')

    // $v2 não é suportado, deve retornar falso e não quebrar a aplicação
    const pin = '123456'
    const fakePhc = '$v2$pbkdf2-sha256$i=100000$salt$hash'

    const valido = await verifyPin(pin, 'pepper', fakePhc)
    expect(valido).toBe(false)
  })

  it('45. Login com celular normalizado', async () => {
    // a) gerar link para esse membro ativo
    const resLink = await req(`/api/v1/admin/membros/${membroAtivoNormalizadoId}/link-ativacao`, {
      method: 'POST',
    })
    const { token } = (await resLink.json()) as any

    // b) ativar usando celular nacional normalizado (o backend espera string numérica ou transformará no schema)
    const resAtivar = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        celular: '11977777777',
        dataNascimento: '1990-01-01',
        pin: '654321',
        confirmacaoPin: '654321',
      }),
    })
    expect(resAtivar.status).toBe(200)

    // c) logar usando formato +55 11 97777-7777
    const resLogin = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '+55 11 97777-7777', pin: '654321' }),
    })

    // d) esperar 200
    expect(resLogin.status).toBe(200)
    const json = (await resLogin.json()) as any
    expect(json.sessionToken).toBeDefined()
  })
})
