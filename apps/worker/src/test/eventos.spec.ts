import { describe, it, expect, beforeEach } from 'vitest'
import { Database } from 'better-sqlite3'
import { setupDb } from './setup'
import { createApp } from '../index'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import BetterSqlite3 from 'better-sqlite3'
import { regionais, locais } from '../db/schema'

describe('Eventos API (S04)', () => {
  let sqlite: Database
  let db: any
  let app: any

  beforeEach(() => {
    sqlite = new BetterSqlite3(':memory:')
    // A constraint check_evento_escopo_unico must be enabled in sqlite
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    db = drizzle(sqlite)
    app = createApp(db)
  })

  async function createRegional() {
    const id = crypto.randomUUID()
    await db.insert(regionais).values({ id, nome: 'Regional Teste' }).run()
    return id
  }

  async function createLocal() {
    const id = crypto.randomUUID()
    await db.insert(locais).values({
      id, nome: 'Local', endereco: 'End', numero: '1', cidade: 'SP', uf: 'SP'
    }).run()
    return id
  }

  const validDate1 = '2026-09-10T10:00:00Z'
  const validDate2 = '2026-09-10T12:00:00Z'
  const validDateNextDay = '2026-09-11T10:00:00Z'

  it('6. criar PRESENCIAL com local', async () => {
    const regionalId = await createRegional()
    const localId = await createLocal()

    const res = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento 1',
        modalidade: 'PRESENCIAL',
        inicioEm: validDate1,
        fimEm: validDate2,
        localId: localId,
        regionalId: regionalId
      })
    })
    expect(res.status).toBe(201)
  })

  it('7. rejeitar PRESENCIAL sem local', async () => {
    const regionalId = await createRegional()
    const res = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento 2',
        modalidade: 'PRESENCIAL',
        inicioEm: validDate1,
        fimEm: validDate2,
        regionalId: regionalId
      })
    })
    expect(res.status).toBe(400)
  })

  it('8. criar ONLINE com URL', async () => {
    const regionalId = await createRegional()
    const res = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento Online',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
        regionalId: regionalId
      })
    })
    expect(res.status).toBe(201)
  })

  it('9. rejeitar ONLINE sem URL', async () => {
    const regionalId = await createRegional()
    const res = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento Online',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        regionalId: regionalId
      })
    })
    expect(res.status).toBe(400)
  })

  it('10. rejeitar ONLINE com local', async () => {
    const regionalId = await createRegional()
    const localId = await createLocal()
    const res = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento Online',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
        localId: localId,
        regionalId: regionalId
      })
    })
    expect(res.status).toBe(400)
  })

  it('11. criar HIBRIDO com local + URL', async () => {
    const regionalId = await createRegional()
    const localId = await createLocal()
    const res = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento Hibrido',
        modalidade: 'HIBRIDO',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
        localId: localId,
        regionalId: regionalId
      })
    })
    expect(res.status).toBe(201)
  })

  it('12. rejeitar HIBRIDO sem um dos dois', async () => {
    const regionalId = await createRegional()
    const res = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento Hibrido',
        modalidade: 'HIBRIDO',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
        regionalId: regionalId
      })
    })
    expect(res.status).toBe(400) // Missing localId
  })

  it('13. rejeitar fim <= início', async () => {
    const regionalId = await createRegional()
    const res = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento Hibrido',
        modalidade: 'ONLINE',
        inicioEm: validDate2,
        fimEm: validDate1, // fim antes do inicio
        urlOnline: 'https://meet.google.com/abc',
        regionalId: regionalId
      })
    })
    expect(res.status).toBe(400)
  })

  it('14. rejeitar evento sem escopo', async () => {
    const res = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento Hibrido',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
      })
    })
    expect(res.status).toBe(400)
  })

  it('15. rejeitar evento com mais de um escopo', async () => {
    const regionalId = await createRegional()
    const res = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento Hibrido',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
        regionalId: regionalId,
        administracaoId: crypto.randomUUID() // Two scopes
      })
    })
    expect(res.status).toBe(400)
  })

  it('16. criar evento de Regional', async () => {
    const regionalId = await createRegional()
    const res = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
        regionalId: regionalId
      })
    })
    expect(res.status).toBe(201)
  })

  it('21. atualizar evento', async () => {
    const regionalId = await createRegional()
    const createRes = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
        regionalId: regionalId
      })
    })
    const { id } = await createRes.json()

    const res = await app.request(`/api/v1/eventos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: 'Evento Atualizado' })
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.titulo).toBe('Evento Atualizado')
  })

  it('22. inativar evento', async () => {
    const regionalId = await createRegional()
    const createRes = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
        regionalId: regionalId
      })
    })
    const { id } = await createRes.json()

    const res = await app.request(`/api/v1/eventos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: false })
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ativo).toBe(false)
  })

  it('23. buscar evento inexistente -> 404', async () => {
    const res = await app.request(`/api/v1/eventos/00000000-0000-0000-0000-000000000000`)
    expect(res.status).toBe(404)
  })

  it('Rejeitar evento em dias diferentes no fuso de SP', async () => {
    const regionalId = await createRegional()
    const res = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento Hibrido',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDateNextDay,
        urlOnline: 'https://meet.google.com/abc',
        regionalId: regionalId
      })
    })
    expect(res.status).toBe(400)
  })

  it('24. constraint de escopo único direto no banco', () => {
    // We try to insert an event with two scopes using drizzle directly, 
    // it should fail due to sqlite CHECK constraint
    expect(async () => {
      await db.insert(eventos).values({
        id: crypto.randomUUID(),
        titulo: 'Evento DB',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        regionalId: crypto.randomUUID(),
        administracaoId: crypto.randomUUID()
      }).run()
    }).rejects.toThrow(/CHECK constraint failed: check_evento_escopo_unico/)
  })

  // =========================================================================
  // PATCH REGRESSION TESTS (S04 Corrreções)
  // =========================================================================
  it('a) PRESENCIAL -> ONLINE sem urlOnline deve falhar no PATCH', async () => {
    const regionalId = await createRegional()
    const localId = await createLocal()

    const createRes = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Patch Test',
        modalidade: 'PRESENCIAL',
        inicioEm: validDate1,
        fimEm: validDate2,
        localId,
        regionalId
      })
    })
    const { id } = await createRes.json()

    const patchRes = await app.request(`/api/v1/eventos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modalidade: 'ONLINE' }) // Misses urlOnline
    })
    expect(patchRes.status).toBe(400)
  })

  it('b) ONLINE -> HIBRIDO sem localId deve falhar no PATCH', async () => {
    const regionalId = await createRegional()

    const createRes = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Patch Test',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
        regionalId
      })
    })
    const { id } = await createRes.json()

    const patchRes = await app.request(`/api/v1/eventos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modalidade: 'HIBRIDO' }) // Misses localId
    })
    expect(patchRes.status).toBe(400)
  })

  it('c) alterar apenas fimEm para horário anterior ao inicioEm deve falhar', async () => {
    const regionalId = await createRegional()

    const createRes = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Patch Test',
        modalidade: 'ONLINE',
        inicioEm: validDate2,
        fimEm: '2026-09-10T14:00:00Z',
        urlOnline: 'https://meet.google.com/abc',
        regionalId
      })
    })
    const { id } = await createRes.json()

    const patchRes = await app.request(`/api/v1/eventos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fimEm: validDate1 }) // validDate1 is BEFORE validDate2
    })
    expect(patchRes.status).toBe(400)
  })

  it('d) PATCH que introduza segundo escopo deve falhar', async () => {
    const regionalId = await createRegional()

    const createRes = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Patch Test',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
        regionalId
      })
    })
    const { id } = await createRes.json()

    const patchRes = await app.request(`/api/v1/eventos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ administracaoId: crypto.randomUUID() }) // Introduces a second scope
    })
    expect(patchRes.status).toBe(400)
  })

  it('e) PATCH válido deve continuar funcionando', async () => {
    const regionalId = await createRegional()

    const createRes = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Patch Test',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
        regionalId
      })
    })
    const { id } = await createRes.json()

    const patchRes = await app.request(`/api/v1/eventos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pauta: 'Nova pauta test' }) 
    })
    expect(patchRes.status).toBe(200)
  })

  // =========================================================================
  // URL PROTOCOL TESTS (S04 Corrreções)
  // =========================================================================
  it('URL https válida', async () => {
    const regionalId = await createRegional()
    const res = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento Online HTTPS',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
        regionalId
      })
    })
    expect(res.status).toBe(201)
  })

  it('URL http válida', async () => {
    const regionalId = await createRegional()
    const res = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento Online HTTP',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'http://meet.google.com/abc',
        regionalId
      })
    })
    expect(res.status).toBe(201)
  })

  it('URL ftp inválida', async () => {
    const regionalId = await createRegional()
    const res = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento Online FTP',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'ftp://meet.google.com/abc',
        regionalId
      })
    })
    expect(res.status).toBe(400)
  })
})
