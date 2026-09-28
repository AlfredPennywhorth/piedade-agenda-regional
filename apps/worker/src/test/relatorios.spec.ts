import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../index'
import { setupDb } from './setup'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { regionais, administracoes, setores, casas, membros, funcoes, vinculosFuncionais, locais, eventos, convocacoes, convocacaoDestinatarios, sessoes, rsvp, checkins } from '../db/schema'
import { hashToken } from '../security/tokens'

describe('S12 - Relatórios', () => {
  let sqlite: Database.Database
  let db: any
  let app: any

  let tokenOrganizador: string
  let tokenGestorRelatorios: string
  let tokenSemAcesso: string

  let regId: string
  let admId: string
  let setId: string
  let casId: string
  let eventoId: string
  let dest1Id: string
  let dest2Id: string

  beforeAll(async () => {
    sqlite = new Database(':memory:')
    setupDb(sqlite)
    db = drizzle(sqlite)
    app = createApp(db)

    async function criarSessao(membroId: string) {
      const rawToken = crypto.randomUUID()
      const tokenHash = await hashToken(rawToken)
      await db.insert(sessoes).values({
        id: crypto.randomUUID(),
        membroId,
        tokenHash,
        expiraEm: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString()
      })
      return rawToken
    }

    regId = crypto.randomUUID()
    await db.insert(regionais).values({ id: regId, nome: 'Regional SP' })

    admId = crypto.randomUUID()
    await db.insert(administracoes).values({ id: admId, nome: 'Adm Central', regionalId: regId })

    setId = crypto.randomUUID()
    await db.insert(setores).values({ id: setId, nome: 'Setor Leste', administracaoId: admId })

    casId = crypto.randomUUID()
    await db.insert(casas).values({ id: casId, nome: 'Casa 1', setorId: setId })

    // Membro 1: Organizador
    const memOrgId = crypto.randomUUID()
    await db.insert(membros).values({ id: memOrgId, nome: 'Organizador Silva', casaId: casId, ativo: true, autenticacaoAtiva: true })
    tokenOrganizador = await criarSessao(memOrgId)

    // Membro 2: Gestor Relatórios no Setor
    const memGestorId = crypto.randomUUID()
    await db.insert(membros).values({ id: memGestorId, nome: 'Gestor Santos', casaId: casId, ativo: true, autenticacaoAtiva: true })
    tokenGestorRelatorios = await criarSessao(memGestorId)

    const funcaoGestorId = crypto.randomUUID()
    await db.insert(funcoes).values({ id: funcaoGestorId, nome: 'Gestor de Relatórios', codigo: 'GESTOR_RELATORIOS', ativo: true })
    await db.insert(vinculosFuncionais).values({
      id: crypto.randomUUID(),
      membroId: memGestorId,
      funcaoId: funcaoGestorId,
      setorId: setId,
      ativo: true
    })

    // Membro 3: Sem Acesso
    const memSemAcessoId = crypto.randomUUID()
    await db.insert(membros).values({ id: memSemAcessoId, nome: 'Membro Comum', casaId: casId, ativo: true, autenticacaoAtiva: true })
    tokenSemAcesso = await criarSessao(memSemAcessoId)

    // Membros participantes
    const p1Id = crypto.randomUUID()
    await db.insert(membros).values({ id: p1Id, nome: 'Alice Participante', celular: '11999990001', casaId: casId, ativo: true })

    const p2Id = crypto.randomUUID()
    await db.insert(membros).values({ id: p2Id, nome: 'Bruno Participante', celular: '11999990002', casaId: casId, ativo: true })

    // Evento
    const locId = crypto.randomUUID()
    await db.insert(locais).values({ id: locId, nome: 'Auditório Principal', endereco: 'Rua A', numero: '100', cidade: 'SP', uf: 'SP' })

    eventoId = crypto.randomUUID()
    await db.insert(eventos).values({
      id: eventoId,
      titulo: 'Encontro Regional S12',
      modalidade: 'PRESENCIAL',
      inicioEm: '2026-10-01T09:00:00Z',
      fimEm: '2026-10-01T17:00:00Z',
      localId: locId,
      organizadorMembroId: memOrgId,
      setorId: setId,
      ativo: true
    })

    // Convocação publicada
    const convId = crypto.randomUUID()
    await db.insert(convocacoes).values({
      id: convId,
      eventoId,
      status: 'PUBLICADA',
      publicadaEm: new Date().toISOString(),
      ativo: true
    })

    dest1Id = crypto.randomUUID()
    await db.insert(convocacaoDestinatarios).values({ id: dest1Id, convocacaoId: convId, membroId: p1Id })

    dest2Id = crypto.randomUUID()
    await db.insert(convocacaoDestinatarios).values({ id: dest2Id, convocacaoId: convId, membroId: p2Id })

    // RSVP: Alice confirma, Bruno recusa
    const nowIso = new Date().toISOString()
    await db.insert(rsvp).values({
      id: crypto.randomUUID(),
      convocacaoDestinatarioId: dest1Id,
      resposta: 'PARTICIPAREI',
      respondidoEm: nowIso,
      atualizadoEm: nowIso
    })

    await db.insert(rsvp).values({
      id: crypto.randomUUID(),
      convocacaoDestinatarioId: dest2Id,
      resposta: 'NAO_PARTICIPAREI',
      respondidoEm: nowIso,
      atualizadoEm: nowIso
    })

    // Checkin: Alice comparece
    await db.insert(checkins).values({
      id: crypto.randomUUID(),
      convocacaoDestinatarioId: dest1Id,
      eventoId,
      membroId: p1Id,
      forma: 'QR',
      operadorMembroId: memOrgId,
      dataHoraCheckin: nowIso
    })
  })

  afterAll(() => {
    sqlite.close()
  })

  it('deve negar acesso ao relatório do evento para membro sem permissão (403)', async () => {
    const res = await app.request(`/api/v1/relatorios/eventos/${eventoId}`, {
      headers: { Authorization: `Bearer ${tokenSemAcesso}` }
    })
    expect(res.status).toBe(403)
  })

  it('deve permitir acesso ao relatório do evento para o organizador', async () => {
    const res = await app.request(`/api/v1/relatorios/eventos/${eventoId}`, {
      headers: { Authorization: `Bearer ${tokenOrganizador}` }
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.totalConvocados).toBe(2)
    expect(json.totalConfirmados).toBe(1)
    expect(json.totalRecusados).toBe(1)
    expect(json.totalPresencas).toBe(1)
    expect(json.taxaPresencaConvocados).toBe(50)
  })

  it('deve permitir acesso ao relatório do evento para Gestor de Relatórios no escopo', async () => {
    const res = await app.request(`/api/v1/relatorios/eventos/${eventoId}`, {
      headers: { Authorization: `Bearer ${tokenGestorRelatorios}` }
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.totalConvocados).toBe(2)
  })

  it('deve listar a presença nominal com filtros', async () => {
    const res = await app.request(`/api/v1/relatorios/eventos/${eventoId}/presencas?statusRsvp=PARTICIPAREI`, {
      headers: { Authorization: `Bearer ${tokenGestorRelatorios}` }
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.length).toBe(1)
    expect(json[0].membroNome).toBe('Alice Participante')
    expect(json[0].presente).toBe(true)
    expect(json[0].formaCheckin).toBe('QR')
  })

  it('deve retornar relatório agregado para o escopo do gestor', async () => {
    const res = await app.request(`/api/v1/relatorios/agregado?escopoTipo=SETOR&escopoId=${setId}`, {
      headers: { Authorization: `Bearer ${tokenGestorRelatorios}` }
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.totalEventos).toBe(1)
    expect(json.totalConvocados).toBe(2)
    expect(json.totalPresencas).toBe(1)
  })
})
