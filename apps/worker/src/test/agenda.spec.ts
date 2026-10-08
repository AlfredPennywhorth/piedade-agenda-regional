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



  it('3. Preserva prioridade em RSVP equivalente e não a restaura após sair do conflito', async () => {
    sqlite.exec(`
      INSERT INTO eventos (id, titulo, modalidade, inicio_em, fim_em, regional_id, ativo)
      VALUES
        ('ev-recria-a', 'Evento Recria A', 'PRESENCIAL', '2027-01-04T10:00:00Z', '2027-01-04T11:00:00Z', 'reg-1', 1),
        ('ev-recria-b', 'Evento Recria B', 'PRESENCIAL', '2027-01-04T10:30:00Z', '2027-01-04T11:30:00Z', 'reg-1', 1);

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
        ('rsvp-recria-b', 'dest-recria-b', 'PARTICIPAREI', '2026-09-30T00:00:00Z', '2026-09-30T00:00:00Z');
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

    const salvarEquivalente = await req('/api/v1/minha-agenda/rsvp/dest-recria-b', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ resposta: 'PARTICIPAREI' }),
    })
    expect(salvarEquivalente.status).toBe(200)

    const aposEquivalente = await req('/api/v1/minha-agenda', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    const agendaEquivalente = await aposEquivalente.json() as any[]
    expect(agendaEquivalente.find(item => item.evento.id === 'ev-recria-a').conflito.priorizado).toBe(true)

    const sairDoConflito = await req('/api/v1/minha-agenda/rsvp/dest-recria-b', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resposta: 'NAO_PARTICIPAREI',
        justificativa: 'Outro compromisso',
      }),
    })
    expect(sairDoConflito.status).toBe(200)

    const semConflito = await req('/api/v1/minha-agenda', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    const agendaSemConflito = await semConflito.json() as any[]
    expect(agendaSemConflito.find(item => item.evento.id === 'ev-recria-a').conflito).toBeNull()

    const voltarAoConflito = await req('/api/v1/minha-agenda/rsvp/dest-recria-b', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ resposta: 'PARTICIPAREI' }),
    })
    expect(voltarAoConflito.status).toBe(200)

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

    const linhasAposSaida = sqlite
      .prepare(`
        SELECT COUNT(*) AS total
        FROM agenda_prioridades_conflito
        WHERE membro_id = ?
          AND conflito_par_chave = ?
      `)
      .get(membroId, 'ev-recria-a|ev-recria-b') as { total: number }

    expect(linhasAposSaida.total).toBe(0)

    const repriorizar = await req('/api/v1/minha-agenda/prioridade/ev-recria-a', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    expect(repriorizar.status).toBe(200)

    const versoesDoPar = sqlite
      .prepare(`
        SELECT COUNT(*) AS total
        FROM agenda_prioridades_conflito
        WHERE membro_id = ?
          AND conflito_par_chave = ?
      `)
      .get(membroId, 'ev-recria-a|ev-recria-b') as { total: number }

    expect(versoesDoPar.total).toBe(1)
  })


  it('4. Não restaura prioridade após horário sair e voltar ao valor original', async () => {
    sqlite.exec(`
      INSERT INTO eventos
        (id, titulo, modalidade, inicio_em, fim_em, agenda_revisao, regional_id, ativo)
      VALUES
        ('ev-round-a', 'Evento Round A', 'PRESENCIAL', '2026-01-05T10:00:00Z', '2026-01-05T11:00:00Z', 'rev-a-1', 'reg-1', 1),
        ('ev-round-b', 'Evento Round B', 'PRESENCIAL', '2026-01-05T10:30:00Z', '2026-01-05T11:30:00Z', 'rev-b-1', 'reg-1', 1);

      INSERT INTO convocacoes (id, evento_id, status, ativo)
      VALUES
        ('conv-round-a', 'ev-round-a', 'PUBLICADA', 1),
        ('conv-round-b', 'ev-round-b', 'PUBLICADA', 1);

      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id)
      VALUES
        ('dest-round-a', 'conv-round-a', '${membroId}'),
        ('dest-round-b', 'conv-round-b', '${membroId}');
    `)

    const priorizar = await req('/api/v1/minha-agenda/prioridade/ev-round-a', {
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
      SET inicio_em = '2026-01-05T13:00:00Z',
          fim_em = '2026-01-05T14:00:00Z',
          agenda_revisao = 'rev-b-2'
      WHERE id = 'ev-round-b';
    `)

    const semConflito = await req('/api/v1/minha-agenda', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    const agendaSemConflito = await semConflito.json() as any[]
    expect(agendaSemConflito.find(item => item.evento.id === 'ev-round-a').conflito).toBeNull()

    sqlite.exec(`
      UPDATE eventos
      SET inicio_em = '2026-01-05T10:30:00Z',
          fim_em = '2026-01-05T11:30:00Z',
          agenda_revisao = 'rev-b-3'
      WHERE id = 'ev-round-b';
    `)

    const restaurado = await req('/api/v1/minha-agenda', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    const agendaRestaurada = await restaurado.json() as any[]
    const eventoA = agendaRestaurada.find(item => item.evento.id === 'ev-round-a')
    const eventoB = agendaRestaurada.find(item => item.evento.id === 'ev-round-b')

    expect(eventoA.conflito.priorizado).toBe(false)
    expect(eventoA.conflito.atenuado).toBe(false)
    expect(eventoB.conflito.priorizado).toBe(false)
    expect(eventoB.conflito.atenuado).toBe(false)
  })


  it('5. Preserva prioridade quando muda apenas a formatação ISO do horário', async () => {
    sqlite.exec(`
      INSERT INTO eventos
        (id, titulo, modalidade, inicio_em, fim_em, agenda_revisao, regional_id, ativo)
      VALUES
        ('ev-iso-a', 'Evento ISO A', 'PRESENCIAL', '2026-01-06T10:00:00Z', '2026-01-06T11:00:00Z', 'rev-iso-a', 'reg-1', 1),
        ('ev-iso-b', 'Evento ISO B', 'PRESENCIAL', '2026-01-06T10:30:00Z', '2026-01-06T11:30:00Z', 'rev-iso-b', 'reg-1', 1);

      INSERT INTO convocacoes (id, evento_id, status, ativo)
      VALUES
        ('conv-iso-a', 'ev-iso-a', 'PUBLICADA', 1),
        ('conv-iso-b', 'ev-iso-b', 'PUBLICADA', 1);

      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id)
      VALUES
        ('dest-iso-a', 'conv-iso-a', '${membroId}'),
        ('dest-iso-b', 'conv-iso-b', '${membroId}');
    `)

    const priorizar = await req('/api/v1/minha-agenda/prioridade/ev-iso-a', {
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
      SET inicio_em = '2026-01-06T10:30:00.000Z',
          fim_em = '2026-01-06T11:30:00.000Z'
      WHERE id = 'ev-iso-b';
    `)

    const res = await req('/api/v1/minha-agenda', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    const agenda = await res.json() as any[]
    const eventoA = agenda.find(item => item.evento.id === 'ev-iso-a')
    const eventoB = agenda.find(item => item.evento.id === 'ev-iso-b')

    expect(eventoA.conflito.priorizado).toBe(true)
    expect(eventoA.conflito.atenuado).toBe(false)
    expect(eventoB.conflito.atenuado).toBe(true)
  })


  it('6. Remove prioridade se o RSVP mudar durante a priorização', async () => {
    sqlite.exec(`
      INSERT INTO eventos
        (id, titulo, modalidade, inicio_em, fim_em, agenda_revisao, regional_id, ativo)
      VALUES
        ('ev-race-a', 'Evento Race A', 'PRESENCIAL', '2027-01-07T10:00:00Z', '2027-01-07T11:00:00Z', 'rev-race-a', 'reg-1', 1),
        ('ev-race-b', 'Evento Race B', 'PRESENCIAL', '2027-01-07T10:30:00Z', '2027-01-07T11:30:00Z', 'rev-race-b', 'reg-1', 1);

      INSERT INTO convocacoes (id, evento_id, status, ativo)
      VALUES
        ('conv-race-a', 'ev-race-a', 'PUBLICADA', 1),
        ('conv-race-b', 'ev-race-b', 'PUBLICADA', 1);

      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id)
      VALUES
        ('dest-race-a', 'conv-race-a', '${membroId}'),
        ('dest-race-b', 'conv-race-b', '${membroId}');

      INSERT INTO rsvp
        (id, convocacao_destinatario_id, resposta, respondido_em, atualizado_em)
      VALUES
        ('rsvp-race-b', 'dest-race-b', 'PARTICIPAREI', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z');

      CREATE TRIGGER trg_test_race_rsvp
      AFTER INSERT ON agenda_prioridades_conflito
      WHEN NEW.conflito_par_chave = 'ev-race-a|ev-race-b'
      BEGIN
        UPDATE rsvp
        SET resposta = 'NAO_PARTICIPAREI',
            atualizado_em = '2026-10-01T00:00:01Z',
            updated_at = '2026-10-01T00:00:01Z'
        WHERE convocacao_destinatario_id = 'dest-race-b';
      END;
    `)

    const priorizar = await req('/api/v1/minha-agenda/prioridade/ev-race-a', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })

    expect(priorizar.status).toBe(409)
    expect(await priorizar.json()).toEqual(expect.objectContaining({
      code: 'CONFLITO_ALTERADO',
    }))

    const linha = sqlite
      .prepare(`
        SELECT COUNT(*) AS total
        FROM agenda_prioridades_conflito
        WHERE membro_id = ?
          AND conflito_par_chave = ?
      `)
      .get(membroId, 'ev-race-a|ev-race-b') as { total: number }

    expect(linha.total).toBe(0)
    sqlite.exec('DROP TRIGGER trg_test_race_rsvp;')
  })


  it('7. Rejeita prioridade se a configuração do conflito mudar durante a gravação', async () => {
    sqlite.exec(`
      INSERT INTO eventos
        (id, titulo, modalidade, inicio_em, fim_em, agenda_revisao, regional_id, ativo)
      VALUES
        ('ev-version-a', 'Evento Version A', 'PRESENCIAL', '2027-01-08T10:00:00Z', '2027-01-08T11:00:00Z', 'rev-version-a', 'reg-1', 1),
        ('ev-version-b', 'Evento Version B', 'PRESENCIAL', '2027-01-08T10:30:00Z', '2027-01-08T11:30:00Z', 'rev-version-b-1', 'reg-1', 1);

      INSERT INTO convocacoes (id, evento_id, status, ativo)
      VALUES
        ('conv-version-a', 'ev-version-a', 'PUBLICADA', 1),
        ('conv-version-b', 'ev-version-b', 'PUBLICADA', 1);

      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id)
      VALUES
        ('dest-version-a', 'conv-version-a', '${membroId}'),
        ('dest-version-b', 'conv-version-b', '${membroId}');

      CREATE TRIGGER trg_test_version_conflict
      AFTER INSERT ON agenda_prioridades_conflito
      WHEN NEW.conflito_par_chave = 'ev-version-a|ev-version-b'
      BEGIN
        UPDATE eventos
        SET inicio_em = '2027-01-08T10:45:00Z',
            fim_em = '2027-01-08T11:45:00Z',
            agenda_revisao = 'rev-version-b-2'
        WHERE id = 'ev-version-b';
      END;
    `)

    const priorizar = await req('/api/v1/minha-agenda/prioridade/ev-version-a', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })

    expect(priorizar.status).toBe(409)
    expect(await priorizar.json()).toEqual(expect.objectContaining({
      code: 'CONFLITO_ALTERADO',
    }))

    const linha = sqlite
      .prepare(`
        SELECT COUNT(*) AS total
        FROM agenda_prioridades_conflito
        WHERE membro_id = ?
          AND conflito_par_chave = ?
      `)
      .get(membroId, 'ev-version-a|ev-version-b') as { total: number }

    expect(linha.total).toBe(0)
    sqlite.exec('DROP TRIGGER trg_test_version_conflict;')
  })


  it('8. Não apaga versão concorrente criada durante o cleanup', async () => {
    const antiga = sqlite.prepare(`
      SELECT id, conflito_par_chave AS par
      FROM agenda_prioridades_conflito
      WHERE membro_id = ? AND conflito_par_chave = ?
      LIMIT 1
    `).get(membroId, 'ev-version-a|ev-version-b') as { id: string; par: string } | undefined

    if (!antiga) {
      sqlite.prepare(`
        INSERT INTO agenda_prioridades_conflito
          (id, membro_id, evento_id, conflito_par_chave, conflito_chave)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        'prioridade-antiga-cleanup',
        membroId,
        'ev-version-a',
        'ev-version-a|ev-version-b',
        'versao-antiga-cleanup'
      )
    }

    sqlite.exec(`
      CREATE TRIGGER trg_cleanup_concorrente
      BEFORE DELETE ON agenda_prioridades_conflito
      WHEN OLD.conflito_par_chave = 'ev-version-a|ev-version-b'
      BEGIN
        INSERT OR IGNORE INTO agenda_prioridades_conflito
          (id, membro_id, evento_id, conflito_par_chave, conflito_chave)
        VALUES
          ('prioridade-concorrente-cleanup', '${membroId}', 'ev-version-b',
           'ev-version-a|ev-version-b', 'versao-concorrente-cleanup');
      END;
    `)

    const res = await req('/api/v1/minha-agenda/prioridade/ev-version-a', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })

    expect(res.status).toBe(200)

    const concorrente = sqlite.prepare(`
      SELECT COUNT(*) AS total
      FROM agenda_prioridades_conflito
      WHERE id = 'prioridade-concorrente-cleanup'
    `).get() as { total: number }

    expect(concorrente.total).toBe(1)
    sqlite.exec('DROP TRIGGER trg_cleanup_concorrente;')
  })


  it('8. Marca reconfirmação pendente e limpa após novo RSVP', async () => {
    const revisao = new Date(Date.now() - 1000).toISOString()
    const respostaAnterior = new Date(Date.now() - 60_000).toISOString()

    sqlite.exec(`
      UPDATE eventos
      SET inicio_em = '2099-12-20T10:00:00Z',
          fim_em = '2099-12-20T11:00:00Z',
          agenda_revisao = '${revisao}',
          agenda_aviso = 'Atenção! O evento foi alterado. Favor reconfirmar sua presença.'
      WHERE id = 'ev-1';

      INSERT OR REPLACE INTO rsvp
        (id, convocacao_destinatario_id, resposta, justificativa, respondido_em, atualizado_em, created_at, updated_at)
      VALUES
        ('rsvp-reconfirmacao', 'dest-1', 'PARTICIPAREI', NULL,
         '${respostaAnterior}', '${respostaAnterior}',
         '${respostaAnterior}', '${respostaAnterior}');
    `)

    const antes = await req('/api/v1/minha-agenda', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    expect(antes.status).toBe(200)
    const agendaAntes = await antes.json() as any[]
    const itemAntes = agendaAntes.find(item => item.evento.id === 'ev-1')
    expect(itemAntes.evento.agendaAviso).toContain('reconfirmar')
    expect(itemAntes.rsvp.resposta).toBe('PARTICIPAREI')
    expect(itemAntes.rsvp.reconfirmacaoPendente).toBe(true)

    const responder = await req('/api/v1/minha-agenda/rsvp/dest-1', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ resposta: 'PARTICIPAREI' }),
    })
    expect(responder.status).toBe(200)

    const depois = await req('/api/v1/minha-agenda', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    const agendaDepois = await depois.json() as any[]
    const itemDepois = agendaDepois.find(item => item.evento.id === 'ev-1')
    expect(itemDepois.rsvp.reconfirmacaoPendente).toBe(false)
  })

  it('EXT-05 Evento Próprio externo entra na agenda e conflita com compromisso local', async () => {
    sqlite.exec(`
      INSERT INTO eventos (
        id, titulo, modalidade, inicio_em, fim_em, regional_id, ativo
      )
      VALUES (
        'ev-local-externo-teste', 'Compromisso local isolado', 'ONLINE',
        '2026-02-10T10:00:00Z', '2026-02-10T11:00:00Z', 'reg-1', 1
      );

      INSERT INTO convocacoes (id, evento_id, status, ativo)
      VALUES ('conv-local-externo-teste', 'ev-local-externo-teste', 'PUBLICADA', 1);

      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id)
      VALUES ('dest-local-externo-teste', 'conv-local-externo-teste', '${membroId}');

      INSERT INTO eventos (
        id, pessoal, criador_membro_id, titulo, modalidade, inicio_em, fim_em,
        abrangencia, destino_uf, destino_cidade_local, regional_gestao_id,
        regional_id, ativo
      )
      VALUES (
        'ev-externo-pessoal', 1, '${membroId}', 'Atendimento em Minas', 'PRESENCIAL',
        '2026-02-10T10:15:00Z', '2026-02-10T10:45:00Z',
        'NACIONAL', 'MG', 'Belo Horizonte — atendimento', 'reg-1', 'reg-1', 1
      );
    `)

    const res = await req('/api/v1/minha-agenda', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    expect(res.status).toBe(200)

    const agenda = await res.json() as any[]
    const externo = agenda.find(item => item.evento.id === 'ev-externo-pessoal')
    const local = agenda.find(item => item.evento.id === 'ev-local-externo-teste')

    expect(externo).toBeDefined()
    expect(externo.evento.abrangencia).toBe('NACIONAL')
    expect(externo.conflito.eventos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventoId: 'ev-local-externo-teste', tipo: 'SOBREPOSICAO' }),
      ])
    )
    expect(local.conflito.eventos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventoId: 'ev-externo-pessoal', tipo: 'SOBREPOSICAO' }),
      ])
    )
  })

})
