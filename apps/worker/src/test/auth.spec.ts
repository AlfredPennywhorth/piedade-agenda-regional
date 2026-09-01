import { describe, it, expect, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { createApp } from '../index'
import * as schema from '../db/schema'

const sqlite = new Database(':memory:')
sqlite.pragma('foreign_keys = ON')

const db = drizzle(sqlite, { schema })
// Habilita as rotas admin especificamente para os testes
const app = createApp(db, { enableAdminRoutes: true })

beforeAll(() => {
  const setupSql = `
    CREATE TABLE regionais (id text PRIMARY KEY NOT NULL, nome text NOT NULL, codigo text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL);
    CREATE TABLE administracoes (id text PRIMARY KEY NOT NULL, regional_id text NOT NULL, nome text NOT NULL, codigo text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (regional_id) REFERENCES regionais(id));
    CREATE TABLE setores (id text PRIMARY KEY NOT NULL, administracao_id text NOT NULL, nome text NOT NULL, codigo text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (administracao_id) REFERENCES administracoes(id));
    CREATE TABLE casas (id text PRIMARY KEY NOT NULL, setor_id text NOT NULL, nome text NOT NULL, codigo text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (setor_id) REFERENCES setores(id));
    CREATE TABLE grupos_trabalho (id text PRIMARY KEY NOT NULL, nome text NOT NULL, ativo integer DEFAULT true NOT NULL, regional_id text, administracao_id text, setor_id text, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (regional_id) REFERENCES regionais(id), FOREIGN KEY (administracao_id) REFERENCES administracoes(id), FOREIGN KEY (setor_id) REFERENCES setores(id));
    
    CREATE TABLE membros (
      id text PRIMARY KEY NOT NULL,
      nome text NOT NULL,
      data_nascimento text,
      celular text,
      casa_id text NOT NULL,
      ativo integer DEFAULT true NOT NULL,
      autenticacao_ativa integer DEFAULT false NOT NULL,
      pin_hash text,
      pin_salt text,
      bloqueado_ate text,
      tentativas_pin integer DEFAULT 0 NOT NULL,
      ativado_em text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (casa_id) REFERENCES casas(id)
    );

    CREATE TABLE funcoes (id text PRIMARY KEY NOT NULL, nome text NOT NULL, codigo text, descricao text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL);
    
    CREATE TABLE vinculos_funcionais (
      id text PRIMARY KEY NOT NULL,
      membro_id text NOT NULL,
      funcao_id text NOT NULL,
      regional_id text,
      administracao_id text,
      setor_id text,
      casa_id text,
      grupo_trabalho_id text,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (membro_id) REFERENCES membros(id),
      FOREIGN KEY (funcao_id) REFERENCES funcoes(id)
    );

    CREATE TABLE links_ativacao (
      id text PRIMARY KEY NOT NULL,
      membro_id text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expira_em text NOT NULL,
      utilizado_em text,
      revogado_em text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (membro_id) REFERENCES membros(id)
    );

    CREATE TABLE sessoes (
      id text PRIMARY KEY NOT NULL,
      membro_id text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expira_em text NOT NULL,
      revogado_em text,
      ultimo_acesso_em text,
      user_agent text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (membro_id) REFERENCES membros(id)
    );

    CREATE TABLE tentativas_acesso (
      id text PRIMARY KEY NOT NULL,
      membro_id text,
      tipo text NOT NULL,
      sucesso integer NOT NULL,
      motivo text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (membro_id) REFERENCES membros(id)
    );
  `
  sqlite.exec(setupSql)
})

const req = async (path: string, options?: RequestInit) => {
  const request = new Request(`http://localhost${path}`, options)
  return app.request(request)
}

describe('Autenticação e Sessões S03', () => {
  const regionalId = 'reg-1'
  const admId = 'adm-1'
  const setorId = 'set-1'
  const casaId = 'casa-1'
  const membroId = 'mem-1'
  const membroInativoId = 'mem-inativo'
  let tokenAtivacaoPuro = ''
  let sessionTokenPuro = ''

  beforeAll(() => {
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

  describe('Ativação', () => {
    it('1. gerar link (admin)', async () => {
      const res = await req(`/api/v1/admin/membros/${membroId}/link-ativacao`, { method: 'POST' })
      const json = await res.json() as any
      expect(res.status).toBe(201)
      expect(json.token).toBeDefined()
      tokenAtivacaoPuro = json.token
    })

    it('2. banco guarda hash e não token puro', async () => {
      const link = db.prepare('SELECT * FROM links_ativacao WHERE membro_id = ?').get(membroId) as any
      expect(link).toBeDefined()
      expect(link.token_hash).toBeDefined()
      expect(link.token_hash).not.toBe(tokenAtivacaoPuro)
    })

    it('4. token inexistente', async () => {
      const res = await req('/api/v1/auth/ativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'inexistente123', celular: '11999999999', dataNascimento: '1990-01-01', pin: '123456' })
      })
      expect(res.status).toBe(400)
    })

    it('8. celular incorreto', async () => {
      const res = await req('/api/v1/auth/ativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11000000000', dataNascimento: '1990-01-01', pin: '123456' })
      })
      expect(res.status).toBe(400)
    })

    it('9. nascimento incorreto', async () => {
      const res = await req('/api/v1/auth/ativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11999999999', dataNascimento: '2000-01-01', pin: '123456' })
      })
      expect(res.status).toBe(400)
    })

    it('10. PIN inválido', async () => {
      const res = await req('/api/v1/auth/ativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11999999999', dataNascimento: '1990-01-01', pin: '12' })
      })
      expect(res.status).toBe(400) // schema error
    })

    it('12. membro inativo', async () => {
      const resLink = await req(`/api/v1/admin/membros/${membroInativoId}/link-ativacao`, { method: 'POST' })
      const jsonLink = await resLink.json() as any
      const tokenInativo = jsonLink.token
      
      const res = await req('/api/v1/auth/ativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInativo, celular: '11988888888', dataNascimento: '1990-01-01', pin: '123456' })
      })
      expect(res.status).toBe(400)
    })

    it('3. ativar com dados corretos', async () => {
      const res = await req('/api/v1/auth/ativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11999999999', dataNascimento: '1990-01-01', pin: '123456' })
      })
      expect(res.status).toBe(200)
      const json = await res.json() as any
      expect(json.sessionToken).toBeDefined()
      sessionTokenPuro = json.sessionToken
    })

    it('7. token já utilizado', async () => {
      const res = await req('/api/v1/auth/ativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11999999999', dataNascimento: '1990-01-01', pin: '123456' })
      })
      expect(res.status).toBe(400)
    })
    
    it('5. token expirado', async () => {
      sqlite.exec(`UPDATE links_ativacao SET expira_em = '2000-01-01T00:00:00Z' WHERE membro_id = '${membroId}'`)
      const res = await req('/api/v1/auth/ativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11999999999', dataNascimento: '1990-01-01', pin: '123456' })
      })
      expect(res.status).toBe(400)
    })
    
    it('6. token revogado', async () => {
      sqlite.exec(`UPDATE links_ativacao SET expira_em = '2099-01-01T00:00:00Z', revogado_em = CURRENT_TIMESTAMP WHERE membro_id = '${membroId}'`)
      const res = await req('/api/v1/auth/ativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenAtivacaoPuro, celular: '11999999999', dataNascimento: '1990-01-01', pin: '123456' })
      })
      expect(res.status).toBe(400)
    })
  })

  describe('Login', () => {
    it('14. PIN incorreto', async () => {
      const res = await req('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: '11999999999', pin: '000000' })
      })
      expect(res.status).toBe(401)
    })

    it('15. contador incrementa', async () => {
      const row = db.prepare('SELECT tentativas_pin FROM membros WHERE id = ?').get(membroId) as any
      expect(row.tentativas_pin).toBe(1)
    })

    it('16. 5 falhas geram bloqueio', async () => {
      for (let i = 0; i < 4; i++) {
        await req('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identificador: '11999999999', pin: '000000' })
        })
      }
      const row = db.prepare('SELECT tentativas_pin, bloqueado_ate FROM membros WHERE id = ?').get(membroId) as any
      expect(row.tentativas_pin).toBe(5)
      expect(row.bloqueado_ate).not.toBeNull()
    })

    it('17. login bloqueado', async () => {
      const res = await req('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: '11999999999', pin: '123456' }) // PIN correto, mas bloqueado
      })
      expect(res.status).toBe(429)
    })

    it('18. login após término do bloqueio', async () => {
      // Avança o tempo no banco para remover bloqueio manualmente
      sqlite.exec(`UPDATE membros SET bloqueado_ate = '2000-01-01T00:00:00Z' WHERE id = '${membroId}'`)
      
      const res = await req('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: '11999999999', pin: '123456' })
      })
      expect(res.status).toBe(200)
    })

    it('19. sucesso zera contador', async () => {
      const row = db.prepare('SELECT tentativas_pin FROM membros WHERE id = ?').get(membroId) as any
      expect(row.tentativas_pin).toBe(0)
    })

    it('22. resposta não permite enumeração evidente', async () => {
      const res = await req('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: '11900000000', pin: '123456' }) // Celular inexistente
      })
      expect(res.status).toBe(401)
      const json = await res.json() as any
      expect(json.error).toBe('Credenciais inválidas') // Mesma mensagem
    })
  })

  describe('Sessão', () => {
    it('23. sessão criada', async () => {
      expect(sessionTokenPuro).not.toBe('')
    })

    it('24. banco não armazena token puro', async () => {
      const row = db.prepare('SELECT token_hash FROM sessoes WHERE membro_id = ?').get(membroId) as any
      expect(row.token_hash).not.toBe(sessionTokenPuro)
    })

    it('25. /auth/me com token válido', async () => {
      const res = await req('/api/v1/auth/me', {
        headers: { 'Authorization': `Bearer ${sessionTokenPuro}` }
      })
      expect(res.status).toBe(200)
    })

    it('26. token inválido', async () => {
      const res = await req('/api/v1/auth/me', {
        headers: { 'Authorization': `Bearer invalidtoken` }
      })
      expect(res.status).toBe(401)
    })

    it('29. logout revoga sessão', async () => {
      const res = await req('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionTokenPuro}` }
      })
      expect(res.status).toBe(200)
    })

    it('30. sessão não funciona após logout', async () => {
      const res = await req('/api/v1/auth/me', {
        headers: { 'Authorization': `Bearer ${sessionTokenPuro}` }
      })
      expect(res.status).toBe(401)
    })
  })

  describe('Permissões', () => {
    let newToken = ''
    beforeAll(async () => {
      // Cria nova sessão para testar
      const res = await req('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: '11999999999', pin: '123456' })
      })
      const json = await res.json() as any
      newToken = json.sessionToken
    })

    it('35. retorna somente vínculos ativos', async () => {
      const res = await req('/api/v1/auth/me/vinculos', {
        headers: { 'Authorization': `Bearer ${newToken}` }
      })
      expect(res.status).toBe(200)
      const json = await res.json() as any
      expect(json.vinculosAtivos).toHaveLength(1)
      expect(json.vinculosAtivos[0].funcaoId).toBe('func-1')
    })
  })

  describe('Recuperação', () => {
    it('31. reset administrativo revoga sessões', async () => {
      const res = await req(`/api/v1/admin/membros/${membroId}/reset-autenticacao`, { method: 'POST' })
      expect(res.status).toBe(200)

      const sessoesRow = db.prepare('SELECT revogado_em FROM sessoes WHERE membro_id = ?').get(membroId) as any
      expect(sessoesRow.revogado_em).not.toBeNull()
    })

    it('32. reset remove PIN', async () => {
      const row = db.prepare('SELECT pin_hash FROM membros WHERE id = ?').get(membroId) as any
      expect(row.pin_hash).toBeNull()
    })

    it('33. reset desativa autenticação', async () => {
      const row = db.prepare('SELECT autenticacao_ativa FROM membros WHERE id = ?').get(membroId) as any
      expect(row.autenticacao_ativa).toBe(0)
    })
  })
})
