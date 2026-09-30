import { describe, it, expect, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { setupDb } from './setup'

describe('S07 - Minha Agenda', () => {
  let sqlite: any
  let db: ReturnType<typeof drizzle>
  let app: any

  const req = async (path: string, options?: RequestInit) => {
    const request = new Request(`http://localhost${path}`, options)
    return app.request(request)
  }

  const membroId = 'mem-1'
  let sessionToken = ''

  beforeAll(async () => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema })
    app = createApp(db, { enableAdminRoutes: true })
    setupDb(sqlite)

    // Base data
    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES ('reg-1', 'Reg 1');
      INSERT INTO administracoes (id, regional_id, nome) VALUES ('adm-1', 'reg-1', 'Adm 1');
      INSERT INTO setores (id, administracao_id, nome) VALUES ('set-1', 'adm-1', 'Set 1');
      INSERT INTO casas (id, setor_id, nome) VALUES ('casa-1', 'set-1', 'Casa 1');
      
      INSERT INTO membros (id, nome, celular, codigo_carteirinha, casa_id, ativo)
      VALUES ('${membroId}', 'João Silva', '11999999999', 'CARTEIRA-AGENDA', 'casa-1', 1);
      
      INSERT INTO funcoes (id, nome) VALUES ('func-1', 'Função 1');
      INSERT INTO vinculos_funcionais (id, membro_id, funcao_id, regional_id, ativo) VALUES ('vinc-1', '${membroId}', 'func-1', 'reg-1', 1);

      INSERT INTO locais (id, nome, endereco, numero, cidade, uf) VALUES ('loc-1', 'Local 1', 'Rua A', '1', 'SP', 'SP');
      INSERT INTO espacos_local (id, local_id, nome, ativo) VALUES ('esp-1', 'loc-1', 'Sala A', 1);

      INSERT INTO eventos (id, titulo, modalidade, inicio_em, fim_em, local_id, espaco_id, regional_id, ativo)
      VALUES ('ev-1', 'Evento Teste', 'PRESENCIAL', '2026-01-01T10:00:00Z', '2026-01-01T11:00:00Z', 'loc-1', 'esp-1', 'reg-1', 1);

      INSERT INTO convocacoes (id, evento_id, status, ativo)
      VALUES ('conv-1', 'ev-1', 'PUBLICADA', 1);

      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id)
      VALUES ('dest-1', 'conv-1', '${membroId}');
    `)

    // Activate and get session
    const resLink = await req(`/api/v1/admin/membros/${membroId}/link-ativacao`, { method: 'POST' })
    const linkJson = await resLink.json() as any
    const tokenAtivacao = linkJson.token

    const resAtivar = await req('/api/v1/auth/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenAtivacao, codigoCarteirinha: 'CARTEIRA-AGENDA', celular: '11999999999', pin: '123456', confirmacaoPin: '123456' })
    })
    const ativarJson = await resAtivar.json() as any
    sessionToken = ativarJson.sessionToken
  })

  it('1. Deve listar a agenda do membro autenticado', async () => {
    const res = await req('/api/v1/minha-agenda', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    
    expect(res.status).toBe(200)
    const json = await res.json() as any[]
    
    expect(json.length).toBe(1)
    expect(json[0].evento.id).toBe('ev-1')
    expect(json[0].convocacao.id).toBe('conv-1')
    expect(json[0].local.id).toBe('loc-1')
    expect(json[0].espaco.id).toBe('esp-1')
    expect(json[0].espaco.nome).toBe('Sala A')
    expect(json[0].destinatarioId).toBe('dest-1')
    expect(json[0].rsvp).toBeNull()
  })

  it('2. Não cria autoconflito quando há histórico de check-in retificado', async () => {
    sqlite.exec(`
      INSERT INTO checkins
        (id, convocacao_destinatario_id, evento_id, membro_id, forma, status)
      VALUES
        ('check-retificado', 'dest-1', 'ev-1', '${membroId}', 'MANUAL', 'RETIFICADO'),
        ('check-ativo', 'dest-1', 'ev-1', '${membroId}', 'MANUAL', 'ATIVO');
    `)

    const res = await req('/api/v1/minha-agenda', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    expect(res.status).toBe(200)

    const agenda = await res.json() as any[]
    const evento = agenda.find(item => item.evento.id === 'ev-1')
    expect(agenda.filter(item => item.evento.id === 'ev-1')).toHaveLength(1)
    expect(evento.conflito).toBeNull()
    expect(evento.checkin.id).toBe('check-ativo')
  })

  it('2. Detecta sobreposição/proximidade e permite ao membro escolher a prioridade', async () => {
    sqlite.exec(`
      INSERT INTO eventos (id, titulo, modalidade, inicio_em, fim_em, regional_id, ativo)
      VALUES
        ('ev-2', 'Evento Sobreposto', 'PRESENCIAL', '2026-01-01T10:30:00Z', '2026-01-01T11:30:00Z', 'reg-1', 1),
        ('ev-3', 'Evento Próximo', 'PRESENCIAL', '2026-01-01T12:30:00Z', '2026-01-01T13:30:00Z', 'reg-1', 1);

      INSERT INTO convocacoes (id, evento_id, status, ativo)
      VALUES
        ('conv-2', 'ev-2', 'PUBLICADA', 1),
        ('conv-3', 'ev-3', 'PUBLICADA', 1);

      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id)
      VALUES
        ('dest-2', 'conv-2', '${membroId}'),
        ('dest-3', 'conv-3', '${membroId}');
    `)

    const antes = await req('/api/v1/minha-agenda', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    expect(antes.status).toBe(200)

    const agendaAntes = await antes.json() as any[]
    const ev1 = agendaAntes.find(item => item.evento.id === 'ev-1')
    const ev2 = agendaAntes.find(item => item.evento.id === 'ev-2')
    const ev3 = agendaAntes.find(item => item.evento.id === 'ev-3')

    expect(ev1.conflito.tipo).toBe('SOBREPOSICAO')
    expect(ev2.conflito.eventos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventoId: 'ev-1', tipo: 'SOBREPOSICAO' }),
        expect.objectContaining({ eventoId: 'ev-3', tipo: 'PROXIMIDADE' }),
      ])
    )
    expect(ev3.conflito.tipo).toBe('PROXIMIDADE')
    expect(ev3.conflito.janelaTransicaoMinutos).toBe(60)

    const priorizar = await req('/api/v1/minha-agenda/prioridade/ev-2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    expect(priorizar.status).toBe(200)

    const depois = await req('/api/v1/minha-agenda', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    const agendaDepois = await depois.json() as any[]

    expect(agendaDepois.find(item => item.evento.id === 'ev-2').conflito.priorizado).toBe(true)
    expect(agendaDepois.find(item => item.evento.id === 'ev-1').conflito.atenuado).toBe(true)
    expect(agendaDepois.find(item => item.evento.id === 'ev-3').conflito.atenuado).toBe(true)
  })

})
