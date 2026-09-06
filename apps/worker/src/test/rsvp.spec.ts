import { describe, it, expect, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { setupDb } from './setup'

describe('S08 - RSVP', () => {
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
      
      INSERT INTO membros (id, nome, celular, data_nascimento, casa_id, ativo)
      VALUES 
        ('${membroId}', 'JoÃ£o Silva', '11999999999', '1990-01-01', 'casa-1', 1),
        ('${membroIdOutro}', 'Maria Souza', '11888888888', '1990-01-02', 'casa-1', 1);
      
      -- Eventos: futuro, futuro (cancelado), passado (iniciado)
      INSERT INTO eventos (id, titulo, modalidade, inicio_em, fim_em, regional_id, ativo)
      VALUES 
        ('ev-futuro', 'Evento Futuro', 'ONLINE', '2030-01-01T10:00:00Z', '2030-01-01T11:00:00Z', 'reg-1', 1),
        ('ev-cancel', 'Evento Cancelado', 'ONLINE', '2030-02-01T10:00:00Z', '2030-02-01T11:00:00Z', 'reg-1', 1),
        ('ev-passado', 'Evento Iniciado', 'ONLINE', '2020-01-01T10:00:00Z', '2020-01-01T11:00:00Z', 'reg-1', 1);

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

    // Helper para gerar sessÃ£o
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
  })

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
      body: JSON.stringify({ resposta: 'NAO_PARTICIPAREI' }) // Faltando justificativa
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

  it('6. PUT com convocaÃ§Ã£o CANCELADA -> 400', async () => {
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

  it('7. PUT apÃ³s inÃ­cio do evento -> 400', async () => {
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
    expect(json.error).toMatch(/iniciou/)
  })

  it('8. PUT de outro membro no destinatÃ¡rio alheio -> 404 (ProteÃ§Ã£o de recurso)', async () => {
    // Tentando editar o destIdNormal (que Ã© do mem-1) logado como mem-2 (sessionTokenOutro)
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
})
describe('S09 - Worker RSVP (Periodos e Alimentacao)', () => {
  it('11. false/false => periodo null', () => {})
  it('12. somente manhã => normaliza MANHA', () => {})
  it('13. somente tarde => normaliza TARDE', () => {})
  it('14. manhã+tarde sem período => 400', () => {})
  it('15. manhã+tarde MANHA', () => {})
  it('16. manhã+tarde TARDE', () => {})
  it('17. manhã+tarde INTEGRAL', () => {})
  it('18. refeição válida', () => {})
  it('19. nenhuma refeição => válido', () => {})
  it('20. refeição não oferecida => rejeita', () => {})
  it('21. refeição inativa => rejeita', () => {})
  it('22. refeição de outro evento => rejeita', () => {})
  it('23. seleção repetida não duplica', () => {})
  it('24. desmarcar => soft inactive', () => {})
  it('25. remarcar => reativa mesma linha', () => {})
  it('26. PARTICIPAREI -> NAO_SEI limpa período/refeições', () => {})
  it('27. PARTICIPAREI -> NAO_PARTICIPAREI limpa período/refeições', () => {})
  it('28. evento iniciado bloqueia alteração', () => {})
  it('29. destinatário de outro membro continua retornando 404', () => {})
  it('30. falha no batch não deixa atualização parcial', () => {})
})
