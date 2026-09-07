import { describe, it, expect, beforeAll, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { setupDb } from './setup'
import { eq } from 'drizzle-orm'
import * as batchHelpers from '../db/batch'

describe('S08 e S09 - RSVP (Periodos e Alimentacao)', () => {
  let sqlite: any
  let db: ReturnType<typeof drizzle>
  let app: any

  const req = async (path: string, options?: RequestInit) => {
    const request = new Request(`http://localhost${path}`, options)
    return app.request(request)
  }

  const membroId = 'mem-1'
  const membroIdOutro = 'mem-2'
  let sessionToken = ''
  let sessionTokenOutro = ''

  const destIdNormal = 'dest-1'
  const destIdCancelada = 'dest-2'
  const destIdIniciada = 'dest-3'
  const destIdOutro = 'dest-4'

  let eventoComPeriodos = ''
  let destIdPeriodos = ''
  let cafeId = ''

  beforeAll(async () => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema })
    app = createApp(db, { enableAdminRoutes: true })
    setupDb(sqlite)

    const baseSql = `
      INSERT INTO regionais (id, nome) VALUES ('reg-1', 'Reg 1');
      INSERT INTO administracoes (id, regional_id, nome) VALUES ('adm-1', 'reg-1', 'Adm 1');
      INSERT INTO setores (id, administracao_id, nome) VALUES ('set-1', 'adm-1', 'Set 1');
      INSERT INTO casas (id, setor_id, nome) VALUES ('casa-1', 'set-1', 'Casa 1');
      INSERT INTO locais (id, nome, endereco, regional_id) VALUES ('loc-1', 'Local 1', 'End 1', 'reg-1');
      
      INSERT INTO membros (id, nome, celular, data_nascimento, casa_id, ativo)
      VALUES 
        ('${membroId}', 'João Silva', '11999999999', '1990-01-01', 'casa-1', 1),
        ('${membroIdOutro}', 'Maria Souza', '11888888888', '1990-01-02', 'casa-1', 1);
      
      -- Eventos Lote 1/S08
      INSERT INTO eventos (id, titulo, modalidade, inicio_em, fim_em, regional_id, ativo, possui_manha, possui_tarde)
      VALUES 
        ('ev-futuro', 'Evento Futuro', 'ONLINE', '2030-01-01T10:00:00Z', '2030-01-01T11:00:00Z', 'reg-1', 1, 0, 0),
        ('ev-cancel', 'Evento Cancelado', 'ONLINE', '2030-02-01T10:00:00Z', '2030-02-01T11:00:00Z', 'reg-1', 1, 0, 0),
        ('ev-passado', 'Evento Iniciado', 'ONLINE', '2020-01-01T10:00:00Z', '2020-01-01T11:00:00Z', 'reg-1', 1, 0, 0);

      INSERT INTO convocacoes (id, evento_id, status, ativo)
      VALUES 
        ('conv-1', 'ev-futuro', 'PUBLICADA', 1),
        ('conv-2', 'ev-cancel', 'CANCELADA', 1),
        ('conv-3', 'ev-passado', 'PUBLICADA', 1);

      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id)
      VALUES 
        ('${destIdNormal}', 'conv-1', '${membroId}'),
        ('${destIdCancelada}', 'conv-2', '${membroId}'),
        ('${destIdIniciada}', 'conv-3', '${membroId}'),
        ('${destIdOutro}', 'conv-1', '${membroIdOutro}');
    `
    sqlite.exec(baseSql)

    const genSession = async (mid: string, cel: string, dataNascimento: string) => {
      const resLink = await req(`/api/v1/admin/membros/${mid}/link-ativacao`, { method: 'POST' })
      const linkJson = await resLink.json() as any
      const resAtivar = await req('/api/v1/auth/ativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: linkJson.token, celular: cel, dataNascimento, pin: '123456', confirmacaoPin: '123456' })
      })
      const ativarJson = await resAtivar.json() as any
      return ativarJson.sessionToken
    }

    sessionToken = await genSession(membroId, '11999999999', '1990-01-01')
    sessionTokenOutro = await genSession(membroIdOutro, '11888888888', '1990-01-02')

    // Prepara evento S09
    const resEv = await req('/api/v1/eventos', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Evento S09',
        modalidade: 'PRESENCIAL',
        inicioEm: '2030-05-01T10:00:00Z',
        fimEm: '2030-05-01T18:00:00Z',
        regionalId: 'reg-1',
        localId: 'loc-1',
        possuiManha: true,
        possuiTarde: true
      })
    })
    const ev = await resEv.json() as any
    eventoComPeriodos = ev.id

    sqlite.exec(`
      INSERT INTO convocacoes (id, evento_id, status, ativo) VALUES ('conv-s09', '${eventoComPeriodos}', 'PUBLICADA', 1);
      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id) VALUES ('dest-s09', 'conv-s09', '${membroId}');
    `)
    destIdPeriodos = 'dest-s09'
  })

  // ============================================================
  // S08 - Original Preservado (8 testes)
  // ============================================================
  it('1. GET sem RSVP -> 404', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdNormal}`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    expect(res.status).toBe(404)
  })

  it('2. PUT com PARTICIPAREI -> 200/201 (e GET confirma)', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdNormal}`, {
      method: 'PUT',
      headers: { 
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resposta: 'PARTICIPAREI' })
    })
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(json.resposta).toBe('PARTICIPAREI')
    expect(json.justificativa).toBeNull()

    const resGet = await req(`/api/v1/minha-agenda/rsvp/${destIdNormal}`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    expect(resGet.status).toBe(200)
    const jsonGet = await resGet.json() as any
    expect(jsonGet.resposta).toBe('PARTICIPAREI')
  })

  it('3. PUT atualiza para NAO_SEI -> 200 com valor novo', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdNormal}`, {
      method: 'PUT',
      headers: { 
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resposta: 'NAO_SEI' })
    })
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(json.resposta).toBe('NAO_SEI')
  })

  it('4. PUT NAO_PARTICIPAREI sem justificativa -> 400', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdNormal}`, {
      method: 'PUT',
      headers: { 
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resposta: 'NAO_PARTICIPAREI' })
    })
    expect(res.status).toBe(400)
  })

  it('5. PUT NAO_PARTICIPAREI com justificativa -> 200', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdNormal}`, {
      method: 'PUT',
      headers: { 
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resposta: 'NAO_PARTICIPAREI', justificativa: 'Viagem a trabalho' })
    })
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(json.resposta).toBe('NAO_PARTICIPAREI')
    expect(json.justificativa).toBe('Viagem a trabalho')
  })

  it('6. PUT com convocação CANCELADA -> 400', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdCancelada}`, {
      method: 'PUT',
      headers: { 
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resposta: 'PARTICIPAREI' })
    })
    expect(res.status).toBe(400)
  })

  it('7. PUT após início do evento -> 400', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdIniciada}`, {
      method: 'PUT',
      headers: { 
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resposta: 'PARTICIPAREI' })
    })
    expect(res.status).toBe(400)
    const json = await res.json() as any
    expect(json.error).toMatch(/iniciou/i)
  })

  it('8. PUT de outro membro no destinatário alheio -> 404 (Proteção de recurso)', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdNormal}`, {
      method: 'PUT',
      headers: { 
        Authorization: `Bearer ${sessionTokenOutro}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resposta: 'PARTICIPAREI' })
    })
    expect(res.status).toBe(404)
  })
  
  // ============================================================
  // S09 (20 testes funcionais extras de S09)
  // ============================================================
  it('11. false/false => periodo null', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdNormal}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI' })
    })
    expect(res.status).toBe(200)
    const dbRecord = await db.select().from(schema.rsvp).where(eq(schema.rsvp.convocacaoDestinatarioId, destIdNormal)).get()
    expect(dbRecord!.periodoParticipacao).toBeNull()
  })

  it('12. somente manhã => normaliza MANHA', async () => {
    await db.update(schema.eventos).set({ possuiManha: true, possuiTarde: false }).where(eq(schema.eventos.id, 'ev-futuro'))
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdNormal}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI' })
    })
    expect(res.status).toBe(200)
    const dbRecord = await db.select().from(schema.rsvp).where(eq(schema.rsvp.convocacaoDestinatarioId, destIdNormal)).get()
    expect(dbRecord!.periodoParticipacao).toBe('MANHA')
  })

  it('13. somente tarde => normaliza TARDE', async () => {
    await db.update(schema.eventos).set({ possuiManha: false, possuiTarde: true }).where(eq(schema.eventos.id, 'ev-futuro'))
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdNormal}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI' })
    })
    expect(res.status).toBe(200)
    const dbRecord = await db.select().from(schema.rsvp).where(eq(schema.rsvp.convocacaoDestinatarioId, destIdNormal)).get()
    expect(dbRecord!.periodoParticipacao).toBe('TARDE')
  })

  it('14. manhã+tarde sem período => 400', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdPeriodos}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI' }) // falta periodo
    })
    expect(res.status).toBe(400)
  })

  it('15. manhã+tarde MANHA', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdPeriodos}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI', periodoParticipacao: 'MANHA' })
    })
    expect(res.status).toBe(200)
    const dbRecord = await db.select().from(schema.rsvp).where(eq(schema.rsvp.convocacaoDestinatarioId, destIdPeriodos)).get()
    expect(dbRecord!.periodoParticipacao).toBe('MANHA')
  })

  it('16. manhã+tarde TARDE', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdPeriodos}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI', periodoParticipacao: 'TARDE' })
    })
    expect(res.status).toBe(200)
  })

  it('17. manhã+tarde INTEGRAL', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdPeriodos}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI', periodoParticipacao: 'INTEGRAL' })
    })
    expect(res.status).toBe(200)
  })

  it('18. refeição válida', async () => {
    const resRef = await req(`/api/v1/eventos/${eventoComPeriodos}/refeicoes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'CAFE_MANHA' })
    })
    const refJson = await resRef.json() as any
    cafeId = refJson.id

    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdPeriodos}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI', periodoParticipacao: 'INTEGRAL', refeicoesSelecionadas: ['CAFE_MANHA'] })
    })
    expect(res.status).toBe(200)
    
    const dbRecord = await db.select().from(schema.rsvp).where(eq(schema.rsvp.convocacaoDestinatarioId, destIdPeriodos)).get()
    const rsvpRef = await db.select().from(schema.rsvpRefeicoes).where(eq(schema.rsvpRefeicoes.rsvpId, dbRecord!.id)).all()
    expect(rsvpRef.length).toBe(1)
    expect(rsvpRef[0].ativo).toBe(true)
  })

  it('19. nenhuma refeição => válido', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdPeriodos}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI', periodoParticipacao: 'INTEGRAL', refeicoesSelecionadas: [] })
    })
    expect(res.status).toBe(200)
    const dbRecord = await db.select().from(schema.rsvp).where(eq(schema.rsvp.convocacaoDestinatarioId, destIdPeriodos)).get()
    const rsvpRef = await db.select().from(schema.rsvpRefeicoes).where(eq(schema.rsvpRefeicoes.rsvpId, dbRecord!.id)).all()
    expect(rsvpRef.every(r => r.ativo === false)).toBe(true)
  })

  it('20. refeição não oferecida => rejeita', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdPeriodos}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI', periodoParticipacao: 'INTEGRAL', refeicoesSelecionadas: ['ALMOCO'] })
    })
    expect(res.status).toBe(400)
  })

  it('21. refeição inativa => rejeita', async () => {
    await req(`/api/v1/eventos/${eventoComPeriodos}/refeicoes/${cafeId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: false })
    })
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdPeriodos}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI', periodoParticipacao: 'INTEGRAL', refeicoesSelecionadas: ['CAFE_MANHA'] })
    })
    expect(res.status).toBe(400)
    
    // reativar para os proximos testes
    await req(`/api/v1/eventos/${eventoComPeriodos}/refeicoes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'CAFE_MANHA' })
    })
  })

  it('22. refeição de outro evento => rejeita', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdNormal}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI', refeicoesSelecionadas: ['CAFE_MANHA'] })
    })
    expect(res.status).toBe(400)
  })

  it('23. seleção repetida não duplica', async () => {
    await req(`/api/v1/minha-agenda/rsvp/${destIdPeriodos}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI', periodoParticipacao: 'INTEGRAL', refeicoesSelecionadas: ['CAFE_MANHA'] })
    })
    const dbRecord = await db.select().from(schema.rsvp).where(eq(schema.rsvp.convocacaoDestinatarioId, destIdPeriodos)).get()
    const rsvpRef = await db.select().from(schema.rsvpRefeicoes).where(eq(schema.rsvpRefeicoes.rsvpId, dbRecord!.id)).all()
    expect(rsvpRef.length).toBe(1)
  })

  it('24. desmarcar => soft inactive', async () => {
    await req(`/api/v1/minha-agenda/rsvp/${destIdPeriodos}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI', periodoParticipacao: 'INTEGRAL', refeicoesSelecionadas: [] })
    })
    const dbRecord = await db.select().from(schema.rsvp).where(eq(schema.rsvp.convocacaoDestinatarioId, destIdPeriodos)).get()
    const rsvpRef = await db.select().from(schema.rsvpRefeicoes).where(eq(schema.rsvpRefeicoes.rsvpId, dbRecord!.id)).get()
    expect(rsvpRef!.ativo).toBe(false)
  })

  it('25. remarcar => reativa mesma linha', async () => {
    await req(`/api/v1/minha-agenda/rsvp/${destIdPeriodos}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI', periodoParticipacao: 'INTEGRAL', refeicoesSelecionadas: ['CAFE_MANHA'] })
    })
    const dbRecord = await db.select().from(schema.rsvp).where(eq(schema.rsvp.convocacaoDestinatarioId, destIdPeriodos)).get()
    const rsvpRef = await db.select().from(schema.rsvpRefeicoes).where(eq(schema.rsvpRefeicoes.rsvpId, dbRecord!.id)).get()
    expect(rsvpRef!.ativo).toBe(true)
  })

  it('26. PARTICIPAREI -> NAO_SEI limpa período/refeições', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdPeriodos}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'NAO_SEI' })
    })
    expect(res.status).toBe(200)
    const dbRecord = await db.select().from(schema.rsvp).where(eq(schema.rsvp.convocacaoDestinatarioId, destIdPeriodos)).get()
    expect(dbRecord!.periodoParticipacao).toBeNull()
  })

  it('27. PARTICIPAREI -> NAO_PARTICIPAREI limpa período/refeições', async () => {
    // Retorna para PARTICIPAREI
    await req(`/api/v1/minha-agenda/rsvp/${destIdPeriodos}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI', periodoParticipacao: 'INTEGRAL', refeicoesSelecionadas: ['CAFE_MANHA'] })
    })

    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdPeriodos}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'NAO_PARTICIPAREI', justificativa: 'Viagem' })
    })
    expect(res.status).toBe(200)
    const dbRecord = await db.select().from(schema.rsvp).where(eq(schema.rsvp.convocacaoDestinatarioId, destIdPeriodos)).get()
    expect(dbRecord!.periodoParticipacao).toBeNull()
  })

  it('28. evento iniciado bloqueia alteração', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdIniciada}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI' })
    })
    expect(res.status).toBe(400)
  })

  it('29. destinatário de outro membro continua retornando 404', async () => {
    const res = await req(`/api/v1/minha-agenda/rsvp/${destIdOutro}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI' })
    })
    expect(res.status).toBe(404)
  })

  it('30. falha no batch não deixa atualização parcial (Rollback no executeAtomic)', async () => {
    const destId = destIdPeriodos
    await req(`/api/v1/minha-agenda/rsvp/${destId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'NAO_SEI' }) 
    })
    const estadoAntes = await db.select().from(schema.rsvp).where(eq(schema.rsvp.convocacaoDestinatarioId, destId)).get()

    const spy = vi.spyOn(batchHelpers, 'executeAtomic').mockImplementation(async (dbAny, buildQueries: any) => {
      return dbAny.transaction((tx: any) => {
        const queries = buildQueries(tx)
        queries[0].run()
        throw new Error('Falha artificial de banco de dados (Rollback Injection)')
      })
    })

    const res = await req(`/api/v1/minha-agenda/rsvp/${destId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta: 'PARTICIPAREI', periodoParticipacao: 'INTEGRAL', refeicoesSelecionadas: ['CAFE_MANHA'] })
    })
    
    spy.mockRestore()

    expect(res.status).toBe(400)
    const json = await res.json() as any
    expect(json.error).toBe('Falha artificial de banco de dados (Rollback Injection)')

    const estadoDepois = await db.select().from(schema.rsvp).where(eq(schema.rsvp.convocacaoDestinatarioId, destId)).get()
    
    expect(estadoDepois!.resposta).toBe(estadoAntes!.resposta) 
    expect(estadoDepois!.periodoParticipacao).toBeNull()
  })
})
