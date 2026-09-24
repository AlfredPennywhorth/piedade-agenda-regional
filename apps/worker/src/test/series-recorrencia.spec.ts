import { describe, it, expect, beforeEach } from 'vitest'
import { Database } from 'better-sqlite3'
import { setupDb } from './setup'
import { createApp } from '../index'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import BetterSqlite3 from 'better-sqlite3'
import { regionais, locais, eventos, seriesRecorrencia, administracoes, setores, casas, membros, sessoes } from '../db/schema'
import { eq } from 'drizzle-orm'
import { hashToken } from '../security/tokens'

import { createUtcDateFromSaoPaulo, getLocalDateFromUtc } from '@piedade/shared'

describe('Series Recorrencia API (S05)', () => {
  let sqlite: Database
  let db: any
  let app: any
  let token: string

  beforeEach(async () => {
    sqlite = new BetterSqlite3(':memory:')
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

  const basePayload = {
    titulo: 'Reunião Diária',
    modalidade: 'ONLINE',
    urlOnline: 'https://meet.google.com/abc',
    horarioInicio: '09:00',
    horarioFim: '10:00',
    dataInicio: '2026-09-01',
    dataFim: '2026-09-05',
    frequencia: 'DIARIA',
    intervalo: 1
  }

  it('0. exige autenticação nas rotas de séries recorrentes', async () => {
    const response = await app.request('/api/v1/series-recorrencia')
    expect(response.status).toBe(401)
  })

  it('1. criar série diária', async () => {
    const regionalId = await createRegional()
    const res = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, regionalId })
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.generatedOccurrences).toBe(5) // 1 to 5 inclusive

    const audit = sqlite.prepare(
      "SELECT acao, recurso_tipo FROM auditoria_logs WHERE recurso_id = ?"
    ).get(json.serie.id) as any
    expect(audit.acao).toBe('SERIE_RECORRENCIA_CRIADA')
    expect(audit.recurso_tipo).toBe('SERIE_RECORRENCIA')
  })

  it('2. criar série semanal', async () => {
    const regionalId = await createRegional()
    const res = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        frequencia: 'SEMANAL',
        diaSemana: 2, // Terça-feira (2026-09-01 é Terça)
        dataFim: '2026-09-30',
        regionalId
      })
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.generatedOccurrences).toBe(5) // Dias 1, 8, 15, 22, 29
  })

  it('3. criar série quinzenal', async () => {
    const regionalId = await createRegional()
    const res = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        frequencia: 'QUINZENAL',
        diaSemana: 2,
        dataFim: '2026-09-30',
        regionalId
      })
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.generatedOccurrences).toBe(3) // Dias 1, 15, 29
  })

  it('4. criar mensal por dia fixo', async () => {
    const regionalId = await createRegional()
    const res = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        frequencia: 'MENSAL_DIA_FIXO',
        diaMes: 15,
        dataFim: '2026-11-30',
        regionalId
      })
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.generatedOccurrences).toBe(3) // Set 15, Out 15, Nov 15
  })

  it('5. criar mensal por posição na semana', async () => {
    const regionalId = await createRegional()
    const res = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        frequencia: 'MENSAL_POSICAO_SEMANA',
        diaSemana: 0, // Domingo
        posicaoSemanaMes: 1, // Primeiro
        dataFim: '2026-11-30',
        regionalId
      })
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.generatedOccurrences).toBe(3) // 1st sunday of Sept, Oct, Nov
  })

  it('5.1 rejeitar intervalo diferente de 1', async () => {
    const regionalId = await createRegional()
    const res = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, regionalId, intervalo: 2 })
    })
    expect(res.status).toBe(400)
  })

  it('5.2 rejeitar série com > 400 ocorrências sem persistir nada', async () => {
    const regionalId = await createRegional()
    const oldCountSeries = db.select().from(seriesRecorrencia).all().length
    const oldCountEvents = db.select().from(eventos).all().length

    const res = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ...basePayload, 
        regionalId, 
        dataInicio: '2026-01-01', 
        dataFim: '2028-01-01' // 2 anos diarios > 700 dias > 400 
      })
    })
    
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/400 ocorrências/)
    
    const newCountSeries = db.select().from(seriesRecorrencia).all().length
    const newCountEvents = db.select().from(eventos).all().length
    expect(newCountSeries).toBe(oldCountSeries)
    expect(newCountEvents).toBe(oldCountEvents)
  })


  it('6. rejeitar série sem data final', async () => {
    const regionalId = await createRegional()
    const payload = { ...basePayload, regionalId }
    delete (payload as any).dataFim
    const res = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    expect(res.status).toBe(400)
  })

  it('7. rejeitar data final anterior à inicial', async () => {
    const regionalId = await createRegional()
    const res = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        dataInicio: '2026-09-10',
        dataFim: '2026-09-01',
        regionalId
      })
    })
    expect(res.status).toBe(400)
  })

  it('8. materializar número correto de ocorrências', async () => {
    const regionalId = await createRegional()
    const res = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, regionalId, dataFim: '2026-09-10' }) // 1 to 10
    })
    const json = await res.json()
    expect(json.generatedOccurrences).toBe(10)
    const evs = db.select().from(eventos).all()
    expect(evs.length).toBe(10)
  })

  it('9. ocorrências com IDs próprios', async () => {
    const regionalId = await createRegional()
    await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, regionalId }) // 5 
    })
    const evs = db.select().from(eventos).all()
    const ids = new Set(evs.map((e: any) => e.id))
    expect(ids.size).toBe(5)
  })

  it('10. ocorrências vinculadas à série', async () => {
    const regionalId = await createRegional()
    const res = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, regionalId })
    })
    const json = await res.json()
    const serieId = json.serie.id
    const evs = db.select().from(eventos).all()
    evs.forEach((e: any) => {
      expect(e.serieRecorrenciaId).toBe(serieId)
    })
  })

  it('11 e 12. timezone IANA America/Sao_Paulo nativo', async () => {
    const dIso = createUtcDateFromSaoPaulo('2026-09-01', '09:00')
    // A implementação nativa deve produzir 2026-09-01T12:00:00.000Z para SP sem horário de verão (2026)
    expect(dIso.includes('T12:00:00.000')).toBe(true)
    const local = getLocalDateFromUtc(dIso)
    expect(local).toBe('2026-09-01')
  })

  it('13. cada ocorrência mantém exatamente um escopo', async () => {
    const regionalId = await createRegional()
    await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, regionalId })
    })
    // Se passou é porque não quebrou a constraint do D1
    const evs = db.select().from(eventos).all()
    expect(evs[0].regionalId).toBe(regionalId)
    expect(evs[0].setorId).toBe(null)
  })

  it('14. evento não recorrente continua válido com serie_recorrencia_id null', async () => {
    const regionalId = await createRegional()
    const res = await req('/api/v1/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Avulso',
        modalidade: 'ONLINE',
        urlOnline: 'https://x.com',
        inicioEm: '2026-09-01T10:00:00Z',
        fimEm: '2026-09-01T12:00:00Z',
        regionalId
      })
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.serieRecorrenciaId).toBeNull()
  })

  it('15. inativar uma ocorrência não inativa as demais', async () => {
    const regionalId = await createRegional()
    await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, regionalId }) // 5
    })
    const evs = db.select().from(eventos).all()
    const firstEvId = evs[0].id

    // Rota de evento normal atualizando pra ativo = false (SOMENTE ESTA)
    await req(`/api/v1/eventos/${firstEvId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: false })
    })

    const updatedEvs = db.select().from(eventos).all()
    const ev = updatedEvs.find((e: any) => e.id === firstEvId)
    const others = updatedEvs.filter((e: any) => e.id !== firstEvId)
    
    expect(ev.ativo).toBe(false)
    expect(ev.recorrenciaExcecao).toBe(true)
    expect(others.every((o: any) => o.ativo === true)).toBe(true)
  })

  it('16, 17, 18. alterar ALL (não apaga, preserva exceção, evita duplicação)', async () => {
    const regionalId = await createRegional()
    const postRes = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, regionalId, dataInicio: '2099-09-01', dataFim: '2099-09-05' })
    })
    const serieId = (await postRes.json()).serie.id
    const evs = db.select().from(eventos).all()
    
    // SOMENTE ESTA -> via eventos PATCH, o que torna ela uma exceção
    const targetEv = evs[2] // dia 3
    await req(`/api/v1/eventos/${targetEv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: 'Exceção' })
    })

    // TODA A SERIE -> via series PATCH, altera a série inteira (menos a exceção)
    const patchRes = await req(`/api/v1/series-recorrencia/${serieId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updateMode: 'ALL',
        changes: { titulo: 'Novo ALL', ativo: true } 
      })
    })
    expect(patchRes.status).toBe(200)

    const updatedEvs = db.select().from(eventos).all()
    
    // Quantidade total de registros não diminui, aumenta! 
    // Tinhamos 5. 1 virou exceção. 4 normais (dias 1,2,4,5).
    // O ALL inativou (ativo=false) os 4 normais e criou 4 novos normais. 
    // Total no banco = 9 eventos agora (4 inativos + 4 ativos normais + 1 exceção).
    expect(updatedEvs.length).toBe(9)
    
    const excecao = updatedEvs.find((e: any) => e.id === targetEv.id)
    expect(excecao.titulo).toBe('Exceção')
    expect(excecao.ativo).toBe(true)
    
    const novosAtivos = updatedEvs.filter((e: any) => e.serieRecorrenciaId === serieId && e.ativo && !e.recorrenciaExcecao)
    expect(novosAtivos.length).toBe(4)
    expect(novosAtivos[0].titulo).toBe('Novo ALL')
    
    // Nenhuma ocorrência é apagada fisicamente
    const velhosInativos = updatedEvs.filter((e: any) => e.serieRecorrenciaId === serieId && !e.ativo && !e.recorrenciaExcecao)
    expect(velhosInativos.length).toBe(4)
    
    // Duplicação de slot lógico não pode acontecer (o dia da exceção não deve ter um "Novo ALL" ativo)
    const dia3HasNovoAll = novosAtivos.some((e: any) => e.inicioEm === targetEv.inicioEm)
    expect(dia3HasNovoAll).toBe(false)
  })

  it('19. ESTA E AS PRÓXIMAS divide a série corretamente e não apaga fisicamente', async () => {
    const regionalId = await createRegional()
    const postRes = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, regionalId, dataInicio: '2026-09-01', dataFim: '2026-09-10' })
    })
    const serieId = (await postRes.json()).serie.id
    
    const evs = db.select().from(eventos).all()
    const evTarget = evs.find((e: any) => e.inicioEm.includes('2026-09-06')) // Ocorrência do dia 06
    
    const patchRes = await req(`/api/v1/series-recorrencia/${serieId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updateMode: 'THIS_AND_FUTURE',
        fromEventId: evTarget.id,
        changes: { titulo: 'Novo Título Futuro' }
      })
    })
    expect(patchRes.status).toBe(200)
    
    const json = await patchRes.json()
    const newSerieId = json.novaSerieId
    
    const series = db.select().from(seriesRecorrencia).all()
    expect(series.length).toBe(2)
    
    const allEvs = db.select().from(eventos).all()
    const oldEvs = allEvs.filter((e: any) => e.serieRecorrenciaId === serieId)
    const newEvs = allEvs.filter((e: any) => e.serieRecorrenciaId === newSerieId)
    
    // Dia 1 a 5 devem estar na velha
    expect(oldEvs.filter((e:any) => e.ativo).length).toBe(5)
    // Ocorrências normais do futuro (dia 6 a 10) que estavam na velha foram inativadas, e 5 novas ativas criadas
    const novasAtivas = newEvs.filter((e:any) => e.ativo)
    expect(novasAtivas.length).toBe(5)
    expect(novasAtivas[0].titulo).toBe('Novo Título Futuro')
    const velhasInativas = oldEvs.filter((e:any) => !e.ativo)
    expect(velhasInativas.length).toBe(5) // não apagou fisicamente
  })

  describe('Regressivos THIS (via /api/v1/series-recorrencia)', () => {
    let regionalId: string
    let serieId: string
    let evId: string

    beforeEach(async () => {
      regionalId = await createRegional()
      const postRes = await req('/api/v1/series-recorrencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...basePayload, regionalId, dataInicio: '2026-09-01', dataFim: '2026-09-01' })
      })
      const json = await postRes.json()
      serieId = json.serie.id
      const evs = db.select().from(eventos).where(eq(eventos.serieRecorrenciaId, serieId)).all()
      evId = evs[0].id
    })

    it('20. THIS: alteração válida', async () => {
      const res = await req(`/api/v1/series-recorrencia/${serieId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updateMode: 'THIS', fromEventId: evId, changes: { titulo: 'Novo Titulo Unico' } })
      })
      expect(res.status).toBe(200)
    })

    it('21. THIS: fim <= início falha', async () => {
      const res = await req(`/api/v1/series-recorrencia/${serieId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updateMode: 'THIS', fromEventId: evId, changes: { fimEm: '2026-09-01T08:00:00Z' } })
      })
      expect(res.status).toBe(400)
    })

    it('22. THIS: segundo escopo falha', async () => {
      const adminId = crypto.randomUUID()
      await db.insert(administracoes).values({ id: adminId, nome: 'Adm', regionalId }).run()

      const res = await req(`/api/v1/series-recorrencia/${serieId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updateMode: 'THIS', fromEventId: evId, changes: { administracaoId: adminId } })
      })
      expect(res.status).toBe(400) // Regra do Zod do EventoCreate veta dois escopos
    })

    it('23. THIS: ONLINE com local falha', async () => {
      const localId = crypto.randomUUID()
      await db.insert(locais).values({ id: localId, nome: 'L', endereco: 'E', numero: '1', cidade: 'SP', uf: 'SP' }).run()

      const res = await req(`/api/v1/series-recorrencia/${serieId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updateMode: 'THIS', fromEventId: evId, changes: { localId } })
      })
      expect(res.status).toBe(400)
    })
  })

  it('24. constraint/FK de série validada diretamente no SQLite', () => {
    // A constraint check_serie_escopo_unico foi testada no it('13').
    // Para testar FK:
    expect(() => {
      db.insert(eventos).values({
        id: '123',
        titulo: 'T',
        modalidade: 'ONLINE',
        inicioEm: '2026-09-01T10:00:00Z',
        fimEm: '2026-09-01T11:00:00Z',
        urlOnline: 'https://a.com',
        regionalId: '123', // fk constraint falha pq nao existe regional 123
        serieRecorrenciaId: 'fake' // fk constraint
      }).run()
    }).toThrow(/FOREIGN KEY constraint failed/)
  })
  
  it('24.1 rejeita data inexistente no calendário', async () => {
    const regionalId = await createRegional()
    const res = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        regionalId,
        dataInicio: '2026-02-30',
        dataFim: '2026-03-05',
      }),
    })

    expect(res.status).toBe(400)
  })

  it('24.2 ALL com ativo=false preserva outras alterações enviadas', async () => {
    const regionalId = await createRegional()
    const createRes = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        titulo: 'Título Original',
        regionalId,
        dataInicio: '2099-01-01',
        dataFim: '2099-01-03',
      }),
    })
    const { serie } = await createRes.json()

    const patchRes = await req(`/api/v1/series-recorrencia/${serie.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updateMode: 'ALL',
        changes: { ativo: false, titulo: 'Título Atualizado' },
      }),
    })
    expect(patchRes.status).toBe(200)

    const persistida = db.select().from(seriesRecorrencia)
      .where(eq(seriesRecorrencia.id, serie.id)).get()
    expect(persistida.ativo).toBe(false)
    expect(persistida.titulo).toBe('Título Atualizado')
  })

  it('24.3 ALL não recria o slot original de exceção movida', async () => {
    const regionalId = await createRegional()
    const createRes = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        regionalId,
        dataInicio: '2099-09-01',
        dataFim: '2099-09-05',
      }),
    })
    const { serie } = await createRes.json()

    const ocorrencias = db.select().from(eventos)
      .where(eq(eventos.serieRecorrenciaId, serie.id)).all()
    const original = ocorrencias[2]
    const slotOriginal = original.inicioEm
    const novoInicio = '2099-09-10T12:00:00.000Z'
    const novoFim = '2099-09-10T13:00:00.000Z'

    const mover = await req(`/api/v1/series-recorrencia/${serie.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updateMode: 'THIS',
        fromEventId: original.id,
        changes: { inicioEm: novoInicio, fimEm: novoFim },
      }),
    })
    expect(mover.status).toBe(200)

    const movida = db.select().from(eventos).where(eq(eventos.id, original.id)).get()
    expect(movida.recorrenciaExcecao).toBe(true)
    expect(movida.recorrenciaOrigemInicioEm).toBe(slotOriginal)
    expect(movida.inicioEm).toBe(novoInicio)

    const atualizar = await req(`/api/v1/series-recorrencia/${serie.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updateMode: 'ALL',
        changes: { titulo: 'Série atualizada' },
      }),
    })
    expect(atualizar.status).toBe(200)

    const ativos = db.select().from(eventos)
      .where(eq(eventos.serieRecorrenciaId, serie.id)).all()
      .filter((item: any) => item.ativo)

    expect(ativos.filter((item: any) => item.inicioEm === slotOriginal)).toHaveLength(0)
    expect(ativos.find((item: any) => item.id === original.id)?.inicioEm).toBe(novoInicio)
  })

  it('24.4 dividir na primeira ocorrência inativa a série antiga sem intervalo inválido', async () => {
    const regionalId = await createRegional()
    const createRes = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        regionalId,
        dataInicio: '2099-10-01',
        dataFim: '2099-10-05',
      }),
    })
    const { serie } = await createRes.json()

    const primeira = db.select().from(eventos)
      .where(eq(eventos.serieRecorrenciaId, serie.id)).all()[0]

    const split = await req(`/api/v1/series-recorrencia/${serie.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updateMode: 'THIS_AND_FUTURE',
        fromEventId: primeira.id,
        changes: { titulo: 'Nova série desde o início' },
      }),
    })
    expect(split.status).toBe(200)

    const antiga = db.select().from(seriesRecorrencia)
      .where(eq(seriesRecorrencia.id, serie.id)).get()
    expect(antiga.ativo).toBe(false)
    expect(antiga.dataFim >= antiga.dataInicio).toBe(true)
  })

  it('25. ALL com ativo=false inativa série e eventos futuros sem apagar ou regenerar', async () => {
    // 1. Criar série futura distante para isolar do relógio (2099)
    const regionalId = await createRegional()
    const createRes = await req('/api/v1/series-recorrencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Série Inativação Teste',
        modalidade: 'ONLINE',
        urlOnline: 'https://meet.google.com/test',
        horarioInicio: '09:00',
        horarioFim: '10:00',
        dataInicio: '2099-01-01',
        dataFim: '2099-01-05',
        frequencia: 'DIARIA',
        intervalo: 1,
        regionalId
      })
    })
    expect(createRes.status).toBe(201)
    const { serie } = await createRes.json()
    const serieId = serie.id

    // 2. Obter as ocorrências materializadas
    let ocorrencias = db.select().from(eventos).where(eq(eventos.serieRecorrenciaId, serieId)).all()
    expect(ocorrencias.length).toBe(5)

    // 3. Escolher uma ocorrência e transformá-la em exceção via PATCH THIS
    const evParaExcecao = ocorrencias[2]
    const patchThisRes = await req(`/api/v1/series-recorrencia/${serieId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updateMode: 'THIS',
        fromEventId: evParaExcecao.id,
        changes: { titulo: 'Exceção Modificada' }
      })
    })
    expect(patchThisRes.status).toBe(200)

    // 4. Capturar estado ANTES da inativação
    ocorrencias = db.select().from(eventos).where(eq(eventos.serieRecorrenciaId, serieId)).all()
    const totalAntes = ocorrencias.length
    const idsAntes = ocorrencias.map((o: any) => o.id).sort()
    
    // Verifica se a exceção foi criada
    const excecaoCriada = ocorrencias.find((o: any) => o.id === evParaExcecao.id)
    expect(excecaoCriada.recorrenciaExcecao).toBe(true)
    expect(excecaoCriada.ativo).toBe(true)

    // 5. Executar PATCH ALL com ativo = false
    const patchAllRes = await req(`/api/v1/series-recorrencia/${serieId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updateMode: 'ALL',
        changes: { ativo: false }
      })
    })
    expect(patchAllRes.status).toBe(200)

    // 6. Afirmar resultados PÓS inativação
    const seriePos = db.select().from(seriesRecorrencia).where(eq(seriesRecorrencia.id, serieId)).get()
    expect(seriePos.ativo).toBe(false)

    const ocorrenciasPos = db.select().from(eventos).where(eq(eventos.serieRecorrenciaId, serieId)).all()
    const totalPos = ocorrenciasPos.length
    const idsPos = ocorrenciasPos.map((o: any) => o.id).sort()

    // - Quantidade total não mudou, conjunto de IDs não mudou
    expect(totalPos).toBe(totalAntes)
    expect(idsPos).toEqual(idsAntes)

    // - TODOS os eventos estão inativos, inclusive a exceção
    for (const o of ocorrenciasPos) {
      expect(o.ativo).toBe(false)
    }

    // A exceção ainda deve existir e estar como exceção (embora inativa)
    const excecaoPos = ocorrenciasPos.find((o: any) => o.id === evParaExcecao.id)
    expect(excecaoPos.recorrenciaExcecao).toBe(true)
  })
})
