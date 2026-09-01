import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
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
  let tokenAtivacaoPuro = ''
  let sessionTokenPuro = ''
  let tokenInativoPuro = ''

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
      
      INSERT INTO funcoes (id, nome) VALUES ('func-1', 'Função 1');
      INSERT INTO vinculos_funcionais (id, membro_id, funcao_id, regional_id, ativo) VALUES ('vinc-1', '${membroId}', 'func-1', '${regionalId}', 1);
    `)
  })

  // 1-5: Geração de Link (Admin)
  it('1. Admin pode gerar link de ativação para membro válido', async () => {
    const res = await req(`/api/v1/admin/membros/${membroId}/link-ativacao`, { method: 'POST' })
    const json = await res.json() as any
    expect(res.status).toBe(201)
    expect(json.token).toBeDefined()
    tokenAtivacaoPuro = json.token
  })

  it('2. Link gerado possui formato correto na resposta', async () => {
    expect(tokenAtivacaoPuro.length).toBeGreaterThan(10)
  })

  it('3. Link gerado é salvo no banco com token_hash (nunca token puro)', async () => {
    const link = sqlite.prepare('SELECT * FROM links_ativacao WHERE membro_id = ?').get(membroId) as any
    expect(link.token_hash).toBeDefined()
    expect(link.token_hash).not.toBe(tokenAtivacaoPuro)
  })

  it('4. Admin não pode gerar link para membro inativo', async () => {
    const res = await req(`/api/v1/admin/membros/${membroInativoId}/link-ativacao`, { method: 'POST' })
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
      body: JSON.stringify({ celular: '11999999999', dataNascimento: '1990-01-01', pin: '123456', confirmacaoPin: '123456' })
    })
    expect(res.status).toBe(400)
  })

  it('7. Ativação falha se token for inválido (tamanho)', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: '', celular: '11999999999', dataNascimento: '1990-01-01', pin: '123456', confirmacaoPin: '123456' })
    })
    expect(res.status).toBe(400)
  })

  it('8. Ativação falha se token não existir no banco', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'inexistente12345678', celular: '11999999999', dataNascimento: '1990-01-01', pin: '123456', confirmacaoPin: '123456' })
    })
    expect(res.status).toBe(400)
  })

  it('9. Ativação falha se celular não for enviado', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenAtivacaoPuro, dataNascimento: '1990-01-01', pin: '123456', confirmacaoPin: '123456' })
    })
    expect(res.status).toBe(400)
  })

  it('10. Ativação falha se celular não bater com o cadastro', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11000000000', dataNascimento: '1990-01-01', pin: '123456', confirmacaoPin: '123456' })
    })
    expect(res.status).toBe(400)
  })

  it('11. Ativação falha se dataNascimento não for enviada', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11999999999', pin: '123456', confirmacaoPin: '123456' })
    })
    expect(res.status).toBe(400)
  })

  it('12. Ativação falha se dataNascimento não bater com o cadastro', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11999999999', dataNascimento: '2000-01-01', pin: '123456', confirmacaoPin: '123456' })
    })
    expect(res.status).toBe(400)
  })

  it('13. Ativação falha se PIN não for enviado', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11999999999', dataNascimento: '1990-01-01', confirmacaoPin: '123456' })
    })
    expect(res.status).toBe(400)
  })

  it('14. Ativação falha se PIN tiver menos de 6 dígitos', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11999999999', dataNascimento: '1990-01-01', pin: '12345', confirmacaoPin: '12345' })
    })
    expect(res.status).toBe(400)
  })

  it('15. Ativação falha se confirmacaoPin não for enviado', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11999999999', dataNascimento: '1990-01-01', pin: '123456' })
    })
    expect(res.status).toBe(400)
  })

  it('16. Ativação falha se confirmacaoPin for diferente do PIN', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11999999999', dataNascimento: '1990-01-01', pin: '123456', confirmacaoPin: '654321' })
    })
    expect(res.status).toBe(400)
  })

  it('17. Ativação falha se membro associado ao token foi inativado', async () => {
    sqlite.exec(`UPDATE membros SET ativo = 0 WHERE id = '${membroId}'`)
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11999999999', dataNascimento: '1990-01-01', pin: '123456', confirmacaoPin: '123456' })
    })
    expect(res.status).toBe(400)
    sqlite.exec(`UPDATE membros SET ativo = 1 WHERE id = '${membroId}'`)
  })

  it('18. Ativação falha se token já expirou', async () => {
    sqlite.exec(`UPDATE links_ativacao SET expira_em = '2000-01-01T00:00:00Z' WHERE membro_id = '${membroId}'`)
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11999999999', dataNascimento: '1990-01-01', pin: '123456', confirmacaoPin: '123456' })
    })
    expect(res.status).toBe(400)
    sqlite.exec(`UPDATE links_ativacao SET expira_em = '2099-01-01T00:00:00Z' WHERE membro_id = '${membroId}'`)
  })

  it('19. Ativação falha se token já foi revogado', async () => {
    sqlite.exec(`UPDATE links_ativacao SET revogado_em = CURRENT_TIMESTAMP WHERE membro_id = '${membroId}'`)
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11999999999', dataNascimento: '1990-01-01', pin: '123456', confirmacaoPin: '123456' })
    })
    expect(res.status).toBe(400)
    sqlite.exec(`UPDATE links_ativacao SET revogado_em = NULL WHERE membro_id = '${membroId}'`)
  })

  // 20-27: Sucesso na Ativação e Verificações no Banco
  it('20. Ativação com dados corretos retorna 200 e gera token de sessão', async () => {
    const res = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11999999999', dataNascimento: '1990-01-01', pin: '123456', confirmacaoPin: '123456' })
    })
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(json.sessionToken).toBeDefined()
    sessionTokenPuro = json.sessionToken
  })

  it('21. Ativação bem-sucedida gera pin_hash e pin_salt para o membro', async () => {
    const membro = sqlite.prepare('SELECT pin_hash, pin_salt FROM membros WHERE id = ?').get(membroId) as any
    expect(membro.pin_hash).not.toBeNull()
    expect(membro.pin_salt).not.toBeNull()
  })

  it('22. Ativação bem-sucedida marca autenticacao_ativa como true', async () => {
    const membro = sqlite.prepare('SELECT autenticacao_ativa FROM membros WHERE id = ?').get(membroId) as any
    expect(membro.autenticacao_ativa).toBe(1)
  })

  it('23. Ativação bem-sucedida zera as tentativas_pin', async () => {
    const membro = sqlite.prepare('SELECT tentativas_pin FROM membros WHERE id = ?').get(membroId) as any
    expect(membro.tentativas_pin).toBe(0)
  })

  it('24. Ativação bem-sucedida remove bloqueado_ate se existisse', async () => {
    const membro = sqlite.prepare('SELECT bloqueado_ate FROM membros WHERE id = ?').get(membroId) as any
    expect(membro.bloqueado_ate).toBeNull()
  })

  it('25. Ativação bem-sucedida preenche ativado_em', async () => {
    const membro = sqlite.prepare('SELECT ativado_em FROM membros WHERE id = ?').get(membroId) as any
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
      body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11999999999', dataNascimento: '1990-01-01', pin: '123456', confirmacaoPin: '123456' })
    })
    expect(res.status).toBe(400)
  })

  // 28-38: Login
  it('28. Login falha se identificador (celular) não for enviado', async () => {
    const res = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '123456' })
    })
    expect(res.status).toBe(400)
  })

  it('29. Login falha se PIN não for enviado', async () => {
    const res = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '11999999999' })
    })
    expect(res.status).toBe(400)
  })

  it('30. Login falha genérica se celular não existir', async () => {
    const res = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '11000000000', pin: '123456' })
    })
    expect(res.status).toBe(401)
  })

  it('31. Login falha genérica se membro for inativo', async () => {
    sqlite.exec(`UPDATE membros SET ativo = 0 WHERE id = '${membroId}'`)
    const res = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '11999999999', pin: '123456' })
    })
    expect(res.status).toBe(401)
    sqlite.exec(`UPDATE membros SET ativo = 1 WHERE id = '${membroId}'`)
  })

  it('32. Login falha genérica se membro não tiver autenticação ativa', async () => {
    sqlite.exec(`UPDATE membros SET autenticacao_ativa = 0 WHERE id = '${membroId}'`)
    const res = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '11999999999', pin: '123456' })
    })
    expect(res.status).toBe(401)
    sqlite.exec(`UPDATE membros SET autenticacao_ativa = 1 WHERE id = '${membroId}'`)
  })

  it('33. Login falha com PIN incorreto', async () => {
    const res = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '11999999999', pin: '654321' })
    })
    expect(res.status).toBe(401)
  })

  it('34. Login com PIN incorreto incrementa tentativas_pin no banco', async () => {
    const membro = sqlite.prepare('SELECT tentativas_pin FROM membros WHERE id = ?').get(membroId) as any
    expect(membro.tentativas_pin).toBe(1)
  })

  it('35. Login com 5 falhas consecutivas bloqueia a conta', async () => {
    for (let i = 0; i < 4; i++) {
      await req('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: '11999999999', pin: '000000' })
      })
    }
    const membro = sqlite.prepare('SELECT tentativas_pin, bloqueado_ate FROM membros WHERE id = ?').get(membroId) as any
    expect(membro.tentativas_pin).toBe(5)
    expect(membro.bloqueado_ate).not.toBeNull()
  })

  it('36. Login bloqueado retorna erro 429 mesmo se informar PIN correto', async () => {
    const res = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '11999999999', pin: '123456' })
    })
    expect(res.status).toBe(429)
  })

  it('37. Login bem-sucedido (após bloqueio expirado) zera contadores e gera token de sessão', async () => {
    sqlite.exec(`UPDATE membros SET bloqueado_ate = '2000-01-01T00:00:00Z' WHERE id = '${membroId}'`)
    
    const res = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador: '11999999999', pin: '123456' })
    })
    
    expect(res.status).toBe(200)
    const json = await res.json() as any
    sessionTokenPuro = json.sessionToken
    
    const membro = sqlite.prepare('SELECT tentativas_pin, bloqueado_ate FROM membros WHERE id = ?').get(membroId) as any
    expect(membro.tentativas_pin).toBe(0)
    expect(membro.bloqueado_ate).toBeNull()
  })

  // 38-40: Sessão, Logout e Recuperação
  it('38. Endpoint protegido /auth/me/vinculos retorna 200 com os dados corretos', async () => {
    const res = await req('/api/v1/auth/me/vinculos', {
      headers: { 'Authorization': `Bearer ${sessionTokenPuro}` }
    })
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(json.vinculosAtivos).toHaveLength(1)
  })

  it('39. Logout revoga a sessão e bloqueia acessos subsequentes', async () => {
    const resLogout = await req('/api/v1/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${sessionTokenPuro}` }
    })
    expect(resLogout.status).toBe(200)

    const resMe = await req('/api/v1/auth/me', {
      headers: { 'Authorization': `Bearer ${sessionTokenPuro}` }
    })
    expect(resMe.status).toBe(401)
  })

  it('40. Reset administrativo limpa PIN e revoga todas as sessões e links', async () => {
    const resReset = await req(`/api/v1/admin/membros/${membroId}/reset-autenticacao`, { method: 'POST' })
    expect(resReset.status).toBe(200)

    const membro = sqlite.prepare('SELECT pin_hash, autenticacao_ativa FROM membros WHERE id = ?').get(membroId) as any
    expect(membro.pin_hash).toBeNull()
    expect(membro.autenticacao_ativa).toBe(0)

    const sessoesCount = sqlite.prepare('SELECT COUNT(*) as count FROM sessoes WHERE membro_id = ? AND revogado_em IS NULL').get(membroId) as any
    expect(sessoesCount.count).toBe(0)
  })
})
