import { describe, it, expect, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'

// Cria banco de dados SQLite em memória
const sqlite = new Database(':memory:')
// Ativar foreign keys no SQLite para testes rigorosos
sqlite.pragma('foreign_keys = ON')

const db = drizzle(sqlite, { schema })

// Aplicação Hono com o DB injetado
const app = createApp(db)

beforeAll(() => {
  // Aplicamos um script manual minimalista pois o migrator padrão pode requerer pasta de migrations
  // Neste teste, executamos a criação de tabelas diretamente para validar as FKs e regras
  const setupSql = `
    CREATE TABLE regionais (id text PRIMARY KEY NOT NULL, nome text NOT NULL, codigo text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL);
    CREATE TABLE administracoes (id text PRIMARY KEY NOT NULL, regional_id text NOT NULL, nome text NOT NULL, codigo text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (regional_id) REFERENCES regionais(id));
    CREATE TABLE setores (id text PRIMARY KEY NOT NULL, administracao_id text NOT NULL, nome text NOT NULL, codigo text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (administracao_id) REFERENCES administracoes(id));
    CREATE TABLE casas (id text PRIMARY KEY NOT NULL, setor_id text NOT NULL, nome text NOT NULL, codigo text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (setor_id) REFERENCES setores(id));
    CREATE TABLE grupos_trabalho (id text PRIMARY KEY NOT NULL, nome text NOT NULL, ativo integer DEFAULT true NOT NULL, regional_id text, administracao_id text, setor_id text, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (regional_id) REFERENCES regionais(id), FOREIGN KEY (administracao_id) REFERENCES administracoes(id), FOREIGN KEY (setor_id) REFERENCES setores(id), CONSTRAINT check_escopo_unico CHECK((CASE WHEN regional_id IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN administracao_id IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN setor_id IS NOT NULL THEN 1 ELSE 0 END) = 1));
  `
  sqlite.exec(setupSql)
})

// Helper para injetar o db no Hono
const req = async (path: string, options?: RequestInit) => {
  const request = new Request(`http://localhost${path}`, options)
  return app.request(request)
}

describe('Testes do Modelo Institucional S01', () => {
  let regionalId = ''
  let admId = ''
  let setorId = ''
  let casaId = ''
  let setorId2 = ''

  it('1. Deve criar uma Regional', async () => {
    const res = await req('/api/v1/regionais', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Regional Teste', codigo: 'REG01' })
    })
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.nome).toBe('Regional Teste')
    expect(json.ativo).toBe(true)
    regionalId = json.id
  })

  it('2. Deve criar Administração vinculada à Regional', async () => {
    const res = await req('/api/v1/administracoes', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Adm Teste', regionalId })
    })
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.regionalId).toBe(regionalId)
    admId = json.id
  })

  it('3. Deve criar Setor vinculado à Administração', async () => {
    const res = await req('/api/v1/setores', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Setor Norte', administracaoId: admId })
    })
    const json = await res.json()
    expect(res.status).toBe(201)
    setorId = json.id

    // Criar um segundo setor para teste de transferência
    const res2 = await req('/api/v1/setores', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Setor Sul', administracaoId: admId })
    })
    const json2 = await res2.json()
    setorId2 = json2.id
  })

  it('4. Deve criar Casa vinculada ao Setor', async () => {
    const res = await req('/api/v1/casas', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Casa Central', setorId })
    })
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.setorId).toBe(setorId)
    casaId = json.id
  })

  it('5. Alterar Casa de um Setor para outro preservando seu ID e created_at', async () => {
    // Busca antes
    const resGet = await req(`/api/v1/casas/${casaId}`)
    const original = await resGet.json()

    // Transfere
    const resPatch = await req(`/api/v1/casas/${casaId}`, {
      method: 'PATCH',
      body: JSON.stringify({ setorId: setorId2 })
    })
    const json = await resPatch.json()
    
    expect(resPatch.status).toBe(200)
    expect(json.id).toBe(casaId) // Mesmo ID
    expect(json.setorId).toBe(setorId2) // Novo Setor
    expect(json.createdAt).toBe(original.createdAt) // Preservado
    expect(json.updatedAt).not.toBe(original.updatedAt) // Atualizado
  })

  it('6. Criar GT Regional', async () => {
    const res = await req('/api/v1/grupos-trabalho', {
      method: 'POST',
      body: JSON.stringify({ nome: 'GT Reg', regionalId })
    })
    expect(res.status).toBe(201)
  })

  it('7. Criar GT de Administração', async () => {
    const res = await req('/api/v1/grupos-trabalho', {
      method: 'POST',
      body: JSON.stringify({ nome: 'GT Adm', administracaoId: admId })
    })
    expect(res.status).toBe(201)
  })

  it('8. Criar GT de Setor', async () => {
    const res = await req('/api/v1/grupos-trabalho', {
      method: 'POST',
      body: JSON.stringify({ nome: 'GT Setor', setorId })
    })
    expect(res.status).toBe(201)
  })

  it('9. Rejeitar vínculos institucionais inexistentes (FKs)', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000'
    const res = await req('/api/v1/casas', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Casa Inválida', setorId: fakeUuid })
    })
    expect(res.status).toBe(400) // FK violation
  })

  it('10. Inativar entidade sem apagá-la (ativo = false)', async () => {
    const res = await req(`/api/v1/casas/${casaId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ativo: false })
    })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ativo).toBe(false)
  })

  it('11. Validações Zod (GT com múltiplos escopos e zero escopos)', async () => {
    // Dois escopos
    const resDois = await req('/api/v1/grupos-trabalho', {
      method: 'POST',
      body: JSON.stringify({ nome: 'GT Invalido', regionalId, administracaoId: admId })
    })
    expect(resDois.status).toBe(400)
    expect((await resDois.json()).error[0].message).toContain('exatamente um escopo')

    // Zero escopos
    const resZero = await req('/api/v1/grupos-trabalho', {
      method: 'POST',
      body: JSON.stringify({ nome: 'GT Invalido' })
    })
    expect(resZero.status).toBe(400)
    expect((await resZero.json()).error[0].message).toContain('exatamente um escopo')
  })

  it('12. Respostas HTTP adequadas para dados inválidos (400, 404)', async () => {
    // 404 - Not found
    const fakeUuid = '00000000-0000-0000-0000-000000000000'
    const res404 = await req(`/api/v1/casas/${fakeUuid}`)
    expect(res404.status).toBe(404)

    // 400 - Zod validation
    const res400 = await req('/api/v1/casas', {
      method: 'POST',
      body: JSON.stringify({ nome: 'a', setorId }) // nome mt curto
    })
    expect(res400.status).toBe(400)
  })
})
