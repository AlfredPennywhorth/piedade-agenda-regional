import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../index'
import { setupDb } from './setup'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { regionais, administracoes, setores, casas, gruposTrabalho, membros, funcoes, vinculosFuncionais, locais, eventos, convocacoes, convocacaoFuncoes, convocacaoDestinatarios, seriesRecorrencia } from '../db/schema'
import { eq } from 'drizzle-orm'

describe('S06 - Convocações', () => {
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

  async function setupBaseData() {
    const regId = crypto.randomUUID()
    await db.insert(regionais).values({ id: regId, nome: 'Reg1' })

    const admId = crypto.randomUUID()
    await db.insert(administracoes).values({ id: admId, nome: 'Adm1', regionalId: regId })

    const setId = crypto.randomUUID()
    await db.insert(setores).values({ id: setId, nome: 'Set1', administracaoId: admId })

    const casId = crypto.randomUUID()
    await db.insert(casas).values({ id: casId, nome: 'Cas1', setorId: setId })
    const cas2Id = crypto.randomUUID()
    await db.insert(casas).values({ id: cas2Id, nome: 'Cas2', setorId: setId })

    const gtId = crypto.randomUUID()
    await db.insert(gruposTrabalho).values({ id: gtId, nome: 'GT1', regionalId: regId })

    const mem1Id = crypto.randomUUID() // Ativo
    await db.insert(membros).values({ id: mem1Id, nome: 'Mem1', casaId: casId, ativo: true })
    const mem2Id = crypto.randomUUID() // Inativo
    await db.insert(membros).values({ id: mem2Id, nome: 'Mem2', casaId: casId, ativo: false })
    const mem3Id = crypto.randomUUID() // Ativo em outra casa
    await db.insert(membros).values({ id: mem3Id, nome: 'Mem3', casaId: cas2Id, ativo: true })

    const f1Id = crypto.randomUUID()
    await db.insert(funcoes).values({ id: f1Id, nome: 'F1', ativo: true })
    const f2Id = crypto.randomUUID()
    await db.insert(funcoes).values({ id: f2Id, nome: 'F2', ativo: true })

    // Vinculos
    const v1Id = crypto.randomUUID() // Setor 1, F1 (Matches evento Setor 1) - VALIDO
    await db.insert(vinculosFuncionais).values({ id: v1Id, membroId: mem1Id, funcaoId: f1Id, setorId: setId, ativo: true })
    
    const v2Id = crypto.randomUUID() // Setor 1, F2 (Inativo)
    await db.insert(vinculosFuncionais).values({ id: v2Id, membroId: mem1Id, funcaoId: f2Id, setorId: setId, ativo: false })

    const v3Id = crypto.randomUUID() // Casa 1, F1 (Matches evento Casa 1 mas NÃO Setor 1) - VALIDO APENAS PRA CASA
    await db.insert(vinculosFuncionais).values({ id: v3Id, membroId: mem1Id, funcaoId: f1Id, casaId: casId, ativo: true })

    const v4Id = crypto.randomUUID() // Setor 1, F1 MAS membro Inativo (mem2)
    await db.insert(vinculosFuncionais).values({ id: v4Id, membroId: mem2Id, funcaoId: f1Id, setorId: setId, ativo: true })


    // Eventos
    const locId = crypto.randomUUID()
    await db.insert(locais).values({ id: locId, nome: 'Loc', endereco: 'End', numero: '1', cidade: 'C', uf: 'SP' })

    const evSetorId = crypto.randomUUID()
    await db.insert(eventos).values({
      id: evSetorId, titulo: 'Ev Setor', modalidade: 'PRESENCIAL', inicioEm: '2026-01-01T10:00:00Z', fimEm: '2026-01-01T11:00:00Z',
      setorId: setId, localId: locId, ativo: true
    })

    const evCasaId = crypto.randomUUID()
    await db.insert(eventos).values({
      id: evCasaId, titulo: 'Ev Casa', modalidade: 'PRESENCIAL', inicioEm: '2026-01-01T10:00:00Z', fimEm: '2026-01-01T11:00:00Z',
      casaId: casId, localId: locId, ativo: true
    })

    return { regId, setId, casId, gtId, mem1Id, mem2Id, mem3Id, f1Id, f2Id, evSetorId, evCasaId, v1Id, v2Id, v3Id, v4Id }
  }

  it('1. criar convocação RASCUNHO', async () => {
    const ctx = await setupBaseData()
    const res = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId })
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.status).toBe('RASCUNHO')
    expect(json.id).toBeDefined()
  })

  it('2. não publicar quando função associada estiver inativa', async () => {
    const ctx = await setupBaseData()
    const fInativaId = crypto.randomUUID()
    await db.insert(funcoes).values({ id: fInativaId, nome: 'F Inativa', ativo: true })
    
    // Criar rascunho e associar
    const convRes = await app.request('/api/v1/convocacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventoId: ctx.evSetorId }) })
    const conv = await convRes.json()
    await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ funcaoId: fInativaId }) })
    
    // Inativar a função no BD
    await db.update(funcoes).set({ ativo: false }).where(eq(funcoes.id, fInativaId))

    const pubRes = await app.request(`/api/v1/convocacoes/${conv.id}/publicar`, { method: 'POST' })
    expect(pubRes.status).toBe(400)
    const pubBody = await pubRes.json()
    expect(pubBody.error).toMatch(/Uma ou mais funções associadas estão inativas/)

    const getRes = await app.request(`/api/v1/convocacoes/${conv.id}`)
    expect((await getRes.json()).status).toBe('RASCUNHO')

    const destRes = await app.request(`/api/v1/convocacoes/${conv.id}/destinatarios`)
    expect((await destRes.json()).length).toBe(0)
  })

  it('11–14. publicar exclui vínculos inativos, membros inativos e escopos não solicitados', async () => {
    const ctx = await setupBaseData()
    
    const fNaoSelecionadaId = crypto.randomUUID()
    await db.insert(funcoes).values({ id: fNaoSelecionadaId, nome: 'F3', ativo: true })
    const vNaoSelecionadaId = crypto.randomUUID()
    await db.insert(vinculosFuncionais).values({ id: vNaoSelecionadaId, membroId: ctx.mem1Id, funcaoId: fNaoSelecionadaId, setorId: ctx.setId, ativo: true })

    const convRes = await app.request('/api/v1/convocacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventoId: ctx.evSetorId }) })
    const conv = await convRes.json()
    
    // Adiciona só a f1Id
    await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ funcaoId: ctx.f1Id }) })
    
    const pubRes = await app.request(`/api/v1/convocacoes/${conv.id}/publicar`, { method: 'POST' })
    expect(pubRes.status).toBe(200)

    const destRes = await app.request(`/api/v1/convocacoes/${conv.id}/destinatarios`)
    const dests = await destRes.json()
    
    // Devem aparecer exatamente 1 destinatário (mem1Id via v1Id)
    // mem2Id (v4Id) descartado pois inativo
    // v2Id descartado pois vinculo inativo e funcao nao selecionada
    // v3Id descartado pois é da Casa 1 e o Evento é de Setor 1
    // vNaoSelecionadaId descartado pois a função nao foi requerida
    expect(dests.length).toBe(1)
    expect(dests[0].membroId).toBe(ctx.mem1Id)
    expect(dests[0].vinculoFuncionalId).toBe(ctx.v1Id)
  })

  it('15. evento de Setor não captura vínculo de Casa', async () => {
    const ctx = await setupBaseData()
    const convRes = await app.request('/api/v1/convocacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventoId: ctx.evSetorId }) })
    const conv = await convRes.json()
    await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ funcaoId: ctx.f1Id }) })
    await app.request(`/api/v1/convocacoes/${conv.id}/publicar`, { method: 'POST' })
    
    const destRes = await app.request(`/api/v1/convocacoes/${conv.id}/destinatarios`)
    const dests = await destRes.json()
    
    const vinculoCasaIncluso = dests.some((d: any) => d.vinculoFuncionalId === ctx.v3Id)
    expect(vinculoCasaIncluso).toBe(false)
  })

  it('18-19. alterações posteriores não alteram o snapshot gerado', async () => {
    const ctx = await setupBaseData()
    const convRes = await app.request('/api/v1/convocacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventoId: ctx.evSetorId }) })
    const conv = await convRes.json()
    await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ funcaoId: ctx.f1Id }) })
    await app.request(`/api/v1/convocacoes/${conv.id}/publicar`, { method: 'POST' })
    
    // Inativar membro e vinculo original
    await db.update(membros).set({ ativo: false }).where(eq(membros.id, ctx.mem1Id))
    await db.update(vinculosFuncionais).set({ ativo: false }).where(eq(vinculosFuncionais.id, ctx.v1Id))

    // Consultar snapshot
    const destRes = await app.request(`/api/v1/convocacoes/${conv.id}/destinatarios`)
    const dests = await destRes.json()
    expect(dests.length).toBe(1)
    expect(dests[0].membroId).toBe(ctx.mem1Id)
    expect(dests[0].funcaoId).toBe(ctx.f1Id)
    expect(dests[0].vinculoFuncionalId).toBe(ctx.v1Id)
  })

  it('25. convocação possui apenas eventoId, série ignorada na tabela', async () => {
    const ctx = await setupBaseData()
    // Criar serie
    const serieId = crypto.randomUUID()
    await db.insert(seriesRecorrencia).values({
      id: serieId,
      frequencia: 'DIARIA',
      dataInicio: '2026-01-01',
      dataFim: '2026-01-05',
      horarioInicio: '10:00:00',
      horarioFim: '11:00:00',
      regionalId: ctx.regId
    })
    // Atualizar evento com serie
    await db.update(eventos).set({ serieRecorrenciaId: serieId }).where(eq(eventos.id, ctx.evSetorId))

    const convRes = await app.request('/api/v1/convocacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventoId: ctx.evSetorId }) })
    const conv = await convRes.json()
    
    const dbConv = await db.select().from(convocacoes).where(eq(convocacoes.id, conv.id)).get()
    expect(dbConv.eventoId).toBe(ctx.evSetorId)
    // Convocação NÃO deve ter coluna serieRecorrenciaId
    expect((dbConv as any).serieRecorrenciaId).toBeUndefined()
  })

  it('26. atomicidade garante que falha na DB preserva RASCUNHO e 0 destinatarios', async () => {
    const ctx = await setupBaseData()
    const convRes = await app.request('/api/v1/convocacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventoId: ctx.evSetorId }) })
    const conv = await convRes.json()
    await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ funcaoId: ctx.f1Id }) })
    
    // Inserir deliberadamente um destinatário com FK inválida para quebrar o D1 no momento da gravação
    const fnBackup = app.fetch
    app = createApp(db) // Reset for direct manipulate if needed, not needed, we can just insert bad data before commit.
    
    // Como a operação usa executeAtomic, para forçar o erro a API deveria quebrar dentro do run().
    // Um jeito fácil é apagar o membroId logo antes de rodar, ou injetar uma restrição FK que vai falhar
    // O mock do sqlite não bloqueia de forma atômica da mesma maneira que D1, mas o try/catch vai processar
    // Para simplificar, farei uma restrição de quebra intencional via SQL executado.
    await db.run(sql`CREATE TRIGGER IF NOT EXISTS force_fail BEFORE INSERT ON convocacao_destinatarios BEGIN SELECT RAISE(ABORT, 'forced fail'); END;`)
    
    const pubRes = await app.request(`/api/v1/convocacoes/${conv.id}/publicar`, { method: 'POST' })
    expect(pubRes.status).toBe(400) // The app catches the atomic fail and returns 400

    await db.run(sql`DROP TRIGGER force_fail;`)

    const getRes = await app.request(`/api/v1/convocacoes/${conv.id}`)
    expect((await getRes.json()).status).toBe('RASCUNHO')

    const destRes = await app.request(`/api/v1/convocacoes/${conv.id}/destinatarios`)
    expect((await destRes.json()).length).toBe(0)
  })

  it('27. constraints e check(status) validados pelo SQLite', async () => {
    const ctx = await setupBaseData()
    // Teste de status invalido (deve ser RASCUNHO, PUBLICADA ou CANCELADA)
    try {
      await db.run(sql`INSERT INTO convocacoes (id, evento_id, status) VALUES ('id1', ${ctx.evSetorId}, 'INVALIDO')`)
      expect.fail('Deveria ter falhado na restrição CHECK')
    } catch (err: any) {
      expect(err.message).toMatch(/check_status_convocacao|CHECK constraint failed/)
    }

    // Teste de FK evento
    try {
      await db.run(sql`INSERT INTO convocacoes (id, evento_id, status) VALUES ('id2', 'evento-inexistente', 'RASCUNHO')`)
      expect.fail('Deveria ter falhado na FK')
    } catch (err: any) {
      expect(err.message).toMatch(/FOREIGN KEY constraint failed/)
    }
    
    // Teste UNIQUE(convocacao_id, funcao_id)
    const convId = crypto.randomUUID()
    await db.run(sql`INSERT INTO convocacoes (id, evento_id, status) VALUES (${convId}, ${ctx.evSetorId}, 'RASCUNHO')`)
    await db.run(sql`INSERT INTO convocacao_funcoes (convocacao_id, funcao_id) VALUES (${convId}, ${ctx.f1Id})`)
    try {
      await db.run(sql`INSERT INTO convocacao_funcoes (convocacao_id, funcao_id) VALUES (${convId}, ${ctx.f1Id})`)
      expect.fail('Deveria ter falhado no UNIQUE de função')
    } catch (err: any) {
      expect(err.message).toMatch(/UNIQUE constraint failed/)
    }
  })
})

import { sql } from 'drizzle-orm'
