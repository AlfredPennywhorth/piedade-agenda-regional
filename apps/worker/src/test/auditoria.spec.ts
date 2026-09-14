import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../index'
import { setupDb } from './setup'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import {
  regionais,
  administracoes,
  setores,
  casas,
  membros,
  funcoes,
  vinculosFuncionais,
  eventos,
  convocacoes,
  convocacaoDestinatarios,
  rsvp,
  checkins,
  sessoes,
  auditoriaLogs
} from '../db/schema'
import { hashToken } from '../security/tokens'
import { eq } from 'drizzle-orm'
import { executarOperacaoComAudit, criarAuditQuery } from '../services/auditoria'
import { obterEscoposAutorizadosDoAuditor } from '../security/permissoes'
import { executeAtomic } from '../db/batch'

describe('S12 - Auditoria, Anti-Spoofing, Escopos e Fail-Closed', () => {
  let sqlite: any
  let db: any
  let app: any

  // Escopos da Árvore A
  let regAId: string
  let admAId: string
  let setAId: string
  let casAId: string

  // Escopos da Árvore B
  let regBId: string
  let admBId: string

  // Membros
  let memAuditorRegAId: string
  let memAuditorAdmAId: string
  let memAuditorRegBId: string
  let memComumId: string
  let memOperadorId: string

  // Tokens
  let tokenAuditorRegA: string
  let tokenAuditorAdmA: string
  let tokenMembroComum: string

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

    // Região A, Adm A, Setor A, Casa A
    regAId = crypto.randomUUID()
    await db.insert(regionais).values({ id: regAId, nome: 'Regional A' })

    admAId = crypto.randomUUID()
    await db.insert(administracoes).values({ id: admAId, nome: 'Adm A', regionalId: regAId })

    setAId = crypto.randomUUID()
    await db.insert(setores).values({ id: setAId, nome: 'Setor A', administracaoId: admAId })

    casAId = crypto.randomUUID()
    await db.insert(casas).values({ id: casAId, nome: 'Casa A', setorId: setAId })

    // Região B, Adm B
    regBId = crypto.randomUUID()
    await db.insert(regionais).values({ id: regBId, nome: 'Regional B' })

    admBId = crypto.randomUUID()
    await db.insert(administracoes).values({ id: admBId, nome: 'Adm B', regionalId: regBId })

    // Funções de Sistema (DEVEM SER INSERIDAS ANTES DOS VÍNCULOS FUNCIONAIS)
    const funcaoAuditorId = crypto.randomUUID()
    await db.insert(funcoes).values({ id: funcaoAuditorId, nome: 'Auditor do Sistema', codigo: 'AUDITOR_SISTEMA', ativo: true })

    const funcaoOperadorId = crypto.randomUUID()
    await db.insert(funcoes).values({ id: funcaoOperadorId, nome: 'Operador de Portaria', codigo: 'OPERADOR_PORTARIA', ativo: true })

    // Membro 1: Auditor Regional A
    memAuditorRegAId = crypto.randomUUID()
    await db.insert(membros).values({ id: memAuditorRegAId, nome: 'Auditor Reg A', casaId: casAId, ativo: true, autenticacaoAtiva: true })
    tokenAuditorRegA = await criarSessao(memAuditorRegAId)
    await db.insert(vinculosFuncionais).values({
      id: crypto.randomUUID(),
      membroId: memAuditorRegAId,
      funcaoId: funcaoAuditorId,
      regionalId: regAId,
      ativo: true
    })

    // Membro 2: Auditor Adm A
    memAuditorAdmAId = crypto.randomUUID()
    await db.insert(membros).values({ id: memAuditorAdmAId, nome: 'Auditor Adm A', casaId: casAId, ativo: true, autenticacaoAtiva: true })
    tokenAuditorAdmA = await criarSessao(memAuditorAdmAId)
    await db.insert(vinculosFuncionais).values({
      id: crypto.randomUUID(),
      membroId: memAuditorAdmAId,
      funcaoId: funcaoAuditorId,
      administracaoId: admAId,
      ativo: true
    })

    // Membro 3: Auditor Regional B
    memAuditorRegBId = crypto.randomUUID()
    await db.insert(membros).values({ id: memAuditorRegBId, nome: 'Auditor Reg B', casaId: casAId, ativo: true, autenticacaoAtiva: true })
    await criarSessao(memAuditorRegBId)
    await db.insert(vinculosFuncionais).values({
      id: crypto.randomUUID(),
      membroId: memAuditorRegBId,
      funcaoId: funcaoAuditorId,
      regionalId: regBId,
      ativo: true
    })

    // Membro 4: Membro Comum
    memComumId = crypto.randomUUID()
    await db.insert(membros).values({ id: memComumId, nome: 'Membro Comum', casaId: casAId, ativo: true, autenticacaoAtiva: true })
    tokenMembroComum = await criarSessao(memComumId)

    // Membro 5: Operador Portaria
    memOperadorId = crypto.randomUUID()
    await db.insert(membros).values({ id: memOperadorId, nome: 'Operador Portaria', casaId: casAId, ativo: true, autenticacaoAtiva: true })
    await criarSessao(memOperadorId)
    await db.insert(vinculosFuncionais).values({
      id: crypto.randomUUID(),
      membroId: memOperadorId,
      funcaoId: funcaoOperadorId,
      regionalId: regAId,
      ativo: true
    })
  })

  afterAll(() => {
    if (sqlite && typeof sqlite.close === 'function') {
      sqlite.close()
    }
  })

  // =========================================================================
  // 1. ISOLAMENTO DE ESCOPOS DA AUDITORIA (7 TESTES MANDATÓRIOS DO PMO)
  // =========================================================================
  describe('Isolamento de Escopos na Consulta de Auditoria', () => {
    it('1. Deve rejeitar acesso à auditoria para membro sem AUDITOR_SISTEMA (403)', async () => {
      const res = await app.request('/api/v1/auditoria', {
        headers: { Authorization: `Bearer ${tokenMembroComum}` }
      })
      expect(res.status).toBe(403)
    })

    it('2. Auditor Regional A NÃO deve ver logs da Regional B', async () => {
      const esc = await obterEscoposAutorizadosDoAuditor(db, memAuditorRegAId)
      console.log('TEST 2 DIRECT CALL TO obterEscoposAutorizadosDoAuditor:', esc)
      const logBId = crypto.randomUUID()
      await db.insert(auditoriaLogs).values({
        id: logBId,
        acao: 'EVENTO_CRIADO',
        atorMembroId: memAuditorRegBId,
        recursoTipo: 'EVENTO',
        recursoId: crypto.randomUUID(),
        escopoTipo: 'REGIONAL',
        escopoId: regBId,
        criadoEm: new Date().toISOString()
      })

      const res = await app.request('/api/v1/auditoria', {
        headers: { Authorization: `Bearer ${tokenAuditorRegA}` }
      })
      expect(res.status).toBe(200)
      const json = await res.json()
      const encontrouB = json.items.some((item: any) => item.id === logBId)
      expect(encontrouB).toBe(false)
    })

    it('3. Auditor Administração A NÃO deve ver logs da Administração B', async () => {
      const logAdmBId = crypto.randomUUID()
      await db.insert(auditoriaLogs).values({
        id: logAdmBId,
        acao: 'EVENTO_CRIADO',
        atorMembroId: memAuditorRegBId,
        recursoTipo: 'EVENTO',
        recursoId: crypto.randomUUID(),
        escopoTipo: 'ADMINISTRACAO',
        escopoId: admBId,
        criadoEm: new Date().toISOString()
      })

      const res = await app.request('/api/v1/auditoria', {
        headers: { Authorization: `Bearer ${tokenAuditorAdmA}` }
      })
      expect(res.status).toBe(200)
      const json = await res.json()
      const encontrouAdmB = json.items.some((item: any) => item.id === logAdmBId)
      expect(encontrouAdmB).toBe(false)
    })

    it('4. Auditor Administração A DEVE ler logs de sua própria Administração A', async () => {
      const logAdmAId = crypto.randomUUID()
      await db.insert(auditoriaLogs).values({
        id: logAdmAId,
        acao: 'EVENTO_CRIADO',
        atorMembroId: memAuditorAdmAId,
        recursoTipo: 'EVENTO',
        recursoId: crypto.randomUUID(),
        escopoTipo: 'ADMINISTRACAO',
        escopoId: admAId,
        criadoEm: new Date().toISOString()
      })

      const res = await app.request('/api/v1/auditoria', {
        headers: { Authorization: `Bearer ${tokenAuditorAdmA}` }
      })
      expect(res.status).toBe(200)
      const json = await res.json()
      const encontrouAdmA = json.items.some((item: any) => item.id === logAdmAId)
      expect(encontrouAdmA).toBe(true)
    })

    it('5. Auditor Administração A DEVE ler logs de Setor subordinado à sua Administração', async () => {
      const logSetAId = crypto.randomUUID()
      await db.insert(auditoriaLogs).values({
        id: logSetAId,
        acao: 'EVENTO_CRIADO',
        atorMembroId: memAuditorAdmAId,
        recursoTipo: 'EVENTO',
        recursoId: crypto.randomUUID(),
        escopoTipo: 'SETOR',
        escopoId: setAId,
        criadoEm: new Date().toISOString()
      })

      const res = await app.request('/api/v1/auditoria', {
        headers: { Authorization: `Bearer ${tokenAuditorAdmA}` }
      })
      expect(res.status).toBe(200)
      const json = await res.json()
      const encontrouSetA = json.items.some((item: any) => item.id === logSetAId)
      expect(encontrouSetA).toBe(true)
    })

    it('6. Auditor Administração A DEVE ler logs de Casa subordinada à sua Administração', async () => {
      const logCasAId = crypto.randomUUID()
      await db.insert(auditoriaLogs).values({
        id: logCasAId,
        acao: 'EVENTO_CRIADO',
        atorMembroId: memAuditorAdmAId,
        recursoTipo: 'EVENTO',
        recursoId: crypto.randomUUID(),
        escopoTipo: 'CASA',
        escopoId: casAId,
        criadoEm: new Date().toISOString()
      })

      const res = await app.request('/api/v1/auditoria', {
        headers: { Authorization: `Bearer ${tokenAuditorAdmA}` }
      })
      expect(res.status).toBe(200)
      const json = await res.json()
      const encontrouCasA = json.items.some((item: any) => item.id === logCasAId)
      expect(encontrouCasA).toBe(true)
    })

    it('7. Filtro solicitando escopo fora da árvore autorizada deve retornar 403', async () => {
      const res = await app.request(`/api/v1/auditoria?escopoTipo=REGIONAL&escopoId=${regBId}`, {
        headers: { Authorization: `Bearer ${tokenAuditorAdmA}` }
      })
      expect(res.status).toBe(403)
    })
  })

  // =========================================================================
  // 2. SEGURANÇA DA IDENTIDADE DO ATOR (ANTI-SPOOFING)
  // =========================================================================
  describe('Segurança de Identidade do Ator (Anti-Spoofing)', () => {
    it('deve ignorar header x-membro-id ou corpo forjado e usar ID da sessão no log de auditoria', async () => {
      const fakeMembroId = crypto.randomUUID()
      const newEvento = {
        titulo: 'Evento Anti-Spoofing',
        modalidade: 'ONLINE',
        inicioEm: '2026-11-10T10:00:00Z',
        fimEm: '2026-11-10T12:00:00Z',
        urlOnline: 'https://meet.google.com/test',
        regionalId: regAId,
        organizadorMembroId: memAuditorRegAId
      }

      const resPost = await app.request('/api/v1/eventos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAuditorRegA}`,
          'x-membro-id': fakeMembroId
        },
        body: JSON.stringify(newEvento)
      })
      expect(resPost.status).toBe(201)
      const created = await resPost.json()

      const log = await db.select().from(auditoriaLogs).where(eq(auditoriaLogs.recursoId, created.id)).get()
      expect(log).toBeDefined()
      expect(log.atorMembroId).toBe(memAuditorRegAId)
      expect(log.atorMembroId).not.toBe(fakeMembroId)
    })
  })

  // =========================================================================
  // 3. GARANTIA DE ROLLBACK ATÔMICO FAIL-CLOSED (4 FAMÍLIAS DE OPERAÇÃO)
  // =========================================================================
  describe('Garantia de Rollback Atômico Fail-Closed (4 Famílias)', () => {
    it('1. Família Evento: deve abortar inserção e log quando a gravação de auditoria falha', async () => {
      const testEventoId = crypto.randomUUID()
      const atorInvalidoId = crypto.randomUUID()

      await expect(
        executarOperacaoComAudit(
          db,
          (qdb) => [
            qdb.insert(eventos).values({
              id: testEventoId,
              titulo: 'Evento Teste Fail-Closed',
              modalidade: 'ONLINE',
              inicioEm: '2026-11-15T10:00:00Z',
              fimEm: '2026-11-15T12:00:00Z',
              regionalId: regAId,
              ativo: true
            })
          ],
          {
            acao: 'EVENTO_CRIADO',
            atorMembroId: atorInvalidoId,
            recursoTipo: 'EVENTO',
            recursoId: testEventoId,
            escopoTipo: 'REGIONAL',
            escopoId: regAId
          }
        )
      ).rejects.toThrow()

      const evtDB = await db.select().from(eventos).where(eq(eventos.id, testEventoId)).get()
      expect(evtDB).toBeUndefined()

      const auditDB = await db.select().from(auditoriaLogs).where(eq(auditoriaLogs.recursoId, testEventoId)).get()
      expect(auditDB).toBeUndefined()
    })

    it('2. Família Convocação: deve abortar publicação e log quando a auditoria falha', async () => {
      const evtId = crypto.randomUUID()
      await db.insert(eventos).values({
        id: evtId,
        titulo: 'Evento Convocacao Fail-Closed',
        modalidade: 'ONLINE',
        inicioEm: '2026-11-20T10:00:00Z',
        fimEm: '2026-11-20T12:00:00Z',
        regionalId: regAId,
        ativo: true
      })

      const convId = crypto.randomUUID()
      const nowIso = new Date().toISOString()
      await db.insert(convocacoes).values({
        id: convId,
        eventoId: evtId,
        status: 'RASCUNHO',
        ativo: true,
        createdAt: nowIso,
        updatedAt: nowIso
      })

      const atorInvalidoId = crypto.randomUUID()

      await expect(
        executeAtomic(db, (qdb) => [
          qdb.update(convocacoes).set({ status: 'PUBLICADA', publicadaEm: nowIso }).where(eq(convocacoes.id, convId)),
          criarAuditQuery(qdb, {
            acao: 'CONVOCACAO_PUBLICADA',
            atorMembroId: atorInvalidoId,
            recursoTipo: 'CONVOCACAO',
            recursoId: convId,
            escopoTipo: 'REGIONAL',
            escopoId: regAId
          })
        ])
      ).rejects.toThrow()

      const convDB = await db.select().from(convocacoes).where(eq(convocacoes.id, convId)).get()
      expect(convDB.status).toBe('RASCUNHO')

      const auditDB = await db.select().from(auditoriaLogs).where(eq(auditoriaLogs.recursoId, convId)).get()
      expect(auditDB).toBeUndefined()
    })

    it('3. Família RSVP: deve abortar upsert de RSVP e log quando a auditoria falha', async () => {
      const evtId = crypto.randomUUID()
      await db.insert(eventos).values({
        id: evtId,
        titulo: 'Evento RSVP Fail-Closed',
        modalidade: 'ONLINE',
        inicioEm: '2026-11-25T10:00:00Z',
        fimEm: '2026-11-25T12:00:00Z',
        regionalId: regAId,
        ativo: true
      })

      const convId = crypto.randomUUID()
      const nowIso = new Date().toISOString()
      await db.insert(convocacoes).values({
        id: convId,
        eventoId: evtId,
        status: 'PUBLICADA',
        ativo: true,
        createdAt: nowIso,
        updatedAt: nowIso
      })

      const destId = crypto.randomUUID()
      await db.insert(convocacaoDestinatarios).values({
        id: destId,
        convocacaoId: convId,
        membroId: memComumId,
        createdAt: nowIso
      })

      const rsvpId = crypto.randomUUID()
      const atorInvalidoId = crypto.randomUUID()

      await expect(
        executeAtomic(db, (qdb) => [
          qdb.insert(rsvp).values({
            id: rsvpId,
            convocacaoDestinatarioId: destId,
            resposta: 'PARTICIPAREI',
            respondidoEm: nowIso,
            atualizadoEm: nowIso
          }),
          criarAuditQuery(qdb, {
            acao: 'RSVP_REGISTRADO',
            atorMembroId: atorInvalidoId,
            recursoTipo: 'RSVP',
            recursoId: rsvpId,
            escopoTipo: 'REGIONAL',
            escopoId: regAId
          })
        ])
      ).rejects.toThrow()

      const rsvpDB = await db.select().from(rsvp).where(eq(rsvp.id, rsvpId)).get()
      expect(rsvpDB).toBeUndefined()

      const auditDB = await db.select().from(auditoriaLogs).where(eq(auditoriaLogs.recursoId, rsvpId)).get()
      expect(auditDB).toBeUndefined()
    })

    it('4. Família Check-in: deve abortar registro de check-in e log quando a auditoria falha', async () => {
      const evtId = crypto.randomUUID()
      await db.insert(eventos).values({
        id: evtId,
        titulo: 'Evento Checkin Fail-Closed',
        modalidade: 'PRESENCIAL',
        inicioEm: '2026-11-30T10:00:00Z',
        fimEm: '2026-11-30T12:00:00Z',
        regionalId: regAId,
        ativo: true
      })

      const convId = crypto.randomUUID()
      const nowIso = new Date().toISOString()
      await db.insert(convocacoes).values({
        id: convId,
        eventoId: evtId,
        status: 'PUBLICADA',
        ativo: true,
        createdAt: nowIso,
        updatedAt: nowIso
      })

      const destId = crypto.randomUUID()
      await db.insert(convocacaoDestinatarios).values({
        id: destId,
        convocacaoId: convId,
        membroId: memComumId,
        createdAt: nowIso
      })

      const checkinId = crypto.randomUUID()
      const atorInvalidoId = crypto.randomUUID()

      await expect(
        executarOperacaoComAudit(
          db,
          (qdb) => [
            qdb.insert(checkins).values({
              id: checkinId,
              convocacaoDestinatarioId: destId,
              eventoId: evtId,
              membroId: memComumId,
              forma: 'QR',
              operadorMembroId: memOperadorId,
              dataHoraCheckin: nowIso
            })
          ],
          {
            acao: 'CHECKIN_QR',
            atorMembroId: atorInvalidoId,
            recursoTipo: 'CHECKIN',
            recursoId: checkinId,
            escopoTipo: 'REGIONAL',
            escopoId: regAId
          }
        )
      ).rejects.toThrow()

      const chkDB = await db.select().from(checkins).where(eq(checkins.id, checkinId)).get()
      expect(chkDB).toBeUndefined()

      const auditDB = await db.select().from(auditoriaLogs).where(eq(auditoriaLogs.recursoId, checkinId)).get()
      expect(auditDB).toBeUndefined()
    })
  })
})
