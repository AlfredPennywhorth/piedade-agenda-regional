import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'
import { setupDb } from './setup'
import { hashToken } from '../security/tokens'
import { validarCredencialOperadorPortaria } from '../services/portaria-operador-temporario'
import { createApp } from '../index'

describe('PORT — credencial temporária do operador', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle>
  let app: ReturnType<typeof createApp>

  beforeEach(async () => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    db = drizzle(sqlite, { schema })
    app = createApp(db)

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES ('regional-1', 'Regional 1');
      INSERT INTO administracoes (id, regional_id, nome)
        VALUES ('adm-1', 'regional-1', 'Administração 1');
      INSERT INTO setores (id, administracao_id, nome)
        VALUES ('setor-1', 'adm-1', 'Setor 1');
      INSERT INTO casas (id, setor_id, nome)
        VALUES ('casa-1', 'setor-1', 'Casa 1');
      INSERT INTO eventos (
        id, titulo, modalidade, inicio_em, fim_em, casa_id, ativo
      ) VALUES (
        'evento-1', 'Reunião Teste', 'PRESENCIAL',
        '2099-01-01T15:00:00.000Z', '2099-01-01T18:00:00.000Z',
        'casa-1', 1
      );
    `)

    const tokenHash = await hashToken('token-operador-valido')
    sqlite.prepare(`
      INSERT INTO credenciais_operador_portaria_evento
        (id, evento_id, token_hash, expira_em, ativo)
      VALUES (?, ?, ?, ?, 1)
    `).run('cred-1', 'evento-1', tokenHash, '2099-01-02T02:59:59.000Z')
  })

  it('aceita token ativo e vincula somente ao evento da credencial', async () => {
    const resultado = await validarCredencialOperadorPortaria(db, 'token-operador-valido')

    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.credencial.id).toBe('cred-1')
      expect(resultado.credencial.eventoId).toBe('evento-1')
      expect(resultado.credencial.evento.titulo).toBe('Reunião Teste')
    }
  })

  it('PORT-464: credencial identifica local correto para reuniões de mesmo título e horário', async () => {
    sqlite.exec(`
      INSERT INTO locais (id, nome, endereco, numero, cidade, uf)
      VALUES ('local-a', 'Casa do Ponto A', 'Rua A', '100', 'São Paulo', 'SP'),
             ('local-b', 'Casa do Ponto B', 'Rua B', '200', 'São Paulo', 'SP');
      INSERT INTO espacos_local (id, local_id, nome)
      VALUES ('espaco-a', 'local-a', 'Nave A'),
             ('espaco-b', 'local-b', 'Nave B');
      INSERT INTO pontos_atendimento (id, setor_id, nome)
      VALUES ('ponto-a', 'setor-1', 'Ponto A'),
             ('ponto-b', 'setor-1', 'Ponto B');
      UPDATE eventos SET casa_id = NULL, setor_id = 'setor-1', local_id = 'local-a', espaco_id = 'espaco-a', ponto_atendimento_id = 'ponto-a'
      WHERE id = 'evento-1';
      INSERT INTO eventos (id, titulo, modalidade, inicio_em, fim_em, setor_id, local_id, espaco_id, ponto_atendimento_id, ativo)
      VALUES ('evento-2', 'Reunião Teste', 'PRESENCIAL',
              '2099-01-01T15:00:00.000Z', '2099-01-01T18:00:00.000Z',
              'setor-1', 'local-b', 'espaco-b', 'ponto-b', 1);
    `)
    sqlite.prepare(`INSERT INTO credenciais_operador_portaria_evento
      (id, evento_id, token_hash, expira_em, ativo) VALUES (?, ?, ?, ?, 1)`)
      .run('cred-2', 'evento-2', await hashToken('token-operador-b'), '2099-01-02T02:59:59.000Z')

    const obterSessao = async (token: string) => {
      const response = await app.request('/api/v1/portaria-operador-publica/sessao', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(response.status).toBe(200)
      return await response.json() as { evento: { id: string; titulo: string; local: { nome: string; endereco: string; numero: string } | null; espacoNome: string | null; pontoAtendimentoNome: string | null } }
    }
    const a = await obterSessao('token-operador-valido')
    const b = await obterSessao('token-operador-b')
    expect(a.evento.titulo).toBe(b.evento.titulo)
    expect(a.evento).toMatchObject({ id: 'evento-1', local: { nome: 'Casa do Ponto A', endereco: 'Rua A', numero: '100' }, espacoNome: 'Nave A', pontoAtendimentoNome: 'Ponto A' })
    expect(b.evento).toMatchObject({ id: 'evento-2', local: { nome: 'Casa do Ponto B', endereco: 'Rua B', numero: '200' }, espacoNome: 'Nave B', pontoAtendimentoNome: 'Ponto B' })
  })

  it('PORT-464: evento sem local exibe ausência de local sem inventar endereço', async () => {
    const response = await app.request('/api/v1/portaria-operador-publica/sessao', {
      headers: { Authorization: 'Bearer token-operador-valido' },
    })
    expect(response.status).toBe(200)
    const sessao = await response.json() as { evento: { local: unknown; espacoNome: unknown; pontoAtendimentoNome: unknown } }
    expect(sessao.evento).toMatchObject({ local: null, espacoNome: null, pontoAtendimentoNome: null })
  })

  it('PORT-466: credenciais de reuniões homônimas isolam destinatários publicados', async () => {
    sqlite.exec(`
      INSERT INTO membros (id, nome, casa_id, ativo) VALUES
        ('participante-a', 'Participante A', 'casa-1', 1),
        ('participante-b', 'Participante B', 'casa-1', 1);
      INSERT INTO eventos (id, titulo, modalidade, inicio_em, fim_em, casa_id, ativo)
      VALUES ('evento-2', 'Reunião Teste', 'PRESENCIAL',
              '2099-01-01T15:00:00.000Z', '2099-01-01T18:00:00.000Z', 'casa-1', 1);
      INSERT INTO convocacoes (id, evento_id, status, ativo) VALUES
        ('conv-a', 'evento-1', 'PUBLICADA', 1),
        ('conv-b', 'evento-2', 'PUBLICADA', 1);
      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id) VALUES
        ('dest-a', 'conv-a', 'participante-a'),
        ('dest-b', 'conv-b', 'participante-b');
    `)
    sqlite.prepare(`INSERT INTO credenciais_operador_portaria_evento
      (id, evento_id, token_hash, expira_em, ativo) VALUES (?, ?, ?, ?, 1)`)
      .run('cred-2', 'evento-2', await hashToken('token-operador-b'), '2099-01-02T02:59:59.000Z')

    const carregar = async (token: string) => {
      const headers = { Authorization: `Bearer ${token}` }
      const sessao = await app.request('/api/v1/portaria-operador-publica/sessao', { headers })
      const participantes = await app.request('/api/v1/portaria-operador-publica/participantes', { headers })
      expect(sessao.status).toBe(200)
      expect(participantes.status).toBe(200)
      return {
        sessao: await sessao.json() as { evento: { id: string } },
        participantes: await participantes.json() as { participantes: Array<{ convocacaoDestinatarioId: string; membro: { id: string } }> },
      }
    }
    const a = await carregar('token-operador-valido')
    const b = await carregar('token-operador-b')
    expect(a.sessao.evento.id).toBe('evento-1')
    expect(b.sessao.evento.id).toBe('evento-2')
    expect(a.participantes.participantes.map(x => [x.membro.id, x.convocacaoDestinatarioId])).toEqual([['participante-a', 'dest-a']])
    expect(b.participantes.participantes.map(x => [x.membro.id, x.convocacaoDestinatarioId])).toEqual([['participante-b', 'dest-b']])
  })

  it('rejeita token desconhecido', async () => {
    const resultado = await validarCredencialOperadorPortaria(db, 'token-inexistente')

    expect(resultado).toMatchObject({
      ok: false,
      status: 401,
      code: 'CREDENCIAL_INVALIDA',
    })
  })

  it('rejeita credencial revogada', async () => {
    sqlite.exec(`
      UPDATE credenciais_operador_portaria_evento
      SET ativo = 0, revogado_em = CURRENT_TIMESTAMP
      WHERE id = 'cred-1';
    `)

    const resultado = await validarCredencialOperadorPortaria(db, 'token-operador-valido')
    expect(resultado).toMatchObject({
      ok: false,
      status: 401,
      code: 'CREDENCIAL_INVALIDA',
    })
  })

  it('credencial temporária solicita fechamento sem encerrar a Portaria', async () => {
    const resposta = await app.request('/api/v1/portaria-operador-publica/solicitar-fechamento', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-operador-valido' },
    })

    expect(resposta.status).toBe(202)
    expect(await resposta.json()).toMatchObject({ status: 'AGUARDANDO_CONFIRMACAO' })

    const solicitacao = sqlite.prepare(
      'SELECT solicitado_por_credencial_id, confirmado_em FROM portaria_solicitacoes_fechamento WHERE evento_id = ?'
    ).get('evento-1') as any
    expect(solicitacao.solicitado_por_credencial_id).toBe('cred-1')
    expect(solicitacao.confirmado_em).toBeNull()

    const fechamento = sqlite.prepare(
      'SELECT id FROM portaria_fechamentos WHERE evento_id = ?'
    ).get('evento-1')
    expect(fechamento).toBeUndefined()
  })

  it('rejeita acesso depois do fechamento da Portaria', async () => {
    sqlite.exec(`
      INSERT INTO portarias_evento (evento_id, status)
      VALUES ('evento-1', 'FECHADA');
    `)

    const resultado = await validarCredencialOperadorPortaria(db, 'token-operador-valido')
    expect(resultado).toMatchObject({
      ok: false,
      status: 409,
      code: 'PORTARIA_FECHADA',
    })
  })
})
