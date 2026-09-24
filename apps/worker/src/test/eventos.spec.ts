import { describe, it, expect, beforeEach } from 'vitest'
import { Database } from 'better-sqlite3'
import { setupDb } from './setup'
import { createApp } from '../index'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import BetterSqlite3 from 'better-sqlite3'
import { regionais, locais, eventos, administracoes, setores, casas, gruposTrabalho, membros, sessoes, auditoriaLogs } from '../db/schema'
import { hashToken } from '../security/tokens'
import { eq } from 'drizzle-orm'

describe('Eventos API (S04)', () => {
  let sqlite: Database
  let db: any
  let app: any
  let token: string

  beforeEach(async () => {
    sqlite = new BetterSqlite3(':memory:')
    // A constraint check_evento_escopo_unico must be enabled in sqlite
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    db = drizzle(sqlite)
    app = createApp(db)

    const regId = crypto.randomUUID()
    const admId = crypto.randomUUID()
    const setId = crypto.randomUUID()
    const casId = crypto.randomUUID()
    const memId = crypto.randomUUID()
    await db.insert(regionais).values({ id: regId, nome: 'Reg' })
    await db.insert(administracoes).values({ id: admId, nome: 'Adm', regionalId: regId })
    await db.insert(setores).values({ id: setId, nome: 'Set', administracaoId: admId })
    await db.insert(casas).values({ id: casId, nome: 'Cas', setorId: setId })
    await db.insert(membros).values({ id: memId, nome: 'Mem Test', casaId: casId, ativo: true, autenticacaoAtiva: true })
    const contaId = crypto.randomUUID()
    sqlite.prepare(
      'INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES (?, ?, \'ATIVA\', CURRENT_TIMESTAMP)'
    ).run(contaId, memId)
    sqlite.prepare(
      'INSERT INTO acessos_conta (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id) VALUES (?, ?, \'MASTER_SISTEMA\', \'GLOBAL\', NULL)'
    ).run(crypto.randomUUID(), contaId)

    const rawToken = crypto.randomUUID()
    const tokenHash = await hashToken(rawToken)
    await db.insert(sessoes).values({
      id: crypto.randomUUID(),
      membroId: memId,
      tokenHash,
      expiraEm: new Date(Date.now() + 86400000).toISOString(),
      createdAt: new Date().toISOString()
    })
    token = rawToken
  })

  function req(path: string, options: any = {}) {
    const headers = {
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
    return app.request(path, { ...options, headers })
  }

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

    const res = await req('/api/v1/eventos', {
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
    const res = await req('/api/v1/eventos', {
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
    const res = await req('/api/v1/eventos', {
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
    const res = await req('/api/v1/eventos', {
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
    const res = await req('/api/v1/eventos', {
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
    const res = await req('/api/v1/eventos', {
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
    const res = await req('/api/v1/eventos', {
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
    const res = await req('/api/v1/eventos', {
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
    const res = await req('/api/v1/eventos', {
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
    const res = await req('/api/v1/eventos', {
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
    const res = await req('/api/v1/eventos', {
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
    const createRes = await req('/api/v1/eventos', {
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

    const res = await req(`/api/v1/eventos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: 'Evento Atualizado' })
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.titulo).toBe('Evento Atualizado')
  })

  it('21.1 audita atualização no escopo final do Evento', async () => {
    const regionalOrigem = await createRegional()
    const regionalDestino = await createRegional()
    const createRes = await req('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento Movido',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
        regionalId: regionalOrigem
      })
    })
    const { id } = await createRes.json()

    const patchRes = await req(`/api/v1/eventos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regionalId: regionalDestino })
    })
    expect(patchRes.status).toBe(200)

    const logs = await db.select().from(auditoriaLogs)
      .where(eq(auditoriaLogs.recursoId, id))
      .all()
    const atualizado = logs.find((item: any) => item.acao === 'EVENTO_ATUALIZADO')
    expect(atualizado?.escopoTipo).toBe('REGIONAL')
    expect(atualizado?.escopoId).toBe(regionalDestino)
  })

  it('22. inativar evento', async () => {
    const regionalId = await createRegional()
    const createRes = await req('/api/v1/eventos', {
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

    const res = await req(`/api/v1/eventos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: false })
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ativo).toBe(false)
  })

  it('23. buscar evento inexistente -> 404', async () => {
    const res = await req(`/api/v1/eventos/00000000-0000-0000-0000-000000000000`)
    expect(res.status).toBe(404)
  })

  it('Rejeitar evento em dias diferentes no fuso de SP', async () => {
    const regionalId = await createRegional()
    const res = await req('/api/v1/eventos', {
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
    expect(() => {
      db.insert(eventos).values({
        id: crypto.randomUUID(),
        titulo: 'Evento DB',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        regionalId: crypto.randomUUID(),
        administracaoId: crypto.randomUUID()
      }).run()
    }).toThrow(/CHECK constraint failed: check_evento_escopo_unico/)
  })

  // =========================================================================
  // PATCH REGRESSION TESTS (S04 Corrreções)
  // =========================================================================
  it('a) PRESENCIAL -> ONLINE sem urlOnline deve falhar no PATCH', async () => {
    const regionalId = await createRegional()
    const localId = await createLocal()

    const createRes = await req('/api/v1/eventos', {
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

    const patchRes = await req(`/api/v1/eventos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modalidade: 'ONLINE' }) // Misses urlOnline
    })
    expect(patchRes.status).toBe(400)
  })

  it('b) ONLINE -> HIBRIDO sem localId deve falhar no PATCH', async () => {
    const regionalId = await createRegional()

    const createRes = await req('/api/v1/eventos', {
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

    const patchRes = await req(`/api/v1/eventos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modalidade: 'HIBRIDO' }) // Misses localId
    })
    expect(patchRes.status).toBe(400)
  })

  it('c) alterar apenas fimEm para horário anterior ao inicioEm deve falhar', async () => {
    const regionalId = await createRegional()

    const createRes = await req('/api/v1/eventos', {
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

    const patchRes = await req(`/api/v1/eventos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fimEm: validDate1 }) // validDate1 is BEFORE validDate2
    })
    expect(patchRes.status).toBe(400)
  })

  it('d) PATCH que introduza segundo escopo deve falhar', async () => {
    const regionalId = await createRegional()

    const createRes = await req('/api/v1/eventos', {
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

    const patchRes = await req(`/api/v1/eventos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ administracaoId: crypto.randomUUID() }) // Introduces a second scope
    })
    expect(patchRes.status).toBe(400)
  })

  it('e) PATCH válido deve continuar funcionando', async () => {
    const regionalId = await createRegional()

    const createRes = await req('/api/v1/eventos', {
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

    const patchRes = await req(`/api/v1/eventos/${id}`, {
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
    const res = await req('/api/v1/eventos', {
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
    const res = await req('/api/v1/eventos', {
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
    const res = await req('/api/v1/eventos', {
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

  // =========================================================================
  // SCOPE TESTS (S04)
  // =========================================================================
  it('17. criar evento de Administração', async () => {
    const regionalId = await createRegional()
    const administracaoId = crypto.randomUUID()
    await db.insert(administracoes).values({ id: administracaoId, nome: 'Adm', regionalId }).run()

    const res = await req('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento Adm',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
        administracaoId
      })
    })
    expect(res.status).toBe(201)
  })

  it('18. criar evento de Setor', async () => {
    const regionalId = await createRegional()
    const administracaoId = crypto.randomUUID()
    await db.insert(administracoes).values({ id: administracaoId, nome: 'Adm', regionalId }).run()
    const setorId = crypto.randomUUID()
    await db.insert(setores).values({ id: setorId, nome: 'Setor', administracaoId }).run()

    const res = await req('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento Setor',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
        setorId
      })
    })
    expect(res.status).toBe(201)
  })

  it('19. criar evento de Casa', async () => {
    const regionalId = await createRegional()
    const administracaoId = crypto.randomUUID()
    await db.insert(administracoes).values({ id: administracaoId, nome: 'Adm', regionalId }).run()
    const setorId = crypto.randomUUID()
    await db.insert(setores).values({ id: setorId, nome: 'Setor', administracaoId }).run()
    const casaId = crypto.randomUUID()
    await db.insert(casas).values({ id: casaId, nome: 'Casa', setorId }).run()

    const res = await req('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento Casa',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
        casaId
      })
    })
    expect(res.status).toBe(201)
  })

  it('20. criar evento de Grupo de Trabalho', async () => {
    const regionalId = await createRegional()
    const grupoTrabalhoId = crypto.randomUUID()
    await db.insert(gruposTrabalho).values({ id: grupoTrabalhoId, nome: 'GT', regionalId }).run()

    const res = await req('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento GT',
        modalidade: 'ONLINE',
        inicioEm: validDate1,
        fimEm: validDate2,
        urlOnline: 'https://meet.google.com/abc',
        grupoTrabalhoId
      })
    })
    expect(res.status).toBe(201)
  })
})
