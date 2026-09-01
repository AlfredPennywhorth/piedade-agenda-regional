import { describe, it, expect, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'

const sqlite = new Database(':memory:')
sqlite.pragma('foreign_keys = ON')
const db = drizzle(sqlite, { schema })
const app = createApp(db)

beforeAll(() => {
  const setupSql = `
    CREATE TABLE regionais (id text PRIMARY KEY NOT NULL, nome text NOT NULL, codigo text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL);
    CREATE TABLE administracoes (id text PRIMARY KEY NOT NULL, regional_id text NOT NULL, nome text NOT NULL, codigo text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (regional_id) REFERENCES regionais(id));
    CREATE TABLE setores (id text PRIMARY KEY NOT NULL, administracao_id text NOT NULL, nome text NOT NULL, codigo text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (administracao_id) REFERENCES administracoes(id));
    CREATE TABLE casas (id text PRIMARY KEY NOT NULL, setor_id text NOT NULL, nome text NOT NULL, codigo text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (setor_id) REFERENCES setores(id));
    CREATE TABLE grupos_trabalho (id text PRIMARY KEY NOT NULL, nome text NOT NULL, ativo integer DEFAULT true NOT NULL, regional_id text, administracao_id text, setor_id text, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (regional_id) REFERENCES regionais(id), FOREIGN KEY (administracao_id) REFERENCES administracoes(id), FOREIGN KEY (setor_id) REFERENCES setores(id));

    CREATE TABLE membros (id text PRIMARY KEY NOT NULL, nome text NOT NULL, data_nascimento text, celular text, casa_id text NOT NULL, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (casa_id) REFERENCES casas(id));
  `
  sqlite.exec(setupSql)
})

const req = async (path: string, options?: RequestInit) => {
  const request = new Request(`http://localhost${path}`, options)
  return app.request(request)
}

describe('Testes de Membros', () => {
  let casaId = 'casa-123'
  let membroId = ''

  beforeAll(() => {
    // Insere dados base
    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES ('reg-1', 'Regional 1');
      INSERT INTO administracoes (id, regional_id, nome) VALUES ('adm-1', 'reg-1', 'Adm 1');
      INSERT INTO setores (id, administracao_id, nome) VALUES ('setor-1', 'adm-1', 'Setor 1');
      INSERT INTO casas (id, setor_id, nome) VALUES ('${casaId}', 'setor-1', 'Casa 1');
      INSERT INTO casas (id, setor_id, nome) VALUES ('casa-2', 'setor-1', 'Casa 2');
    `)
  })

  it('1. Deve criar membro válido', async () => {
    const res = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Pessoa Teste A', casaId })
    })
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.nome).toBe('Pessoa Teste A')
    membroId = json.id
  })

  it('2. Deve rejeitar membro com Casa inexistente', async () => {
    const res = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Pessoa Teste B', casaId: 'casa-inexistente' })
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Casa vinculada não existe')
  })

  it('3. Deve alterar Casa principal preservando ID', async () => {
    const resPatch = await req(`/api/v1/membros/${membroId}`, {
      method: 'PATCH',
      body: JSON.stringify({ casaId: 'casa-2' })
    })
    const json = await resPatch.json()
    expect(resPatch.status).toBe(200)
    expect(json.id).toBe(membroId)
    expect(json.casaId).toBe('casa-2')
  })

  it('4. Deve inativar membro (ativo = false)', async () => {
    const resPatch = await req(`/api/v1/membros/${membroId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ativo: false })
    })
    const json = await resPatch.json()
    expect(resPatch.status).toBe(200)
    expect(json.ativo).toBe(false)
  })

  it('18. Rejeitar membro inexistente no GET e PATCH', async () => {
    const resGet = await req('/api/v1/membros/inexistente')
    expect(resGet.status).toBe(404)

    const resPatch = await req('/api/v1/membros/inexistente', {
      method: 'PATCH',
      body: JSON.stringify({ ativo: false })
    })
    expect(resPatch.status).toBe(404)
  })
})
