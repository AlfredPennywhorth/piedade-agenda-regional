import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../index'
import { setupDb } from './setup'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { regionais, administracoes, setores, casas, membros, funcoes, vinculosFuncionais, locais, eventos, convocacoes, convocacaoDestinatarios, sessoes, rsvp, checkins } from '../db/schema'
import { hashToken } from '../security/tokens'

describe('S11 - Portaria e Check-in', () => {
  let sqlite: Database.Database
  let db: any
  let app: any

  beforeAll(() => {
    sqlite = new Database(':memory:')
    setupDb(sqlite)
    db = drizzle(sqlite)
    app = createApp(db)
  })

  afterAll(() => {
    sqlite.close()
  })

  async function criarSessao(membroId: string) {
    const rawToken = crypto.randomUUID()
    const tokenHash = await hashToken(rawToken)
    const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    await db.insert(sessoes).values({
      id: crypto.randomUUID(),
      membroId,
      tokenHash,
      expiraEm,
      createdAt: new Date().toISOString()
    })

    return rawToken
  }

  async function setupBaseData() {
    const regId = crypto.randomUUID()
    await db.insert(regionais).values({ id: regId, nome: 'Regional SP' })

    const admId = crypto.randomUUID()
    await db.insert(administracoes).values({ id: admId, nome: 'Adm Central', regionalId: regId })

    const setId = crypto.randomUUID()
    await db.insert(setores).values({ id: setId, nome: 'Setor Norte', administracaoId: admId })

    const casId = crypto.randomUUID()
    await db.insert(casas).values({ id: casId, nome: 'Casa Central', setorId: setId })

    // Membro 1: Participante Convocado
    const mem1Id = crypto.randomUUID()
    await db.insert(membros).values({ id: mem1Id, nome: 'João Participante', casaId: casId, ativo: true, autenticacaoAtiva: true })
    const tokenMem1 = await criarSessao(mem1Id)

    // Membro 2: Participante 2
    const mem2Id = crypto.randomUUID()
    await db.insert(membros).values({ id: mem2Id, nome: 'Maria Convocada', casaId: casId, ativo: true, autenticacaoAtiva: true })

    // Membro 3: Operador Autorizado no Setor
    const memOperadorId = crypto.randomUUID()
    await db.insert(membros).values({ id: memOperadorId, nome: 'Pedro Portaria', casaId: casId, ativo: true, autenticacaoAtiva: true })
    const tokenOperador = await criarSessao(memOperadorId)

    // Membro 4: Membro Comum Sem Operador Portaria
    const memComumId = crypto.randomUUID()
    await db.insert(membros).values({ id: memComumId, nome: 'Ana Comum', casaId: casId, ativo: true, autenticacaoAtiva: true })
    const tokenComum = await criarSessao(memComumId)

    // Membro 5: Operador Portaria em outro escopo (outra regional)
    const regOutraId = crypto.randomUUID()
    await db.insert(regionais).values({ id: regOutraId, nome: 'Regional RJ' })
    const memOperadorOutroId = crypto.randomUUID()
    await db.insert(membros).values({ id: memOperadorOutroId, nome: 'Carlos Portaria RJ', casaId: casId, ativo: true, autenticacaoAtiva: true })
    const tokenOperadorOutro = await criarSessao(memOperadorOutroId)

    // Membro 6: Organizador do evento (sem OPERADOR_PORTARIA)
    const memOrganizadorId = crypto.randomUUID()
    await db.insert(membros).values({ id: memOrganizadorId, nome: 'Lucas Organizador', casaId: casId, ativo: true, autenticacaoAtiva: true })
    const tokenOrganizador = await criarSessao(memOrganizadorId)

    // Função OPERADOR_PORTARIA
    const funcaoPortariaId = crypto.randomUUID()
    await db.insert(funcoes).values({ id: funcaoPortariaId, nome: 'Operador de Portaria', codigo: 'OPERADOR_PORTARIA', ativo: true })

    // Vínculo do operador autorizado no Setor
    await db.insert(vinculosFuncionais).values({
      id: crypto.randomUUID(),
      membroId: memOperadorId,
      funcaoId: funcaoPortariaId,
      setorId: setId,
      ativo: true
    })

    // Vínculo do operador do RJ na outra Regional
    await db.insert(vinculosFuncionais).values({
      id: crypto.randomUUID(),
      membroId: memOperadorOutroId,
      funcaoId: funcaoPortariaId,
      regionalId: regOutraId,
      ativo: true
    })

    // Local & Evento no Setor
    const locId = crypto.randomUUID()
    await db.insert(locais).values({ id: locId, nome: 'Local Principal', endereco: 'Rua A', numero: '100', cidade: 'SP', uf: 'SP' })

    const evId = crypto.randomUUID()
    await db.insert(eventos).values({
      id: evId,
      titulo: 'Encontro Setorial S11',
      modalidade: 'PRESENCIAL',
      inicioEm: '2026-10-01T09:00:00Z',
      fimEm: '2026-10-01T17:00:00Z',
      setorId: setId,
      organizadorMembroId: memOrganizadorId,
      localId: locId,
      ativo: true
    })

    // Convocação PUBLICADA
    const convId = crypto.randomUUID()
    await db.insert(convocacoes).values({
      id: convId,
      eventoId: evId,
      status: 'PUBLICADA',
      publicadaEm: '2026-09-01T10:00:00Z',
      ativo: true
    })

    // Destinatários da Convocação
    const dest1Id = crypto.randomUUID()
    await db.insert(convocacaoDestinatarios).values({
      id: dest1Id,
      convocacaoId: convId,
      membroId: mem1Id
    })

    const dest2Id = crypto.randomUUID()
    await db.insert(convocacaoDestinatarios).values({
      id: dest2Id,
      convocacaoId: convId,
      membroId: mem2Id
    })

    // Convocação RASCUNHO (para testes de validação)
    const evRascunhoId = crypto.randomUUID()
    await db.insert(eventos).values({
      id: evRascunhoId,
      titulo: 'Evento Rascunho',
      modalidade: 'PRESENCIAL',
      inicioEm: '2026-10-05T09:00:00Z',
      fimEm: '2026-10-05T17:00:00Z',
      setorId: setId,
      ativo: true
    })

    const convRascunhoId = crypto.randomUUID()
    await db.insert(convocacoes).values({
      id: convRascunhoId,
      eventoId: evRascunhoId,
      status: 'RASCUNHO',
      ativo: true
    })

    const destRascunhoId = crypto.randomUUID()
    await db.insert(convocacaoDestinatarios).values({
      id: destRascunhoId,
      convocacaoId: convRascunhoId,
      membroId: mem1Id
    })

    return {
      regId, setId, casId, evId, convId,
      mem1Id, tokenMem1, dest1Id,
      mem2Id, dest2Id,
      memOperadorId, tokenOperador,
      memComumId, tokenComum,
      tokenOperadorOutro,
      tokenOrganizador,
      destRascunhoId
    }
  }

  it('1. Deve negar acesso 401 para requisição sem token de autenticação', async () => {
    const ctx = await setupBaseData()
    const res = await app.request('/api/v1/checkin/qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrToken: ctx.dest1Id })
    })
    expect(res.status).toBe(401)
  })

  it('2. Deve negar 403 para membro comum autenticado sem função OPERADOR_PORTARIA', async () => {
    const ctx = await setupBaseData()
    const res = await app.request('/api/v1/checkin/qr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ctx.tokenComum}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ qrToken: ctx.dest1Id })
    })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe('FORBIDDEN')
  })

  it('3. Deve negar 403 para organizador do evento que NÃO possui OPERADOR_PORTARIA', async () => {
    const ctx = await setupBaseData()
    const res = await app.request('/api/v1/checkin/qr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ctx.tokenOrganizador}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ qrToken: ctx.dest1Id })
    })
    expect(res.status).toBe(403)
  })

  it('4. Deve negar 403 para operador de portaria de OUTRO escopo (Regional diferente)', async () => {
    const ctx = await setupBaseData()
    const res = await app.request('/api/v1/checkin/qr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ctx.tokenOperadorOutro}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ qrToken: ctx.dest1Id })
    })
    expect(res.status).toBe(403)
  })

  it('5. Deve registrar check-in QR com sucesso por operador autorizado no escopo correto', async () => {
    const ctx = await setupBaseData()
    const res = await app.request('/api/v1/checkin/qr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ctx.tokenOperador}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ qrToken: ctx.dest1Id })
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.forma).toBe('QR')
    expect(json.convocacaoDestinatarioId).toBe(ctx.dest1Id)
    expect(json.membroId).toBe(ctx.mem1Id)
    expect(json.eventoId).toBe(ctx.evId)
    expect(json.operadorMembroId).toBe(ctx.memOperadorId)
  })

  it('6. Segunda tentativa de check-in para a mesma pessoa/evento deve retornar 409 e não duplicar', async () => {
    const ctx = await setupBaseData()

    // 1º Check-in
    await app.request('/api/v1/checkin/qr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ctx.tokenOperador}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ qrToken: ctx.dest1Id })
    })

    // 2º Check-in (mesmo destinatário/pessoa/evento)
    const res2 = await app.request('/api/v1/checkin/qr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ctx.tokenOperador}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ qrToken: ctx.dest1Id })
    })

    expect(res2.status).toBe(409)
    const json = await res2.json()
    expect(json.jaRegistrado).toBe(true)
    expect(json.checkin).toBeDefined()
  })

  it('7. Deve registrar check-in MANUAL com sucesso', async () => {
    const ctx = await setupBaseData()
    const res = await app.request('/api/v1/checkin/manual', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ctx.tokenOperador}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ convocacaoDestinatarioId: ctx.dest2Id })
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.forma).toBe('MANUAL')
    expect(json.membroId).toBe(ctx.mem2Id)
  })

  it('8. Permite check-in de membro Sem RSVP, com NAO_SEI ou NAO_PARTICIPAREI', async () => {
    const ctx = await setupBaseData()

    // Membro 2 insere RSVP NAO_PARTICIPAREI
    await db.insert(rsvp).values({
      id: crypto.randomUUID(),
      convocacaoDestinatarioId: ctx.dest2Id,
      resposta: 'NAO_PARTICIPAREI',
      justificativa: 'Imprevisto',
      respondidoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    })

    // Mesmo com NAO_PARTICIPAREI, o check-in na portaria deve ser permitido
    const res = await app.request('/api/v1/checkin/manual', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ctx.tokenOperador}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ convocacaoDestinatarioId: ctx.dest2Id })
    })
    expect(res.status).toBe(201)
  })

  it('9. Deve rejeitar check-in para destinatário cuja convocação está em RASCUNHO (400 Bad Request)', async () => {
    const ctx = await setupBaseData()
    const res = await app.request('/api/v1/checkin/qr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ctx.tokenOperador}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ qrToken: ctx.destRascunhoId })
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('não está publicada')
  })

  it('10. Deve retornar 404 para QR token/destinatário inexistente', async () => {
    const ctx = await setupBaseData()
    const res = await app.request('/api/v1/checkin/qr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ctx.tokenOperador}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ qrToken: crypto.randomUUID() })
    })
    expect(res.status).toBe(404)
  })

  it('11. O próprio participante pode consultar sua presença', async () => {
    const ctx = await setupBaseData()

    // Realiza o check-in primeiro
    await app.request('/api/v1/checkin/qr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ctx.tokenOperador}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ qrToken: ctx.dest1Id })
    })

    // O participante (tokenMem1) consulta seu próprio destinatário (dest1Id)
    const res = await app.request(`/api/v1/checkin/destinatarios/${ctx.dest1Id}/presenca`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${ctx.tokenMem1}` }
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.possuiPresenca).toBe(true)
    expect(json.checkin.forma).toBe('QR')
  })

  it('12. Membro comum NÃO pode consultar presença de outro membro (403 Forbidden)', async () => {
    const ctx = await setupBaseData()
    // Membro Comum (tokenComum) tenta consultar a presença do destinatario 1 (João)
    const res = await app.request(`/api/v1/checkin/destinatarios/${ctx.dest1Id}/presenca`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${ctx.tokenComum}` }
    })
    expect(res.status).toBe(403)
  })

  it('13. Operador de portaria autorizado pode consultar a presença de qualquer participante', async () => {
    const ctx = await setupBaseData()
    const res = await app.request(`/api/v1/checkin/destinatarios/${ctx.dest1Id}/presenca`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${ctx.tokenOperador}` }
    })
    expect(res.status).toBe(200)
  })

  it('14. Operador de portaria pode listar participantes do evento desduplicados', async () => {
    const ctx = await setupBaseData()
    const res = await app.request(`/api/v1/portaria/eventos/${ctx.evId}/participantes`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${ctx.tokenOperador}` }
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.totalParticipantes).toBe(2)
    expect(json.participantes.length).toBe(2)
  })
})
