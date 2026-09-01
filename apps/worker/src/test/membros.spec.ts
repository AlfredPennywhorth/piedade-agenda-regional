import { describe, it, expect, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'

type MembroResponse = {
  id: string
  nome?: string
  casaId?: string
  ativo?: boolean
}

type ErroResponse = {
  error: string
}

const sqlite = new Database(':memory:')
sqlite.pragma('foreign_keys = ON')

const db = drizzle(sqlite, { schema })
const app = createApp(db)

beforeAll(() => {
  const setupSql = `
    CREATE TABLE regionais (
      id text PRIMARY KEY NOT NULL,
      nome text NOT NULL,
      codigo text,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE administracoes (
      id text PRIMARY KEY NOT NULL,
      regional_id text NOT NULL,
      nome text NOT NULL,
      codigo text,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (regional_id) REFERENCES regionais(id)
    );

    CREATE TABLE setores (
      id text PRIMARY KEY NOT NULL,
      administracao_id text NOT NULL,
      nome text NOT NULL,
      codigo text,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (administracao_id) REFERENCES administracoes(id)
    );

    CREATE TABLE casas (
      id text PRIMARY KEY NOT NULL,
      setor_id text NOT NULL,
      nome text NOT NULL,
      codigo text,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (setor_id) REFERENCES setores(id)
    );

    CREATE TABLE grupos_trabalho (
      id text PRIMARY KEY NOT NULL,
      nome text NOT NULL,
      ativo integer DEFAULT true NOT NULL,
      regional_id text,
      administracao_id text,
      setor_id text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (regional_id) REFERENCES regionais(id),
      FOREIGN KEY (administracao_id) REFERENCES administracoes(id),
      FOREIGN KEY (setor_id) REFERENCES setores(id)
    );

    CREATE TABLE membros (
      id text PRIMARY KEY NOT NULL,
      nome text NOT NULL,
      data_nascimento text,
      celular text,
      casa_id text NOT NULL,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (casa_id) REFERENCES casas(id)
    );
  `

  sqlite.exec(setupSql)
})

const req = async (path: string, options?: RequestInit) => {
  const request = new Request(`http://localhost${path}`, options)
  return app.request(request)
}

describe('Testes de Membros', () => {
  const regionalId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const administracaoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const setorId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const casaId = '11111111-1111-4111-8111-111111111111'
  const casaId2 = '22222222-2222-4222-8222-222222222222'
  const casaInexistenteId = '99999999-9999-4999-8999-999999999999'

  let membroId = ''

  beforeAll(() => {
    sqlite.exec(`
      INSERT INTO regionais (id, nome)
      VALUES ('${regionalId}', 'Regional 1');

      INSERT INTO administracoes (id, regional_id, nome)
      VALUES ('${administracaoId}', '${regionalId}', 'Adm 1');

      INSERT INTO setores (id, administracao_id, nome)
      VALUES ('${setorId}', '${administracaoId}', 'Setor 1');

      INSERT INTO casas (id, setor_id, nome)
      VALUES ('${casaId}', '${setorId}', 'Casa 1');

      INSERT INTO casas (id, setor_id, nome)
      VALUES ('${casaId2}', '${setorId}', 'Casa 2');
    `)
  })

  it('1. Deve criar membro válido', async () => {
    const res = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Pessoa Teste A',
        casaId,
      }),
    })

    const json = (await res.json()) as MembroResponse

    expect(res.status).toBe(201)
    expect(json.nome).toBe('Pessoa Teste A')

    membroId = json.id
  })

  it('2. Deve rejeitar membro com Casa inexistente', async () => {
    const res = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Pessoa Teste B',
        casaId: casaInexistenteId,
      }),
    })

    const json = (await res.json()) as ErroResponse

    expect(res.status).toBe(400)
    expect(json.error).toContain('Casa vinculada não existe')
  })

  it('3. Deve alterar Casa principal preservando ID', async () => {
    const resPatch = await req(`/api/v1/membros/${membroId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        casaId: casaId2,
      }),
    })

    const json = (await resPatch.json()) as MembroResponse

    expect(resPatch.status).toBe(200)
    expect(json.id).toBe(membroId)
    expect(json.casaId).toBe(casaId2)
  })

  it('4. Deve inativar membro (ativo = false)', async () => {
    const resPatch = await req(`/api/v1/membros/${membroId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ativo: false,
      }),
    })

    const json = (await resPatch.json()) as MembroResponse

    expect(resPatch.status).toBe(200)
    expect(json.ativo).toBe(false)
  })

  it('18. Rejeitar membro inexistente no GET e PATCH', async () => {
    const membroInexistenteId = '88888888-8888-4888-8888-888888888888'

    const resGet = await req(`/api/v1/membros/${membroInexistenteId}`)

    expect(resGet.status).toBe(404)

    const resPatch = await req(`/api/v1/membros/${membroInexistenteId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ativo: false,
      }),
    })

    expect(resPatch.status).toBe(404)
  })
})
