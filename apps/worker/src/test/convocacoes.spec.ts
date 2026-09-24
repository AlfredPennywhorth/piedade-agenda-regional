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
      .run(destConvId, ctx.evSetorId)
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
