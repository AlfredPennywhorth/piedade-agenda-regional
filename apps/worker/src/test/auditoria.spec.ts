import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../index'
import { setupDb } from './setup'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { regionais, administracoes, setores, casas, membros, funcoes, vinculosFuncionais, eventos, sessoes } from '../db/schema'
import { hashToken } from '../security/tokens'
import { eq } from 'drizzle-orm'
import { executarOperacaoComAudit } from '../services/auditoria'

describe('S12 - Auditoria e Atomicidade Fail-Closed', () => {
  let sqlite: Database.Database
  let db: any
  let app: any

  let tokenAuditorRegional: string
  let tokenMembroComum: string
  let memAuditorId: string
  let regId: string

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
    await db.insert(regionais).values({ id: regId, nome: 'Regional SP Audit' })

    const admId = crypto.randomUUID()
    await db.insert(administracoes).values({ id: admId, nome: 'Adm Central', regionalId: regId })

    const setId = crypto.randomUUID()
    await db.insert(setores).values({ id: setId, nome: 'Setor Sul', administracaoId: admId })

    const casId = crypto.randomUUID()
    await db.insert(casas).values({ id: casId, nome: 'Casa Sul', setorId: setId })

    // Membro 1: Auditor do Sistema na Regional
    memAuditorId = crypto.randomUUID()
    await db.insert(membros).values({ id: memAuditorId, nome: 'Auditor Geral', casaId: casId, ativo: true, autenticacaoAtiva: true })
    tokenAuditorRegional = await criarSessao(memAuditorId)

    const funcaoAuditorId = crypto.randomUUID()
    await db.insert(funcoes).values({ id: funcaoAuditorId, nome: 'Auditor do Sistema', codigo: 'AUDITOR_SISTEMA', ativo: true })
    await db.insert(vinculosFuncionais).values({
      id: crypto.randomUUID(),
      membroId: memAuditorId,
      funcaoId: funcaoAuditorId,
      regionalId: regId,
      ativo: true
    })

    // Membro 2: Comum
    const memComumId = crypto.randomUUID()
    await db.insert(membros).values({ id: memComumId, nome: 'Membro Comum', casaId: casId, ativo: true, autenticacaoAtiva: true })
    tokenMembroComum = await criarSessao(memComumId)
  })

  afterAll(() => {
    sqlite.close()
  })

  it('deve rejeitar acesso à auditoria para membro comum sem AUDITOR_SISTEMA (403)', async () => {
    const res = await app.request('/api/v1/auditoria', {
      headers: { Authorization: `Bearer ${tokenMembroComum}` }
    })
    expect(res.status).toBe(403)
  })

  it('deve permitir acesso à auditoria para AUDITOR_SISTEMA em escopo Regional', async () => {
    const res = await app.request('/api/v1/auditoria', {
      headers: { Authorization: `Bearer ${tokenAuditorRegional}` }
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.items).toBeDefined()
    expect(Array.isArray(json.items)).toBe(true)
    expect(json.pagination).toBeDefined()
  })

  it('deve registrar log de auditoria ao criar evento via POST /api/v1/eventos', async () => {
    const newEvento = {
      titulo: 'Evento Auditado',
      modalidade: 'ONLINE',
      inicioEm: '2026-11-01T10:00:00Z',
      fimEm: '2026-11-01T12:00:00Z',
      urlOnline: 'https://meet.google.com/audit',
      regionalId: regId,
      organizadorMembroId: memAuditorId
    }

    const resPost = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAuditorRegional}`
      },
      body: JSON.stringify(newEvento)
    })
    expect(resPost.status).toBe(201)
    const createdEvento = await resPost.json()

    // Consulta auditoria
    const resAudit = await app.request(`/api/v1/auditoria?recursoId=${createdEvento.id}`, {
      headers: { Authorization: `Bearer ${tokenAuditorRegional}` }
    })
    expect(resAudit.status).toBe(200)
    const auditData = await resAudit.json()
    expect(auditData.items.length).toBeGreaterThanOrEqual(1)
    const log = auditData.items[0]
    expect(log.acao).toBe('EVENTO_CRIADO')
    expect(log.recursoTipo).toBe('EVENTO')
    expect(log.recursoId).toBe(createdEvento.id)
    expect(log.escopoTipo).toBe('REGIONAL')
    expect(log.escopoId).toBe(regId)
  })

  it('deve garantir rollback atômico fail-closed quando a gravação do log de auditoria falha', async () => {
    const testEventoId = crypto.randomUUID()

    // Tentar executar operação de negócio com um atorMembroId inexistente na auditoria (que viola FK em auditoria_logs)
    const atorInvalidoId = crypto.randomUUID() // ID não existe em membros

    await expect(
      executarOperacaoComAudit(
        db,
        (qdb) => [
          qdb.insert(eventos).values({
            id: testEventoId,
            titulo: 'Evento Não Salvo por Fail-Closed',
            modalidade: 'ONLINE',
            inicioEm: '2026-11-02T10:00:00Z',
            fimEm: '2026-11-02T12:00:00Z',
            regionalId: regId,
            ativo: true
          })
        ],
        {
          acao: 'EVENTO_CRIADO',
          atorMembroId: atorInvalidoId, // Viola FK da auditoria
          recursoTipo: 'EVENTO',
          recursoId: testEventoId,
          escopoTipo: 'REGIONAL',
          escopoId: regId
        }
      )
    ).rejects.toThrow()

    // Verifica que o evento NÂO foi inserido no banco (rollback atômico funcionou!)
    const eventoNoBanco = await db.select().from(eventos).where(eq(eventos.id, testEventoId)).get()
    expect(eventoNoBanco).toBeUndefined()
  })
})
