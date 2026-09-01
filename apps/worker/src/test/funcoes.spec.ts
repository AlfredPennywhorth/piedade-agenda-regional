import { describe, it, expect, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'

type FuncaoResponse = {
  id: string
  nome?: string
  ativo?: boolean
}

const sqlite = new Database(':memory:')
sqlite.pragma('foreign_keys = ON')
const db = drizzle(sqlite, { schema })
const app = createApp(db)

beforeAll(() => {
  const setupSql = `
    CREATE TABLE funcoes (id text PRIMARY KEY NOT NULL, nome text NOT NULL, codigo text, descricao text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL);
  `
  sqlite.exec(setupSql)
})

const req = async (path: string, options?: RequestInit) => {
  const request = new Request(`http://localhost${path}`, options)
  return app.request(request)
}

describe('Testes de Funções', () => {
  let funcaoId = ''

  it('5. Deve criar função', async () => {
    const res = await req('/api/v1/funcoes', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Função Teste' })
    })
    const json = (await res.json()) as FuncaoResponse
    expect(res.status).toBe(201)
    expect(json.nome).toBe('Função Teste')
    funcaoId = json.id
  })

  it('6. Deve inativar função', async () => {
    const resPatch = await req(`/api/v1/funcoes/${funcaoId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ativo: false })
    })
    const json = (await resPatch.json()) as FuncaoResponse
    expect(resPatch.status).toBe(200)
    expect(json.ativo).toBe(false)
  })

  it('19. Rejeitar função inexistente', async () => {
    const resGet = await req('/api/v1/funcoes/inexistente')
    expect(resGet.status).toBe(404)
  })
})
