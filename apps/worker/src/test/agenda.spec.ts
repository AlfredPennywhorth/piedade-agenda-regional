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

  it('2. Invalida prioridade antiga quando o grupo de conflito muda', async () => {
    sqlite.exec(`
      INSERT INTO eventos (id, titulo, modalidade, inicio_em, fim_em, regional_id, ativo)
      VALUES
        ('ev-a', 'Evento A', 'PRESENCIAL', '2026-01-02T10:00:00Z', '2026-01-02T11:00:00Z', 'reg-1', 1),
        ('ev-b', 'Evento B', 'PRESENCIAL', '2026-01-02T10:30:00Z', '2026-01-02T11:30:00Z', 'reg-1', 1);

      INSERT INTO convocacoes (id, evento_id, status, ativo)
      VALUES
        ('conv-a', 'ev-a', 'PUBLICADA', 1),
        ('conv-b', 'ev-b', 'PUBLICADA', 1);

      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id)
      VALUES
        ('dest-a', 'conv-a', '${membroId}'),
        ('dest-b', 'conv-b', '${membroId}');
    `)

    const priorizar = await req('/api/v1/minha-agenda/prioridade/ev-a', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    expect(priorizar.status).toBe(200)

    sqlite.exec(`
      UPDATE eventos
      SET inicio_em = '2026-01-02T13:00:00Z', fim_em = '2026-01-02T14:00:00Z'
      WHERE id = 'ev-b';

      INSERT INTO eventos (id, titulo, modalidade, inicio_em, fim_em, regional_id, ativo)
      VALUES ('ev-c', 'Evento C', 'PRESENCIAL', '2026-01-02T10:15:00Z', '2026-01-02T10:45:00Z', 'reg-1', 1);

      INSERT INTO convocacoes (id, evento_id, status, ativo)
      VALUES ('conv-c', 'ev-c', 'PUBLICADA', 1);

      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id)
      VALUES ('dest-c', 'conv-c', '${membroId}');
    `)

    const res = await req('/api/v1/minha-agenda', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    const agenda = await res.json() as any[]
    const eventoA = agenda.find(item => item.evento.id === 'ev-a')
    const eventoC = agenda.find(item => item.evento.id === 'ev-c')

    expect(eventoA.conflito.priorizado).toBe(false)
    expect(eventoA.conflito.atenuado).toBe(false)
    expect(eventoC.conflito.priorizado).toBe(false)
    expect(eventoC.conflito.atenuado).toBe(false)
  })

  it('2. Atenua apenas compromissos em conflito direto', async () => {
    sqlite.exec(`
      INSERT INTO eventos (id, titulo, modalidade, inicio_em, fim_em, regional_id, ativo)
      VALUES
        ('ev-chain-a', 'Evento Cadeia A', 'PRESENCIAL', '2026-01-03T10:00:00Z', '2026-01-03T11:00:00Z', 'reg-1', 1),
        ('ev-chain-b', 'Evento Cadeia B', 'PRESENCIAL', '2026-01-03T11:30:00Z', '2026-01-03T12:30:00Z', 'reg-1', 1),
        ('ev-chain-c', 'Evento Cadeia C', 'PRESENCIAL', '2026-01-03T13:00:00Z', '2026-01-03T14:00:00Z', 'reg-1', 1);

      INSERT INTO convocacoes (id, evento_id, status, ativo)
      VALUES
        ('conv-chain-a', 'ev-chain-a', 'PUBLICADA', 1),
        ('conv-chain-b', 'ev-chain-b', 'PUBLICADA', 1),
        ('conv-chain-c', 'ev-chain-c', 'PUBLICADA', 1);

      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id)
      VALUES
        ('dest-chain-a', 'conv-chain-a', '${membroId}'),
        ('dest-chain-b', 'conv-chain-b', '${membroId}'),
        ('dest-chain-c', 'conv-chain-c', '${membroId}');
    `)

    const priorizar = await req('/api/v1/minha-agenda/prioridade/ev-chain-a', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    expect(priorizar.status).toBe(200)

    const res = await req('/api/v1/minha-agenda', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    const agenda = await res.json() as any[]

    const a = agenda.find(item => item.evento.id === 'ev-chain-a')
    const b = agenda.find(item => item.evento.id === 'ev-chain-b')
    const cItem = agenda.find(item => item.evento.id === 'ev-chain-c')

    expect(a.conflito.priorizado).toBe(true)
    expect(a.conflito.atenuado).toBe(false)
    expect(b.conflito.atenuado).toBe(true)
    expect(cItem.conflito.priorizado).toBe(false)
    expect(cItem.conflito.atenuado).toBe(false)
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



  it('3. Não restaura prioridade antiga quando o mesmo conflito é recriado após RSVP', async () => {
    sqlite.exec(`
      INSERT INTO eventos (id, titulo, modalidade, inicio_em, fim_em, regional_id, ativo)
      VALUES
        ('ev-recria-a', 'Evento Recria A', 'PRESENCIAL', '2026-01-04T10:00:00Z', '2026-01-04T11:00:00Z', 'reg-1', 1),
        ('ev-recria-b', 'Evento Recria B', 'PRESENCIAL', '2026-01-04T10:30:00Z', '2026-01-04T11:30:00Z', 'reg-1', 1);

      INSERT INTO convocacoes (id, evento_id, status, ativo)
      VALUES
        ('conv-recria-a', 'ev-recria-a', 'PUBLICADA', 1),
        ('conv-recria-b', 'ev-recria-b', 'PUBLICADA', 1);

      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id)
      VALUES
        ('dest-recria-a', 'conv-recria-a', '${membroId}'),
        ('dest-recria-b', 'conv-recria-b', '${membroId}');

      INSERT INTO rsvp
        (id, convocacao_destinatario_id, resposta, respondido_em, atualizado_em)
      VALUES
        ('rsvp-recria-b', 'dest-recria-b', 'PARTICIPAREI', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
    `)

    const priorizar = await req('/api/v1/minha-agenda/prioridade/ev-recria-a', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    expect(priorizar.status).toBe(200)

    sqlite.exec(`
      UPDATE rsvp
      SET resposta = 'NAO_PARTICIPAREI', atualizado_em = '2026-01-01T00:01:00Z'
      WHERE id = 'rsvp-recria-b';
    `)

    const semConflito = await req('/api/v1/minha-agenda', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    const agendaSemConflito = await semConflito.json() as any[]
    expect(agendaSemConflito.find(item => item.evento.id === 'ev-recria-a').conflito).toBeNull()

    sqlite.exec(`
      UPDATE rsvp
      SET resposta = 'PARTICIPAREI', atualizado_em = '2026-01-01T00:02:00Z'
      WHERE id = 'rsvp-recria-b';
    `)

    const recriado = await req('/api/v1/minha-agenda', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    const agendaRecriada = await recriado.json() as any[]
    const eventoA = agendaRecriada.find(item => item.evento.id === 'ev-recria-a')
    const eventoB = agendaRecriada.find(item => item.evento.id === 'ev-recria-b')

    expect(eventoA.conflito.priorizado).toBe(false)
    expect(eventoA.conflito.atenuado).toBe(false)
    expect(eventoB.conflito.priorizado).toBe(false)
    expect(eventoB.conflito.atenuado).toBe(false)
  })

})
