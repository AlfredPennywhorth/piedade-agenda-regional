import { describe, it, expect, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { setupDb } from './setup'

type MembroResponse = {
  id: string
  nome?: string
  casaId?: string
  ativo?: boolean
}

type ErroResponse = {
  error: string
}

describe('Membros (S01) - Testes de Integração Drizzle/SQLite', () => {
  let sqlite: any
  let db: ReturnType<typeof drizzle>
  let app: any

  const req = async (path: string, options?: RequestInit) => {
    const request = new Request(`http://localhost${path}`, options)
    return app.request(request)
  }

  const regionalId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const administracaoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const setorId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const casaId = '11111111-1111-4111-8111-111111111111'
  const casaId2 = '22222222-2222-4222-8222-222222222222'
  const casaInexistenteId = '99999999-9999-4999-8999-999999999999'
  const membroId = '33333333-3333-4333-8333-333333333333'

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema })
    setupDb(sqlite)
    app = createApp(db)

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

      INSERT INTO membros (id, nome, celular, data_ordenacao, codigo_carteirinha, casa_id, ativo)
      VALUES ('${membroId}', 'Pessoa Teste Base', '11999999999', '1990-01-01', 'BASE-001', '${casaId}', 1);
    `)
  })

  it('1. Deve criar membro válido', async () => {
    const res = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Pessoa Teste A',
        dataOrdenacao: '2000-01-01',
        codigoCarteirinha: 'TESTE-A',
        casaId,
      }),
    })

    const json = (await res.json()) as MembroResponse

    expect(res.status).toBe(201)
    expect(json.nome).toBe('Pessoa Teste A')
    expect(json.id).toBeDefined()
  })

  it('2. Deve rejeitar membro com Casa inexistente', async () => {
    const res = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Pessoa Teste B',
        dataOrdenacao: '2000-01-01',
        codigoCarteirinha: 'TESTE-B',
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

  it('19. Deve rejeitar celular com formato inválido no POST', async () => {
    const res = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Membro Teste', dataOrdenacao: '2000-01-01', codigoCarteirinha: 'TESTE-19', casaId, celular: '123' }), // Inválido
    })
    const json = await res.json() as any
    expect(res.status).toBe(400)
    expect(JSON.stringify(json.error)).toContain('Formato de celular inválido')
  })

  it('20. Deve normalizar celular corretamente no POST', async () => {
    const res = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Membro Normalizado', dataOrdenacao: '2000-01-01', codigoCarteirinha: 'TESTE-20', casaId, celular: '+55 (11) 98888-7777' }),
    })
    const json = await res.json() as any
    expect(res.status).toBe(201)
    
    // Verifica no banco se foi salvo normalizado
    const salvo = await db.select().from(schema.membros).where(eq(schema.membros.id, json.id)).get()
    expect(salvo?.celular).toBe('11988887777')
  })

  it('21. Deve bloquear celular duplicado no POST e registrar tentativa', async () => {
    const res = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Duplicado', dataOrdenacao: '2000-01-01', codigoCarteirinha: 'TESTE-21', casaId, celular: '+55 11 99999-9999' }), // celular do membroId base ('11999999999')
    })
    const json = await res.json() as any
    expect(res.status).toBe(409)
    expect(json.code).toBe('CELULAR_JA_VINCULADO')

    const tentativa = await db.select().from(schema.tentativasAcesso).where(eq(schema.tentativasAcesso.tipo, 'CONFLITO_CELULAR')).get()
    expect(tentativa).toBeDefined()
    expect(tentativa?.sucesso).toBe(false)
    expect(tentativa?.motivo).toBe('Celular já vinculado a outro membro')
  })

  it('22. Deve bloquear celular duplicado no PATCH e registrar tentativa', async () => {
    // Cria um segundo membro com celular diferente
    const resCreate = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Segundo Membro', dataOrdenacao: '2000-01-01', codigoCarteirinha: 'TESTE-22', casaId, celular: '11977777777' }),
    })
    const jsonCreate = await resCreate.json() as any
    const segundoMembroId = jsonCreate.id

    // Tenta atualizar para o celular do membro base
    const resPatch = await req(`/api/v1/membros/${segundoMembroId}`, {
      method: 'PATCH',
      body: JSON.stringify({ celular: '11999999999' }),
    })
    const jsonPatch = await resPatch.json() as any
    expect(resPatch.status).toBe(409)
    expect(jsonPatch.code).toBe('CELULAR_JA_VINCULADO')

    // Deve ter registrado tentativa ligada ao ID do membro que tentou
    const tentativa = await db.select().from(schema.tentativasAcesso)
      .where(and(
        eq(schema.tentativasAcesso.tipo, 'CONFLITO_CELULAR'),
        eq(schema.tentativasAcesso.membroId, segundoMembroId)
      ))
      .get()
    expect(tentativa).toBeDefined()
  })
})
