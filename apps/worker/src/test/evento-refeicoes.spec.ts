import { describe, it, expect, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { setupDb } from './setup'
import { eq, and } from 'drizzle-orm'

describe('S09 - Eventos e Refeicoes', () => {
  let sqlite: any
  let db: ReturnType<typeof drizzle>
  let app: any

  const req = async (path: string, options?: RequestInit) => {
    const request = new Request(`http://localhost${path}`, options)
    return app.request(request)
  }

  const membroId = 'mem-admin'
  let sessionToken = ''

  // UUIDs válidos exigidos pelo EventoCreate (z.string().uuid())
  const regionalId = crypto.randomUUID()
  const localId = crypto.randomUUID()

  beforeAll(async () => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema })
    app = createApp(db, { enableAdminRoutes: true })
    setupDb(sqlite)

    const baseSql = `
      INSERT INTO regionais (id, nome) VALUES ('${regionalId}', 'Reg 1');
      INSERT INTO administracoes (id, regional_id, nome) VALUES ('adm-1', '${regionalId}', 'Adm 1');
      INSERT INTO setores (id, administracao_id, nome) VALUES ('set-1', 'adm-1', 'Set 1');
      INSERT INTO casas (id, setor_id, nome) VALUES ('casa-1', 'set-1', 'Casa 1');
      INSERT INTO locais (id, nome, endereco, numero, cidade, uf) VALUES ('${localId}', 'Local 1', 'Rua de Teste', '100', 'São Paulo', 'SP');
      
      INSERT INTO membros (id, nome, celular, casa_id, ativo)
      VALUES 
        ('${membroId}', 'Admin', '11999999999', 'casa-1', 1);
    `
    sqlite.exec(baseSql)

    const genSession = async (mid: string, cel: string) => {
      const resLink = await req(`/api/v1/admin/membros/${mid}/link-ativacao`, { method: 'POST' })
      const linkJson = await resLink.json() as any
      const resAtivar = await req('/api/v1/auth/ativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: linkJson.token, celular: cel, pin: '123456', confirmacaoPin: '123456' })
      })
      const ativarJson = await resAtivar.json() as any
      return ativarJson.sessionToken
    }

    sessionToken = await genSession(membroId, '11999999999')
    const conta = sqlite.prepare(
      'SELECT id FROM contas_acesso WHERE membro_id = ?'
    ).get(membroId) as { id: string }
    sqlite.prepare(
      'INSERT INTO acessos_conta (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id) VALUES (?, ?, \'GESTOR_AGENDA\', \'REGIONAL\', ?)'
    ).run(crypto.randomUUID(), conta.id, regionalId)
  })

  let eventoA = ''
  let eventoB = ''

  it('1. criar evento com possuiManha/possuiTarde', async () => {
    const res = await req('/api/v1/eventos', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento A',
        modalidade: 'PRESENCIAL',
        inicioEm: '2030-01-01T10:00:00Z',
        fimEm: '2030-01-01T18:00:00Z',
        regionalId,
        localId,
        possuiManha: true,
        possuiTarde: true
      })
    })
    expect(res.status).toBe(201)
    const json = await res.json() as any
    eventoA = json.id
    expect(json.possuiManha).toBe(true)
    expect(json.possuiTarde).toBe(true)
  })


  it('2. editar flags', async () => {
    const res = await req(`/api/v1/eventos/${eventoA}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ possuiTarde: false })
    })
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(json.possuiTarde).toBe(false)
  })

  it('3. defaults false/false', async () => {
    const res = await req('/api/v1/eventos', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento B',
        modalidade: 'PRESENCIAL',
        inicioEm: '2030-02-01T10:00:00Z',
        fimEm: '2030-02-01T18:00:00Z',
        regionalId,
        localId
      })
    })
    expect(res.status).toBe(201)
    const json = await res.json() as any
    eventoB = json.id
    expect(json.possuiManha).toBe(false)
    expect(json.possuiTarde).toBe(false)
  })

  it('4. adicionar CAFE_MANHA', async () => {
    const res = await req(`/api/v1/eventos/${eventoA}/refeicoes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'CAFE_MANHA' })
    })
    expect(res.status).toBe(201)
    const json = await res.json() as any
    expect(json.tipo).toBe('CAFE_MANHA')
    expect(json.ativo).toBe(true)
  })

  it('5. adicionar ALMOCO', async () => {
    const res = await req(`/api/v1/eventos/${eventoA}/refeicoes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'ALMOCO' })
    })
    expect(res.status).toBe(201)
  })

  it('6. rejeitar tipo inválido', async () => {
    const res = await req(`/api/v1/eventos/${eventoA}/refeicoes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'CHURRASCO' })
    })
    expect(res.status).toBe(400)
  })

  it('6.1. LANCHE -> JANTAR (rejeitado)', async () => {
    // Adicionar LANCHE
    const res1 = await req(`/api/v1/eventos/${eventoA}/refeicoes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'LANCHE' })
    })
    expect(res1.status).toBe(201)

    // Tentar adicionar JANTAR e falhar
    const res2 = await req(`/api/v1/eventos/${eventoA}/refeicoes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'JANTAR' })
    })
    expect(res2.status).toBe(400)
  })

  it('6.2. Inativar LANCHE -> JANTAR (permitido)', async () => {
    const lanche = await db.select().from(schema.eventoRefeicoes).where(
      and(eq(schema.eventoRefeicoes.eventoId, eventoA), eq(schema.eventoRefeicoes.tipo, 'LANCHE'))
    ).get()

    // inativar lanche
    await req(`/api/v1/eventos/${eventoA}/refeicoes/${lanche!.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: false })
    })

    // Agora pode adicionar jantar
    const res2 = await req(`/api/v1/eventos/${eventoA}/refeicoes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'JANTAR' })
    })
    expect(res2.status).toBe(201)

    // Tentar reativar LANCHE e falhar
    const res3 = await req(`/api/v1/eventos/${eventoA}/refeicoes/${lanche!.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: true })
    })
    expect(res3.status).toBe(400)
  })

  it('7. POST repetido ativo não duplica', async () => {
    const res = await req(`/api/v1/eventos/${eventoA}/refeicoes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'ALMOCO' })
    })
    expect(res.status).toBe(200)
    
    const dbRef = await db.select().from(schema.eventoRefeicoes).where(
      and(eq(schema.eventoRefeicoes.eventoId, eventoA), eq(schema.eventoRefeicoes.tipo, 'ALMOCO'))
    ).all()
    expect(dbRef.length).toBe(1)
  })

  let cafeId = ''

  it('8. inativar via PATCH', async () => {
    const ativas = await db.select().from(schema.eventoRefeicoes).where(
      and(eq(schema.eventoRefeicoes.eventoId, eventoA), eq(schema.eventoRefeicoes.tipo, 'CAFE_MANHA'))
    ).get()
    cafeId = ativas!.id

    const res = await req(`/api/v1/eventos/${eventoA}/refeicoes/${cafeId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: false })
    })
    expect(res.status).toBe(200)
    
    const upd = await db.select().from(schema.eventoRefeicoes).where(eq(schema.eventoRefeicoes.id, cafeId)).get()
    expect(upd!.ativo).toBe(false)
  })

  it('9. reativar preservando ID', async () => {
    const res = await req(`/api/v1/eventos/${eventoA}/refeicoes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'CAFE_MANHA' })
    })
    expect(res.status).toBe(200) // Idempotente
    const json = await res.json() as any
    expect(json.id).toBe(cafeId)
    expect(json.ativo).toBe(true)
  })

  it('10. refeição vinculada ao evento correto', async () => {
    const res = await req(`/api/v1/eventos/${eventoB}/refeicoes`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    const json = await res.json() as any
    expect(Array.isArray(json)).toBe(true)
    expect(json.length).toBe(0)
  })
})
