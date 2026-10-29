import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../index'
import { setupDb } from './setup'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import {
  regionais,
  administracoes,
  setores,
  pontosAtendimento,
  casas,
  gruposTrabalho,
  membros,
  funcoes,
  vinculosFuncionais,
  locais,
  eventos,
  convocacoes,
  seriesRecorrencia,
  sessoes,
  auditoriaLogs,
} from '../db/schema'
import { and, eq } from 'drizzle-orm'
import { hashToken } from '../security/tokens'

describe('S06 - Convocações', () => {
  let sqlite: Database.Database
  let db: any
  let app: any
  let requestSemSessao: any
  let tokenSessaoAtual = ''

  beforeAll(() => {
    sqlite = new Database(':memory:')
    setupDb(sqlite)
    db = drizzle(sqlite)
    app = createApp(db)
    requestSemSessao = app.request.bind(app)
    app.request = (input: RequestInfo | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)
      headers.set('Authorization', `Bearer ${tokenSessaoAtual}`)
      return requestSemSessao(input, { ...init, headers })
    }
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
    await db
      .insert(membros)
      .values({ id: mem1Id, nome: 'Mem1', casaId: casId, ativo: true, autenticacaoAtiva: true })
    const mem2Id = crypto.randomUUID() // Inativo
    await db.insert(membros).values({ id: mem2Id, nome: 'Mem2', casaId: casId, ativo: false })
    const mem3Id = crypto.randomUUID() // Ativo em outra casa
    await db.insert(membros).values({ id: mem3Id, nome: 'Mem3', casaId: cas2Id, ativo: true })

    const f1Id = crypto.randomUUID()
    await db.insert(funcoes).values({ id: f1Id, nome: 'F1', ativo: true })
    const f2Id = crypto.randomUUID()
    await db.insert(funcoes).values({ id: f2Id, nome: 'F2', ativo: true })

    const contaAgendaId = crypto.randomUUID()
    sqlite.prepare(
      'INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES (?, ?, \'ATIVA\', CURRENT_TIMESTAMP)'
    ).run(contaAgendaId, mem1Id)
    sqlite.prepare(
      'INSERT INTO acessos_conta (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id) VALUES (?, ?, \'GESTOR_AGENDA\', \'SETOR\', ?)'
    ).run(crypto.randomUUID(), contaAgendaId, setId)

    tokenSessaoAtual = crypto.randomUUID()
    await db.insert(sessoes).values({
      id: crypto.randomUUID(),
      membroId: mem1Id,
      tokenHash: await hashToken(tokenSessaoAtual),
      expiraEm: '2030-01-01T00:00:00.000Z',
      createdAt: new Date().toISOString(),
    })

    // Vinculos
    const v1Id = crypto.randomUUID() // Setor 1, F1 (Matches evento Setor 1) - VALIDO
    await db
      .insert(vinculosFuncionais)
      .values({ id: v1Id, membroId: mem1Id, funcaoId: f1Id, setorId: setId, ativo: true })

    const v2Id = crypto.randomUUID() // Setor 1, F2 (Inativo)
    await db
      .insert(vinculosFuncionais)
      .values({ id: v2Id, membroId: mem1Id, funcaoId: f2Id, setorId: setId, ativo: false })

    const v3Id = crypto.randomUUID() // Casa 1, F1 (Matches evento Casa 1 mas NÃO Setor 1) - VALIDO APENAS PRA CASA
    await db
      .insert(vinculosFuncionais)
      .values({ id: v3Id, membroId: mem1Id, funcaoId: f1Id, casaId: casId, ativo: true })

    const v4Id = crypto.randomUUID() // Setor 1, F1 MAS membro Inativo (mem2)
    await db
      .insert(vinculosFuncionais)
      .values({ id: v4Id, membroId: mem2Id, funcaoId: f1Id, setorId: setId, ativo: true })

    // Eventos
    const locId = crypto.randomUUID()
    await db
      .insert(locais)
      .values({ id: locId, nome: 'Loc', endereco: 'End', numero: '1', cidade: 'C', uf: 'SP' })

    const evSetorId = crypto.randomUUID()
    await db.insert(eventos).values({
      id: evSetorId,
      titulo: 'Ev Setor',
      modalidade: 'PRESENCIAL',
      inicioEm: '2026-01-01T10:00:00Z',
      fimEm: '2026-01-01T11:00:00Z',
      setorId: setId,
      organizadorMembroId: mem1Id,
      localId: locId,
      ativo: true,
    })

    const evCasaId = crypto.randomUUID()
    await db.insert(eventos).values({
      id: evCasaId,
      titulo: 'Ev Casa',
      modalidade: 'PRESENCIAL',
      inicioEm: '2026-01-01T10:00:00Z',
      fimEm: '2026-01-01T11:00:00Z',
      casaId: casId,
      localId: locId,
      ativo: true,
    })

    return {
      regId,
      setId,
      casId,
      cas2Id,
      gtId,
      mem1Id,
      mem2Id,
      mem3Id,
      f1Id,
      f2Id,
      evSetorId,
      evCasaId,
      v1Id,
      v2Id,
      v3Id,
      v4Id,
      locId,
    }
  }

  it('1. criar convocação RASCUNHO', async () => {
    const ctx = await setupBaseData()
    const res = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.status).toBe('RASCUNHO')
    expect(json.id).toBeDefined()

    const log = await db.select().from(auditoriaLogs)
      .where(eq(auditoriaLogs.recursoId, json.id))
      .get()
    expect(log?.acao).toBe('CONVOCACAO_CRIADA')
    expect(log?.atorMembroId).toBe(ctx.mem1Id)
    expect(log?.escopoTipo).toBe('SETOR')
    expect(log?.escopoId).toBe(ctx.setId)
  })

  it('1.0.1 impede segunda convocação para o mesmo evento', async () => {
    const ctx = await setupBaseData()

    const primeira = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    expect(primeira.status).toBe(201)

    const segunda = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    expect(segunda.status).toBe(409)
    expect(await segunda.json()).toMatchObject({
      code: 'CONVOCACAO_EVENTO_EXISTENTE',
      status: 'RASCUNHO',
    })

    expect(() =>
      sqlite.prepare(
        `INSERT INTO convocacoes (id, evento_id, status, ativo)
         VALUES (?, ?, 'RASCUNHO', 1)`
      ).run(crypto.randomUUID(), ctx.evSetorId)
    ).toThrow(/UNIQUE constraint failed: convocacoes\.evento_id/)
  })

  it('1.1 audita adição e remoção de função da convocação', async () => {
    const ctx = await setupBaseData()
    const convRes = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    const conv = await convRes.json()

    const addRes = await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcaoId: ctx.f1Id }),
    })
    expect(addRes.status).toBe(201)

    const addLog = await db.select().from(auditoriaLogs)
      .where(eq(auditoriaLogs.acao, 'CONVOCACAO_FUNCAO_ADICIONADA'))
      .all()
    expect(addLog.some((item: any) => item.recursoId === conv.id)).toBe(true)

    const delRes = await app.request(`/api/v1/convocacoes/${conv.id}/funcoes/${ctx.f1Id}`, {
      method: 'DELETE',
    })
    expect(delRes.status).toBe(200)

    const delLog = await db.select().from(auditoriaLogs)
      .where(eq(auditoriaLogs.acao, 'CONVOCACAO_FUNCAO_REMOVIDA'))
      .all()
    expect(delLog.some((item: any) => item.recursoId === conv.id)).toBe(true)
  })

  it('1.2 não audita remoção de função inexistente', async () => {
    const ctx = await setupBaseData()
    const convRes = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    const conv = await convRes.json()

    const delRes = await app.request(`/api/v1/convocacoes/${conv.id}/funcoes/${ctx.f1Id}`, {
      method: 'DELETE',
    })
    expect(delRes.status).toBe(404)

    const logs = await db.select().from(auditoriaLogs)
      .where(and(
        eq(auditoriaLogs.recursoId, conv.id),
        eq(auditoriaLogs.acao, 'CONVOCACAO_FUNCAO_REMOVIDA')
      ))
      .all()
    expect(logs).toHaveLength(0)
  })

  it('2. não publicar quando função associada estiver inativa', async () => {
    const ctx = await setupBaseData()
    const fInativaId = crypto.randomUUID()
    await db.insert(funcoes).values({ id: fInativaId, nome: 'F Inativa', ativo: true })

    // Criar rascunho e associar
    const convRes = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    const conv = await convRes.json()
    await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcaoId: fInativaId }),
    })

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

  it('9. deduplica membro com múltiplas funções e cria múltiplas evidências', async () => {
    const ctx = await setupBaseData()
    // Criar um novo vinculo para mem1, no mesmo setor, mas para funcao f2
    // mem1 já possui v1Id associado à f1Id no setId
    const v5Id = crypto.randomUUID()
    await db.insert(vinculosFuncionais).values({
      id: v5Id,
      membroId: ctx.mem1Id,
      funcaoId: ctx.f2Id,
      setorId: ctx.setId,
      ativo: true,
    })

    const convRes = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    const conv = await convRes.json()

    // Associar F1 e F2
    await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcaoId: ctx.f1Id }),
    })
    await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcaoId: ctx.f2Id }),
    })

    const pubRes = await app.request(`/api/v1/convocacoes/${conv.id}/publicar`, { method: 'POST' })
    expect(pubRes.status).toBe(200)

    const destRes = await app.request(`/api/v1/convocacoes/${conv.id}/destinatarios`)
    const dests = await destRes.json()

    // Deve haver apenas 1 destinatário para mem1
    expect(dests.length).toBe(1)
    expect(dests[0].membroId).toBe(ctx.mem1Id)

    // Deve haver 2 evidências
    expect(dests[0].evidencias.length).toBe(2)
    const evF1 = dests[0].evidencias.find((e: any) => e.funcaoId === ctx.f1Id)
    const evF2 = dests[0].evidencias.find((e: any) => e.funcaoId === ctx.f2Id)

    expect(evF1).toBeDefined()
    expect(evF1.vinculoFuncionalId).toBe(ctx.v1Id)

    expect(evF2).toBeDefined()
    expect(evF2.vinculoFuncionalId).toBe(v5Id)
  })

  it('11–14. publicar exclui vínculos inativos, membros inativos e escopos não solicitados', async () => {
    const ctx = await setupBaseData()

    const fNaoSelecionadaId = crypto.randomUUID()
    await db.insert(funcoes).values({ id: fNaoSelecionadaId, nome: 'F3', ativo: true })
    const vNaoSelecionadaId = crypto.randomUUID()
    await db.insert(vinculosFuncionais).values({
      id: vNaoSelecionadaId,
      membroId: ctx.mem1Id,
      funcaoId: fNaoSelecionadaId,
      setorId: ctx.setId,
      ativo: true,
    })

    const convRes = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    const conv = await convRes.json()

    // Adiciona só a f1Id
    await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcaoId: ctx.f1Id }),
    })

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
    expect(dests[0].evidencias.length).toBe(1)
    expect(dests[0].evidencias[0].vinculoFuncionalId).toBe(ctx.v1Id)
  })

  it('15. evento de Setor não captura vínculo de Casa', async () => {
    const ctx = await setupBaseData()
    const convRes = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    const conv = await convRes.json()
    await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcaoId: ctx.f1Id }),
    })
    await app.request(`/api/v1/convocacoes/${conv.id}/publicar`, { method: 'POST' })

    const destRes = await app.request(`/api/v1/convocacoes/${conv.id}/destinatarios`)
    const dests = await destRes.json()

    const vinculoCasaIncluso = dests.some((d: any) =>
      d.evidencias.some((e: any) => e.vinculoFuncionalId === ctx.v3Id)
    )
    expect(vinculoCasaIncluso).toBe(false)
  })

  it('15b. DCO: setor inclui Casas subordinadas, exclui outras e preserva funções comuns', async () => {
    const ctx = await setupBaseData()
    const dco = await db.select().from(funcoes).where(eq(funcoes.codigo, 'DCO')).get()
    expect(dco).toBeDefined()
    const dcoId = dco!.id

    const dcoDaCasa = crypto.randomUUID()
    const dcoOutraCasa = crypto.randomUUID()
    const outroSetor = crypto.randomUUID()
    const outraCasa = crypto.randomUUID()
    await db.insert(setores).values({ id: outroSetor, nome: 'Outro Setor', administracaoId: (await db.select().from(setores).where(eq(setores.id, ctx.setId)).get()).administracaoId })
    await db.insert(casas).values({ id: outraCasa, nome: 'Casa fora do setor', setorId: outroSetor })
    await db.insert(membros).values([
      { id: dcoDaCasa, nome: 'DCO dentro do setor', casaId: ctx.casId, ativo: true },
      { id: dcoOutraCasa, nome: 'DCO fora do setor', casaId: outraCasa, ativo: true },
    ])
    const vinculoDentro = crypto.randomUUID()
    const vinculoFora = crypto.randomUUID()
    await db.insert(vinculosFuncionais).values([
      { id: vinculoDentro, membroId: dcoDaCasa, funcaoId: dcoId, casaId: ctx.casId, ativo: true, origem: 'MEMBRO_AUTOMATICO' },
      { id: vinculoFora, membroId: dcoOutraCasa, funcaoId: dcoId, casaId: outraCasa, ativo: true, origem: 'MEMBRO_AUTOMATICO' },
    ])

    const criarEPublicar = async (funcaoId: string) => {
      const eventoId = crypto.randomUUID()
      await db.insert(eventos).values({
        id: eventoId, titulo: 'Reunião Setor Centro', modalidade: 'ONLINE',
        inicioEm: '2028-01-01T10:00:00.000Z', fimEm: '2028-01-01T11:00:00.000Z',
        setorId: ctx.setId, ativo: true,
      })
      const resposta = await app.request('/api/v1/convocacoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventoId }),
      })
      expect(resposta.status).toBe(201)
      const conv = await resposta.json()
      const fun = await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcaoId }),
      })
      expect(fun.status).toBe(201)
      const publicada = await app.request(`/api/v1/convocacoes/${conv.id}/publicar`, { method: 'POST' })
      expect(publicada.status).toBe(200)
      const destinatarios = await app.request(`/api/v1/convocacoes/${conv.id}/destinatarios`)
      expect(destinatarios.status).toBe(200)
      return await destinatarios.json() as Array<{ membroId: string; evidencias: Array<{ vinculoFuncionalId: string }> }>
    }

    // Vínculo DCO legado na Casa atual deve herdar o Setor, sem depender da origem.
    const legadoId = crypto.randomUUID()
    await db.insert(membros).values({ id: legadoId, nome: 'DCO legado', casaId: ctx.cas2Id, ativo: true })
    await db.insert(vinculosFuncionais).values({
      id: crypto.randomUUID(), membroId: legadoId, funcaoId: dcoId,
      casaId: ctx.cas2Id, ativo: true,
    })

    // Histórico da Casa anterior não é destinatário da convocação atual.
    const historicoId = crypto.randomUUID()
    await db.insert(vinculosFuncionais).values({
      id: historicoId, membroId: legadoId, funcaoId: dcoId,
      casaId: outraCasa, ativo: true,
    })

    const dcos = await criarEPublicar(dcoId)
    expect(dcos.map(item => item.membroId)).toContain(dcoDaCasa)
    expect(dcos.map(item => item.membroId)).not.toContain(dcoOutraCasa)
    expect(dcos.map(item => item.membroId)).toContain(legadoId)
    expect(dcos.find(item => item.membroId === legadoId)?.evidencias.some(e => e.vinculoFuncionalId === historicoId)).toBe(false)
    expect(dcos.find(item => item.membroId === dcoDaCasa)?.evidencias)
      .toEqual(expect.arrayContaining([expect.objectContaining({ vinculoFuncionalId: vinculoDentro })]))

    const comuns = await criarEPublicar(ctx.f1Id)
    expect(comuns).toHaveLength(1)
    expect(comuns[0].membroId).toBe(ctx.mem1Id)
    expect(comuns[0].evidencias).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ vinculoFuncionalId: ctx.v3Id })])
    )
  })

  it('15bb. Sincronizar DCO legado após publicação preserva destinatários e é idempotente', async () => {
    const ctx = await setupBaseData()
    const dco = await db.select().from(funcoes).where(eq(funcoes.codigo, 'DCO')).get()
    expect(dco).toBeDefined()
    const eventoId = crypto.randomUUID()
    await db.insert(eventos).values({
      id: eventoId, titulo: 'Convocação de Setor para reconciliação', modalidade: 'ONLINE',
      inicioEm: '2030-03-01T10:00:00.000Z', fimEm: '2030-03-01T11:00:00.000Z',
      setorId: ctx.setId, ativo: true,
    })
    const resposta = await app.request('/api/v1/convocacoes', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventoId }) })
    expect(resposta.status).toBe(201)
    const { id } = await resposta.json()
    expect((await app.request(`/api/v1/convocacoes/${id}/funcoes`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ funcaoId: dco!.id }) })).status).toBe(201)
    expect((await app.request(`/api/v1/convocacoes/${id}/publicar`, { method: 'POST' })).status).toBe(200)
    const membroLegado = crypto.randomUUID()
    await db.insert(membros).values({ id: membroLegado, nome: 'DCO legado ativo', casaId: ctx.casId, ativo: true })
    await db.insert(vinculosFuncionais).values({
      id: crypto.randomUUID(), membroId: membroLegado, funcaoId: dco!.id,
      casaId: ctx.casId, ativo: true,
    })
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      const res = await app.request(`/api/v1/convocacoes/${id}/sincronizar-dco`, { method: 'POST' })
      expect(res.status).toBe(200)
    }
    const lista = await (await app.request(`/api/v1/convocacoes/${id}/destinatarios`)).json() as Array<{ membroId: string }>
    expect(lista.filter(item => item.membroId === membroLegado)).toHaveLength(1)

    // Mudança concorrente de Setor após a autorização inicial deve abortar o batch.
    const outroSetorId = crypto.randomUUID()
    const setorOriginal = await db.select().from(setores).where(eq(setores.id, ctx.setId)).get()
    await db.insert(setores).values({
      id: outroSetorId, nome: 'Setor alterado durante sincronização',
      administracaoId: setorOriginal!.administracaoId,
    })
    const originalTransaction = db.transaction.bind(db)
    let interceptado = false
    db.transaction = (...args: any[]) => {
      if (!interceptado) {
        interceptado = true
        sqlite.prepare('UPDATE eventos SET setor_id = ? WHERE id = ?').run(outroSetorId, eventoId)
      }
      return originalTransaction(...args)
    }
    try {
      const res = await app.request(`/api/v1/convocacoes/${id}/sincronizar-dco`, { method: 'POST' })
      expect(res.status).toBe(409)
      expect(interceptado).toBe(true)
    } finally {
      db.transaction = originalTransaction
    }
    expect(sqlite.prepare("SELECT setor_id FROM eventos WHERE id = ?").get(eventoId))
      .toMatchObject({ setor_id: outroSetorId })
  })

  it('PA-01: publicação e sincronização DCO não alcançam Casas de outro Ponto do mesmo Setor', async () => {
    const ctx = await setupBaseData()
    const pontoA = crypto.randomUUID()
    const pontoB = crypto.randomUUID()
    await db.insert(pontosAtendimento).values([
      { id: pontoA, nome: 'Ponto A', setorId: ctx.setId },
      { id: pontoB, nome: 'Ponto B', setorId: ctx.setId },
    ])
    await db.update(casas).set({ pontoAtendimentoId: pontoA }).where(eq(casas.id, ctx.casId))
    await db.update(casas).set({ pontoAtendimentoId: pontoB }).where(eq(casas.id, ctx.cas2Id))
    const dco = await db.select().from(funcoes).where(eq(funcoes.codigo, 'DCO')).get()
    const criarDco = async (casaId: string, nome: string) => {
      const id = crypto.randomUUID()
      await db.insert(membros).values({ id, nome, casaId, ativo: true })
      await db.insert(vinculosFuncionais).values({
        id: crypto.randomUUID(), membroId: id, funcaoId: dco!.id, casaId, ativo: true,
      })
      return id
    }
    const dentro = await criarDco(ctx.casId, 'DCO Ponto A')
    const fora = await criarDco(ctx.cas2Id, 'DCO Ponto B')
    const eventoId = crypto.randomUUID()
    await db.insert(eventos).values({
      id: eventoId, titulo: 'Reunião no Ponto A', modalidade: 'ONLINE',
      inicioEm: '2030-03-01T10:00:00.000Z', fimEm: '2030-03-01T11:00:00.000Z',
      setorId: ctx.setId, pontoAtendimentoId: pontoA, ativo: true,
    })
    const criar = await app.request('/api/v1/convocacoes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId }),
    })
    expect(criar.status).toBe(201)
    const { id } = await criar.json()
    expect((await app.request(`/api/v1/convocacoes/${id}/funcoes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcaoId: dco!.id }),
    })).status).toBe(201)
    expect((await app.request(`/api/v1/convocacoes/${id}/publicar`, { method: 'POST' })).status).toBe(200)
    const listaInicial = await (await app.request(`/api/v1/convocacoes/${id}/destinatarios`)).json() as Array<{ membroId: string }>
    expect(listaInicial.some(item => item.membroId === dentro)).toBe(true)
    expect(listaInicial.some(item => item.membroId === fora)).toBe(false)

    const dentroNovo = await criarDco(ctx.casId, 'DCO Ponto A posterior')
    const foraNovo = await criarDco(ctx.cas2Id, 'DCO Ponto B posterior')
    for (let i = 0; i < 2; i++) {
      expect((await app.request(`/api/v1/convocacoes/${id}/sincronizar-dco`, { method: 'POST' })).status).toBe(200)
    }
    const listaFinal = await (await app.request(`/api/v1/convocacoes/${id}/destinatarios`)).json() as Array<{ membroId: string }>
    expect(listaFinal.filter(item => item.membroId === dentroNovo)).toHaveLength(1)
    expect(listaFinal.some(item => item.membroId === foraNovo)).toBe(false)
    expect(listaFinal.some(item => item.membroId === fora)).toBe(false)
  })

  it('15bc. Recusa sincronização de convocação DCO encerrada sem auditoria', async () => {
    const ctx = await setupBaseData()
    const dco = await db.select().from(funcoes).where(eq(funcoes.codigo, 'DCO')).get()
    const eventoId = crypto.randomUUID()
    await db.insert(eventos).values({
      id: eventoId, titulo: 'Evento DCO encerrado', modalidade: 'ONLINE',
      inicioEm: '2020-01-01T10:00:00.000Z', fimEm: '2020-01-01T11:00:00.000Z',
      setorId: ctx.setId, ativo: true,
    })
    const created = await app.request('/api/v1/convocacoes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId }),
    })
    expect(created.status).toBe(201)
    const { id } = await created.json()
    expect((await app.request(`/api/v1/convocacoes/${id}/funcoes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcaoId: dco!.id }),
    })).status).toBe(201)
    expect((await app.request(`/api/v1/convocacoes/${id}/publicar`, { method: 'POST' })).status).toBe(200)
    const response = await app.request(`/api/v1/convocacoes/${id}/sincronizar-dco`, { method: 'POST' })
    expect(response.status).toBe(409)
    expect((await response.json()).error).toMatch(/encerrada/)
    const logs = await db.select().from(auditoriaLogs)
      .where(and(eq(auditoriaLogs.recursoId, id), eq(auditoriaLogs.acao, 'CONVOCACAO_DCO_SINCRONIZADA'))).all()
    expect(logs).toHaveLength(0)
  })

  it('15c. DCO: Casa, Administração, Regional e GT respeitam seus limites', async () => {
    const ctx = await setupBaseData()
    const dco = await db.select().from(funcoes).where(eq(funcoes.codigo, 'DCO')).get()
    expect(dco).toBeDefined()
    const adm = await db.select().from(administracoes).where(eq(administracoes.id,
      (await db.select().from(setores).where(eq(setores.id, ctx.setId)).get()).administracaoId)).get()
    const dcoId = dco!.id
    const registroConta = sqlite.prepare('SELECT id FROM contas_acesso WHERE membro_id = ?').get(ctx.mem1Id) as { id: string }
    for (const [tipo, id] of [['CASA', ctx.casId], ['ADMINISTRACAO', adm.id], ['REGIONAL', ctx.regId], ['GRUPO_TRABALHO', ctx.gtId]]) {
      sqlite.prepare("INSERT INTO acessos_conta (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id) VALUES (?, ?, 'GESTOR_AGENDA', ?, ?)")
        .run(crypto.randomUUID(), registroConta.id, tipo, id)
    }
    const outroRegional = crypto.randomUUID()
    const outraAdmin = crypto.randomUUID()
    const outroSetor = crypto.randomUUID()
    const outraCasa = crypto.randomUUID()
    await db.insert(regionais).values({ id: outroRegional, nome: 'Regional externa' })
    await db.insert(administracoes).values({ id: outraAdmin, nome: 'Admin externa', regionalId: outroRegional })
    await db.insert(setores).values({ id: outroSetor, nome: 'Setor externo', administracaoId: outraAdmin })
    await db.insert(casas).values({ id: outraCasa, nome: 'Casa externa', setorId: outroSetor })
    const membroDentro = crypto.randomUUID()
    const membroFora = crypto.randomUUID()
    await db.insert(membros).values([
      { id: membroDentro, nome: 'DCO da Regional', casaId: ctx.casId, ativo: true },
      { id: membroFora, nome: 'DCO de outra Regional', casaId: outraCasa, ativo: true },
    ])
    await db.insert(vinculosFuncionais).values([
      { id: crypto.randomUUID(), membroId: membroDentro, funcaoId: dcoId, casaId: ctx.casId, ativo: true, origem: 'MEMBRO_AUTOMATICO' },
      { id: crypto.randomUUID(), membroId: membroFora, funcaoId: dcoId, casaId: outraCasa, ativo: true, origem: 'MEMBRO_AUTOMATICO' },
    ])
    for (const [tipo, escopo] of [['casaId', ctx.casId], ['administracaoId', adm.id], ['regionalId', ctx.regId], ['grupoTrabalhoId', ctx.gtId]] as const) {
      const evId = crypto.randomUUID()
      await db.insert(eventos).values({
        id: evId, titulo: 'DCO escopo ' + tipo, modalidade: 'ONLINE',
        inicioEm: '2028-04-01T10:00:00.000Z', fimEm: '2028-04-01T11:00:00.000Z',
        [tipo]: escopo, ativo: true,
      })
      const criado = await app.request('/api/v1/convocacoes', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventoId: evId }) })
      expect(criado.status).toBe(201)
      const { id: convId } = await criado.json()
      expect((await app.request(`/api/v1/convocacoes/${convId}/funcoes`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ funcaoId: dcoId }) })).status).toBe(201)
      const publicada = await app.request(`/api/v1/convocacoes/${convId}/publicar`, { method: 'POST' })
      expect(publicada.status).toBe(200)
      const destinos = await (await app.request(`/api/v1/convocacoes/${convId}/destinatarios`)).json() as Array<{ membroId: string }>
      expect(destinos.map(d => d.membroId)).not.toContain(membroFora)
      if (tipo === 'grupoTrabalhoId') {
        expect(destinos).toHaveLength(0)
      } else {
        expect(destinos.map(d => d.membroId)).toContain(membroDentro)
      }
    }
    // Mesmo com os níveis descendentes ativos, Regional inativa não expande DCO.
    await db.update(regionais).set({ ativo: false }).where(eq(regionais.id, ctx.regId))
    const eventoInativoId = crypto.randomUUID()
    await db.insert(eventos).values({
      id: eventoInativoId, titulo: 'Regional inativa DCO', modalidade: 'ONLINE',
      inicioEm: '2028-05-01T10:00:00.000Z', fimEm: '2028-05-01T11:00:00.000Z',
      regionalId: ctx.regId, ativo: true,
    })
    const criada = await app.request('/api/v1/convocacoes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: eventoInativoId }),
    })
    expect(criada.status).toBe(201)
    const { id: convocacaoId } = await criada.json()
    expect((await app.request(`/api/v1/convocacoes/${convocacaoId}/funcoes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcaoId: dcoId }),
    })).status).toBe(201)
    expect((await app.request(`/api/v1/convocacoes/${convocacaoId}/publicar`, {
      method: 'POST',
    })).status).toBe(200)
    const destinos = await (await app.request(`/api/v1/convocacoes/${convocacaoId}/destinatarios`)).json() as Array<{ membroId: string }>
    expect(destinos.map(d => d.membroId)).not.toContain(membroDentro)
  })

  it('15d. DCO: Casa inativa não entra no snapshot e Setor dispensa Administração ativa', async () => {
    const ctx = await setupBaseData()
    const dco = await db.select().from(funcoes).where(eq(funcoes.codigo, 'DCO')).get()
    expect(dco).toBeDefined()
    const membroDco = crypto.randomUUID()
    await db.insert(membros).values({ id: membroDco, nome: 'DCO da Casa', casaId: ctx.casId, ativo: true })
    await db.insert(vinculosFuncionais).values({
      id: crypto.randomUUID(), membroId: membroDco, funcaoId: dco!.id,
      casaId: ctx.casId, origem: 'MEMBRO_AUTOMATICO', ativo: true,
    })
    const publicar = async (escopo: 'casaId' | 'setorId', id: string) => {
      const eventoId = crypto.randomUUID()
      await db.insert(eventos).values({
        id: eventoId, titulo: 'Hierarquia ativa ' + escopo, modalidade: 'ONLINE',
        inicioEm: '2028-06-01T10:00:00.000Z', fimEm: '2028-06-01T11:00:00.000Z',
        [escopo]: id, ativo: true,
      })
      const resposta = await app.request('/api/v1/convocacoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventoId }),
      })
      expect(resposta.status).toBe(201)
      const { id: convocacaoId } = await resposta.json()
      expect((await app.request(`/api/v1/convocacoes/${convocacaoId}/funcoes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcaoId: dco!.id }),
      })).status).toBe(201)
      expect((await app.request(`/api/v1/convocacoes/${convocacaoId}/publicar`, {
        method: 'POST',
      })).status).toBe(200)
      const respostaDestinos = await app.request(`/api/v1/convocacoes/${convocacaoId}/destinatarios`)
      expect(respostaDestinos.status).toBe(200)
      return (await respostaDestinos.json() as Array<{ membroId: string }>).map(d => d.membroId)
    }
    await db.update(casas).set({ ativo: false }).where(eq(casas.id, ctx.casId))
    expect(await publicar('casaId', ctx.casId)).not.toContain(membroDco)
    await db.update(casas).set({ ativo: true }).where(eq(casas.id, ctx.casId))
    const setor = await db.select().from(setores).where(eq(setores.id, ctx.setId)).get()
    await db.update(administracoes).set({ ativo: false }).where(eq(administracoes.id, setor!.administracaoId))
    expect(await publicar('setorId', ctx.setId)).toContain(membroDco)
  })

  it('18-19. alterações posteriores não alteram o snapshot gerado', async () => {
    const ctx = await setupBaseData()
    const convRes = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    const conv = await convRes.json()
    await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcaoId: ctx.f1Id }),
    })
    await app.request(`/api/v1/convocacoes/${conv.id}/publicar`, { method: 'POST' })

    // Inativar membro e vinculo original
    await db.update(membros).set({ ativo: false }).where(eq(membros.id, ctx.mem1Id))
    await db
      .update(vinculosFuncionais)
      .set({ ativo: false })
      .where(eq(vinculosFuncionais.id, ctx.v1Id))

    // A sessão padrão deste teste pertence a mem1; reativa-o apenas para consultar o snapshot.
    await db.update(membros).set({ ativo: true }).where(eq(membros.id, ctx.mem1Id))

    // Consultar snapshot
    const destRes = await app.request(`/api/v1/convocacoes/${conv.id}/destinatarios`)
    const dests = await destRes.json()
    expect(dests.length).toBe(1)
    expect(dests[0].membroId).toBe(ctx.mem1Id)
    expect(dests[0].evidencias.length).toBe(1)
    expect(dests[0].evidencias[0].funcaoId).toBe(ctx.f1Id)
    expect(dests[0].evidencias[0].vinculoFuncionalId).toBe(ctx.v1Id)
  })

  it('25. convocação possui apenas eventoId, série ignorada na tabela', async () => {
    const ctx = await setupBaseData()
    // Criar serie
    const serieId = crypto.randomUUID()
    await db.insert(seriesRecorrencia).values({
      id: serieId,
      titulo: 'Serie Teste',
      modalidade: 'PRESENCIAL',
      frequencia: 'DIARIA',
      intervalo: 1,
      dataInicio: '2026-01-01',
      dataFim: '2026-01-05',
      horarioInicio: '10:00',
      horarioFim: '11:00',
      localId: ctx.locId,
      setorId: ctx.setId,
      ativo: true,
    })
    // Atualizar evento com serie
    await db
      .update(eventos)
      .set({ serieRecorrenciaId: serieId })
      .where(eq(eventos.id, ctx.evSetorId))

    const convRes = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    const conv = await convRes.json()

    const dbConv = await db.select().from(convocacoes).where(eq(convocacoes.id, conv.id)).get()
    expect(dbConv.eventoId).toBe(ctx.evSetorId)
    // Convocação NÃO deve ter coluna serieRecorrenciaId
    expect((dbConv as any).serieRecorrenciaId).toBeUndefined()
  })

  it('26. atomicidade garante que falha na DB preserva RASCUNHO e 0 destinatarios', async () => {
    const ctx = await setupBaseData()
    const convRes = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    const conv = await convRes.json()
    await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcaoId: ctx.f1Id }),
    })

    // Inserir deliberadamente um destinatário com FK inválida para quebrar o D1 no momento da gravação

    // Como a operação usa executeAtomic, para forçar o erro a API deveria quebrar dentro do run().
    // Um jeito fácil é apagar o membroId logo antes de rodar, ou injetar uma restrição FK que vai falhar
    // O mock do sqlite não bloqueia de forma atômica da mesma maneira que D1, mas o try/catch vai processar
    // Para simplificar, farei uma restrição de quebra intencional via SQL executado.
    await db.run(
      sql`CREATE TRIGGER IF NOT EXISTS force_fail BEFORE INSERT ON convocacao_destinatarios BEGIN SELECT RAISE(ABORT, 'forced fail'); END;`
    )

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
      sqlite
        .prepare(`INSERT INTO convocacoes (id, evento_id, status) VALUES ('id1', ?, 'INVALIDO')`)
        .run(ctx.evSetorId)
      expect.fail('Deveria ter falhado na restrição CHECK')
    } catch (err: any) {
      expect(err.message).toMatch(/check_status_convocacao|CHECK constraint failed/)
    }

    // Teste de FK evento
    try {
      sqlite
        .prepare(
          `INSERT INTO convocacoes (id, evento_id, status) VALUES ('id2', 'evento-inexistente', 'RASCUNHO')`
        )
        .run()
      expect.fail('Deveria ter falhado na FK')
    } catch (err: any) {
      expect(err.message).toMatch(/FOREIGN KEY constraint failed/)
    }

    // Teste UNIQUE(convocacao_id, funcao_id)
    const convId = crypto.randomUUID()
    sqlite
      .prepare(`INSERT INTO convocacoes (id, evento_id, status) VALUES (?, ?, 'RASCUNHO')`)
      .run(convId, ctx.evSetorId)
    sqlite
      .prepare(`INSERT INTO convocacao_funcoes (id, convocacao_id, funcao_id) VALUES (?, ?, ?)`)
      .run(crypto.randomUUID(), convId, ctx.f1Id)
    try {
      sqlite
        .prepare(`INSERT INTO convocacao_funcoes (id, convocacao_id, funcao_id) VALUES (?, ?, ?)`)
        .run(crypto.randomUUID(), convId, ctx.f1Id)
      expect.fail('Deveria ter falhado no UNIQUE de função')
    } catch (err: any) {
      expect(err.message).toMatch(/UNIQUE constraint failed/)
    }

    // Teste UNIQUE do snapshot (convocacao_destinatarios_evidencias)
    const destConvId = crypto.randomUUID()
    sqlite
      .prepare(`INSERT INTO convocacoes (id, evento_id, status) VALUES (?, ?, 'RASCUNHO')`)
      .run(destConvId, ctx.evCasaId)
    const destId = crypto.randomUUID()
    sqlite
      .prepare(
        `INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id) VALUES (?, ?, ?)`
      )
      .run(destId, destConvId, ctx.mem1Id)
    sqlite
      .prepare(
        `INSERT INTO convocacao_destinatario_evidencias (id, convocacao_destinatario_id, funcao_id, vinculo_funcional_id) VALUES (?, ?, ?, ?)`
      )
      .run(crypto.randomUUID(), destId, ctx.f1Id, ctx.v1Id)
    try {
      sqlite
        .prepare(
          `INSERT INTO convocacao_destinatario_evidencias (id, convocacao_destinatario_id, funcao_id, vinculo_funcional_id) VALUES (?, ?, ?, ?)`
        )
        .run(crypto.randomUUID(), destId, ctx.f1Id, ctx.v1Id)
      expect.fail('Deveria ter falhado no UNIQUE do snapshot (evidencias)')
    } catch (err: any) {
      expect(err.message).toMatch(/UNIQUE constraint failed/)
    }
  })

  it('28. OCC garante que estado alterado evita publicação de snapshot obsoleto', async () => {
    const ctx = await setupBaseData()
    const convRes = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    const conv = await convRes.json()
    await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcaoId: ctx.f1Id }),
    })

    // Para simular a concorrência (estado alterado ANTES do commit final),
    // vamos interceptar o db.batch/transaction (executeAtomic) localmente
    // alterando o updated_at no banco de dados na surdina, para que a query do OCC falhe.

    // Adiciona um trigger temporário que dispara ANTES do update otimista da convocacao
    // alterando a própria tabela convocacoes (isso simula que outro processo alterou o status/updatedAt
    // logoo após o select e antes do executeAtomic processar a atualização otimista).
    // O SQLite não permite atualizar a mesma tabela no trigger BEFORE UPDATE dela mesma,
    // mas como a nossa cláusula de OCC usa `updated_at = (valor lido)`,
    // podemos simplesmente forçar o valor lido ser falso.

    // Como a rota usa executeAtomic (que no better-sqlite3 mapeia para db.transaction),
    // vamos interceptar db.transaction para garantir que a alteração concorrente ocorra
    // no momento exato em que o batch seria iniciado.
    const originalTransaction = db.transaction.bind(db)
    let interceptado = false
    db.transaction = (...args: any[]) => {
      if (!interceptado) {
        interceptado = true
        // Simulando que ALGUÉM alterou o updatedAt no banco ANTES do commit final do lote
        sqlite
          .prepare(`UPDATE convocacoes SET updated_at = '2099-01-01T00:00:00.000Z' WHERE id = ?`)
          .run(conv.id)
      }
      return originalTransaction(...args)
    }

    try {
      const pubRes = await app.request(`/api/v1/convocacoes/${conv.id}/publicar`, {
        method: 'POST',
      })
      expect(pubRes.status).toBe(409) // OCC Abort
      const pubBody = await pubRes.json()
      expect(pubBody.error).toMatch(/Conflito: a convocação foi alterada/)
    } finally {
      // Restaurar mock independentemente de erro no assert
      db.transaction = originalTransaction
    }

    // Confirmar que nada mudou
    const getRes = await app.request(`/api/v1/convocacoes/${conv.id}`)
    expect((await getRes.json()).status).toBe('RASCUNHO')

    const destRes = await app.request(`/api/v1/convocacoes/${conv.id}/destinatarios`)
    expect((await destRes.json()).length).toBe(0)

    // Confirmar DIRETAMENTE no banco de dados (zero rows em ambas as tabelas)
    const countDests = sqlite
      .prepare(`SELECT count(*) as c FROM convocacao_destinatarios WHERE convocacao_id = ?`)
      .get(conv.id) as any
    expect(countDests.c).toBe(0)

    const countEvidencias = sqlite
      .prepare(
        `
      SELECT count(*) as c 
      FROM convocacao_destinatario_evidencias e
      JOIN convocacao_destinatarios d ON e.convocacao_destinatario_id = d.id
      WHERE d.convocacao_id = ?
    `
      )
      .get(conv.id) as any
    expect(countEvidencias.c).toBe(0)
  })

  it('PA-06: vinculo exclusivo, transferencia auditada e protecoes territoriais', async () => {
    const ctx = await setupBaseData()
    const paA = crypto.randomUUID()
    const paB = crypto.randomUUID()
    await db.insert(pontosAtendimento).values([
      { id: paA, nome: 'Ponto A transferencias', setorId: ctx.setId },
      { id: paB, nome: 'Ponto B transferencias', setorId: ctx.setId },
    ])
    // A configuração de base usa GESTOR_AGENDA, sem permissão para administrar estrutura.
    // Conceder administrador regional somente neste cenário de teste.
    const conta = sqlite.prepare('SELECT conta_acesso_id AS id FROM acessos_conta WHERE perfil_codigo=? AND escopo_id=? ORDER BY rowid DESC LIMIT 1')
      .get('GESTOR_AGENDA', ctx.setId) as { id: string }
    // Administrador regional exige ciência formal do PMO; usar MASTER no teste
    // de sucesso e validar a negativa do GESTOR_AGENDA antes de concedê-lo.
    const semPermissao = await app.request(`/api/v1/pontos-atendimento/${paA}/casas/${ctx.casId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    expect(semPermissao.status).toBe(403)
    sqlite.prepare("INSERT INTO acessos_conta (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id) VALUES (?, ?, 'MASTER_SISTEMA', 'GLOBAL', NULL)")
      .run(crypto.randomUUID(), conta.id)
    // Vincular a sessão de teste à conta que recebeu o perfil Master.
    sqlite.prepare('UPDATE sessoes SET conta_acesso_id=? WHERE token_hash=?')
      .run(conta.id, await hashToken(tokenSessaoAtual))
    const vincular = (id: string, casaId: string) => app.request(
      `/api/v1/pontos-atendimento/${id}/casas/${casaId}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    )
    const transferir = (id: string, casaId: string, origemPontoId: string, motivo: string) => app.request(
      `/api/v1/pontos-atendimento/${id}/casas/${casaId}/transferir`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origemPontoId, motivo }) },
    )
    expect((await vincular(paA, ctx.casId)).status).toBe(200)
    expect((await vincular(paB, ctx.casId)).status).toBe(409)
    expect((await transferir(paB, ctx.casId, paA, 'Redistribuicao territorial')).status).toBe(200)
    expect(sqlite.prepare('SELECT ponto_atendimento_id AS pa FROM casas WHERE id=?')
      .get(ctx.casId)).toMatchObject({ pa: paB })
    const desvincular = await app.request(`/api/v1/pontos-atendimento/${paB}/casas/${ctx.casId}/desvincular`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: 'Redistribuicao para outro Setor' }),
    })
    expect(desvincular.status).toBe(200)
    expect(sqlite.prepare('SELECT ponto_atendimento_id AS pa FROM casas WHERE id=?')
      .get(ctx.casId)).toMatchObject({ pa: null })
    expect((await vincular(paA, ctx.casId)).status).toBe(200)
    expect(sqlite.prepare("SELECT COUNT(*) AS total FROM auditoria_logs WHERE recurso_id=? AND acao='CASA_DESVINCULADA_PONTO'")
      .get(ctx.casId)).toMatchObject({ total: 1 })
    expect((await transferir(paB, ctx.casId, paB, 'Origem desatualizada')).status).toBe(409)
    expect((await transferir(paB, ctx.casId, paA, 'x')).status).toBe(400)
    const outroSetor = crypto.randomUUID()
    await db.insert(setores).values({ id: outroSetor, nome: 'Outro setor PA-06', administracaoId: (await db.select().from(administracoes).where(eq(administracoes.id, (await db.select().from(setores).where(eq(setores.id, ctx.setId)).get()).administracaoId)).get()).id })
    const paExterno = crypto.randomUUID()
    await db.insert(pontosAtendimento).values({ id: paExterno, nome: 'Ponto outro setor', setorId: outroSetor })
    expect((await transferir(paExterno, ctx.casId, paA, 'Transferencia proibida')).status).toBe(400)
    expect(sqlite.prepare("SELECT COUNT(*) AS total FROM auditoria_logs WHERE recurso_id=? AND acao='CASA_TRANSFERIDA_PONTO'")
      .get(ctx.casId)).toMatchObject({ total: 1 })
  })

  it('PA-07: Master autoriza Casa de outro Setor sem modificar Setor institucional', async () => {
    const ctx = await setupBaseData()
    const outroSetor = crypto.randomUUID()
    await db.insert(setores).values({ id: outroSetor, nome: 'Setor excepcional',
      administracaoId: (await db.select().from(setores).where(eq(setores.id, ctx.setId)).get()).administracaoId })
    const pontoCentro = crypto.randomUUID()
    await db.insert(pontosAtendimento).values({ id: pontoCentro, setorId: ctx.setId, nome: 'Ponto de destino excepcional' })
    await db.update(casas).set({ setorId: outroSetor }).where(eq(casas.id, ctx.cas2Id))
    const url = '/api/v1/pontos-atendimento/excecoes-intersetoriais'
    const request = () => app.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ casaId: ctx.cas2Id, pontoAtendimentoId: pontoCentro, motivo: 'Atendimento excepcional autorizado' }) })
    expect((await request()).status).toBe(403)
    const conta = sqlite.prepare('SELECT conta_acesso_id AS id FROM acessos_conta WHERE perfil_codigo=? AND escopo_id=? ORDER BY rowid DESC LIMIT 1')
      .get('GESTOR_AGENDA', ctx.setId) as { id: string }
    sqlite.prepare("INSERT INTO acessos_conta (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id) VALUES (?, ?, 'MASTER_SISTEMA', 'GLOBAL', NULL)")
      .run(crypto.randomUUID(), conta.id)
    sqlite.prepare('UPDATE sessoes SET conta_acesso_id=? WHERE token_hash=?')
      .run(conta.id, await hashToken(tokenSessaoAtual))
    expect((await request()).status).toBe(201)
    expect(sqlite.prepare('SELECT setor_id AS setor, ponto_atendimento_id AS ponto FROM casas WHERE id=?')
      .get(ctx.cas2Id)).toMatchObject({ setor: outroSetor, ponto: pontoCentro })
    expect((await request()).status).toBe(409)
    expect(sqlite.prepare("SELECT COUNT(*) AS total FROM auditoria_logs WHERE recurso_id=? AND acao='CASA_PONTO_EXCECAO_INTERSETORIAL'")
      .get(ctx.cas2Id)).toMatchObject({ total: 1 })
  })

  it('PA-05: aborta publicacao se o Ponto mudar apos selecionar destinatarios', async () => {
    const ctx = await setupBaseData()
    const paA = crypto.randomUUID()
    const paB = crypto.randomUUID()
    await db.insert(pontosAtendimento).values([
      { id: paA, nome: 'PA concorrencia A', setorId: ctx.setId },
      { id: paB, nome: 'PA concorrencia B', setorId: ctx.setId },
    ])
    await db.update(eventos).set({ pontoAtendimentoId: paA }).where(eq(eventos.id, ctx.evSetorId))
    const criado = await app.request('/api/v1/convocacoes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    expect(criado.status).toBe(201)
    const { id } = await criado.json()
    expect((await app.request(`/api/v1/convocacoes/${id}/funcoes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcaoId: ctx.f1Id }),
    })).status).toBe(201)
    const originalTransaction = db.transaction.bind(db)
    let interceptado = false
    db.transaction = (...args: any[]) => {
      if (!interceptado) {
        interceptado = true
        sqlite.prepare('UPDATE eventos SET ponto_atendimento_id = ? WHERE id = ?')
          .run(paB, ctx.evSetorId)
      }
      return originalTransaction(...args)
    }
    try {
      const resposta = await app.request(`/api/v1/convocacoes/${id}/publicar`, { method: 'POST' })
      expect(resposta.status).toBe(409)
      expect(interceptado).toBe(true)
    } finally {
      db.transaction = originalTransaction
    }
    expect(sqlite.prepare('SELECT status FROM convocacoes WHERE id = ?').get(id))
      .toMatchObject({ status: 'RASCUNHO' })
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM convocacao_destinatarios WHERE convocacao_id = ?')
      .get(id)).toMatchObject({ total: 0 })
  })

  it('29. publicação autenticada registra o ator da sessão e ignora header forjado', async () => {
    const ctx = await setupBaseData()
    const convRes = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    const conv = await convRes.json()
    await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcaoId: ctx.f1Id }),
    })

    const pubRes = await app.request(`/api/v1/convocacoes/${conv.id}/publicar`, {
      method: 'POST',
      headers: { 'x-membro-id': crypto.randomUUID() },
    })
    expect(pubRes.status).toBe(200)

    const log = await db
      .select()
      .from(auditoriaLogs)
      .where(and(
        eq(auditoriaLogs.recursoId, conv.id),
        eq(auditoriaLogs.acao, 'CONVOCACAO_PUBLICADA')
      ))
      .get()
    expect(log?.acao).toBe('CONVOCACAO_PUBLICADA')
    expect(log?.atorMembroId).toBe(ctx.mem1Id)
  })

  it('30. cancelamento autenticado registra o ator da sessão', async () => {
    const ctx = await setupBaseData()
    const convRes = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    const conv = await convRes.json()

    const cancelRes = await app.request(`/api/v1/convocacoes/${conv.id}/cancelar`, {
      method: 'POST',
    })
    expect(cancelRes.status).toBe(200)

    const log = await db
      .select()
      .from(auditoriaLogs)
      .where(and(
        eq(auditoriaLogs.recursoId, conv.id),
        eq(auditoriaLogs.acao, 'CONVOCACAO_CANCELADA')
      ))
      .get()
    expect(log?.acao).toBe('CONVOCACAO_CANCELADA')
    expect(log?.atorMembroId).toBe(ctx.mem1Id)
  })

  it('31. publicação e cancelamento sem sessão retornam 401', async () => {
    const ctx = await setupBaseData()
    const convRes = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    const conv = await convRes.json()

    expect(
      (await requestSemSessao(`/api/v1/convocacoes/${conv.id}/publicar`, { method: 'POST' })).status
    ).toBe(401)
    expect(
      (await requestSemSessao(`/api/v1/convocacoes/${conv.id}/cancelar`, { method: 'POST' })).status
    ).toBe(401)
  })

  it('Acompanhamento RSVP - 401 sem sessão, 403 membro não autorizado', async () => {
    const ctx = await setupBaseData()
    const cRes = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    const conv = await cRes.json()

    await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcaoId: ctx.f1Id }),
    })
    await app.request(`/api/v1/convocacoes/${conv.id}/publicar`, { method: 'POST' })

    expect((await requestSemSessao(`/api/v1/convocacoes/${conv.id}/acompanhamento-rsvp`)).status).toBe(401)
    
    const memUnauthorizedId = crypto.randomUUID()
    const token2 = crypto.randomUUID()
    await db.insert(membros).values({ id: memUnauthorizedId, nome: 'Sem Permissao', casaId: ctx.casId, ativo: true, autenticacaoAtiva: true })
    await db.insert(sessoes).values({
      id: crypto.randomUUID(),
      membroId: memUnauthorizedId,
      tokenHash: await hashToken(token2),
      expiraEm: '2030-01-01T00:00:00.000Z',
      createdAt: new Date().toISOString()
    })

    const reqUnauth = await requestSemSessao(`/api/v1/convocacoes/${conv.id}/acompanhamento-rsvp`, {
      headers: { 'Authorization': `Bearer ${token2}` }
    })
    expect(reqUnauth.status).toBe(403)
  })

  it('Acompanhamento RSVP - RASCUNHO/CANCELADA retorna erro', async () => {
    const ctx = await setupBaseData()
    const cRes = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    const conv = await cRes.json()

    const reqRascunho = await app.request(`/api/v1/convocacoes/${conv.id}/acompanhamento-rsvp`)
    expect(reqRascunho.status).toBe(400)
    expect(await reqRascunho.json()).toMatchObject({ error: 'Acompanhamento disponível apenas para convocações PUBLICADAS' })
  })

  it('Acompanhamento RSVP - preserva snapshot histórico após editar função e vínculo', async () => {
    const ctx = await setupBaseData()

    const cRes = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    const conv = await cRes.json()

    await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcaoId: ctx.f1Id }),
    })
    await app.request(`/api/v1/convocacoes/${conv.id}/publicar`, { method: 'POST' })

    const antes = await app.request(`/api/v1/convocacoes/${conv.id}/acompanhamento-rsvp`)
    const bodyAntes = await antes.json()
    expect(bodyAntes.data[0].vinculo).toMatchObject({
      funcaoNome: 'F1',
      vinculoFuncionalId: ctx.v1Id,
    })

    await db.update(funcoes)
      .set({ nome: 'F1 renomeada' })
      .where(eq(funcoes.id, ctx.f1Id))
    await db.update(vinculosFuncionais)
      .set({
        setorId: null,
        regionalId: ctx.regId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(vinculosFuncionais.id, ctx.v1Id))

    const depois = await app.request(`/api/v1/convocacoes/${conv.id}/acompanhamento-rsvp`)
    const bodyDepois = await depois.json()

    expect(bodyDepois.data[0].vinculo).toMatchObject({
      funcaoNome: 'F1',
      vinculoFuncionalId: ctx.v1Id,
    })
  })

  it('Acompanhamento RSVP - organizador obtém dados com SEM_RESPOSTA, paginação, filtro e sem justificativa', async () => {
    const ctx = await setupBaseData()
    
    const cRes = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventoId: ctx.evSetorId }),
    })
    const conv = await cRes.json()
    await app.request(`/api/v1/convocacoes/${conv.id}/funcoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcaoId: ctx.f1Id }),
    })
    await app.request(`/api/v1/convocacoes/${conv.id}/publicar`, { method: 'POST' })

    const reqAll = await app.request(`/api/v1/convocacoes/${conv.id}/acompanhamento-rsvp`)
    expect(reqAll.status).toBe(200)
    let body = await reqAll.json()

    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data[0].respostaRsvp).toBe('SEM_RESPOSTA')
    expect(body.data[0]).not.toHaveProperty('justificativa')
    expect(body.data[0].evidencias.length).toBeGreaterThan(0)
    expect(body.data[0].vinculo).toMatchObject({
      funcaoId: ctx.f1Id,
      vinculoFuncionalId: expect.any(String),
    })
    expect(body.data[0].vinculo.funcaoNome).toEqual(expect.any(String))

    const reqFiltroSemResp = await app.request(`/api/v1/convocacoes/${conv.id}/acompanhamento-rsvp?statusRsvp=SEM_RESPOSTA`)
    expect((await reqFiltroSemResp.json()).data.length).toBe(body.data.length)

    const reqFiltroPart = await app.request(`/api/v1/convocacoes/${conv.id}/acompanhamento-rsvp?statusRsvp=PARTICIPAREI`)
    expect((await reqFiltroPart.json()).data.length).toBe(0)

    const reqPag = await app.request(`/api/v1/convocacoes/${conv.id}/acompanhamento-rsvp?limit=1`)
    body = await reqPag.json()
    expect(body.data.length).toBe(1)
  })
})

import { sql } from 'drizzle-orm'
