import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { setupDb } from './setup'

describe('QA-MVP-01 — smoke test API ponta a ponta do fluxo principal', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle>
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    db = drizzle(sqlite, { schema })
    app = createApp(db)

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES ('00000000-0000-4000-8000-000000000001', 'Regional MVP');
      INSERT INTO administracoes (id, regional_id, nome)
        VALUES ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Administração MVP');
      INSERT INTO setores (id, administracao_id, nome)
        VALUES ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'Setor MVP');
      INSERT INTO casas (id, setor_id, nome)
        VALUES ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', 'Casa MVP');

      INSERT INTO locais
        (id, nome, endereco, numero, cidade, uf, ativo)
      VALUES
        ('00000000-0000-4000-8000-000000000005', 'Local MVP', 'Rua Teste', '100', 'São Paulo', 'SP', 1);

      INSERT INTO membros (id, nome, celular, casa_id, ativo) VALUES
        ('00000000-0000-4000-8000-000000000006', 'Master MVP', '11900001001', '00000000-0000-4000-8000-000000000004', 1),
        ('00000000-0000-4000-8000-000000000007', 'Participante MVP', '11900001002', '00000000-0000-4000-8000-000000000004', 1),
        ('00000000-0000-4000-8000-000000000008', 'Porteiro MVP', '11900001003', '00000000-0000-4000-8000-000000000004', 1);

      INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES
        ('conta-00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', 'ATIVA', CURRENT_TIMESTAMP),
        ('conta-00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000007', 'ATIVA', CURRENT_TIMESTAMP),
        ('conta-00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000008', 'ATIVA', CURRENT_TIMESTAMP);

      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('acesso-00000000-0000-4000-8000-000000000006', 'conta-00000000-0000-4000-8000-000000000006', 'MASTER_SISTEMA', 'GLOBAL', NULL),
        ('acesso-00000000-0000-4000-8000-000000000007', 'conta-00000000-0000-4000-8000-000000000007', 'USUARIO_COMUM', 'CASA', '00000000-0000-4000-8000-000000000004');

      INSERT INTO funcoes (id, nome, codigo, ativo)
      VALUES ('00000000-0000-4000-8000-000000000014', 'Função Convocada MVP', 'FUNCAO_MVP', 1);

      INSERT INTO vinculos_funcionais
        (id, membro_id, funcao_id, setor_id, ativo)
      VALUES
        ('vinculo-00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000003', 1);
    `)
  })

  async function criarSessao(
    id: string,
    contaId: string,
    membroId: string,
    token: string
  ) {
    const tokenHash = await hashToken(token)
    const agora = new Date().toISOString()

    sqlite.prepare(`
      INSERT INTO sessoes
        (id, conta_acesso_id, membro_id, token_hash, expira_em,
         ultimo_acesso_em, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      contaId,
      membroId,
      tokenHash,
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      agora,
      agora
    )
  }

  const headers = (token: string, json = false) => ({
    Authorization: `Bearer ${token}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  })

  it('percorre criação, convocação, RSVP, Portaria, fechamento e relatório final', async () => {
    await criarSessao(
      'sessao-00000000-0000-4000-8000-000000000006',
      'conta-00000000-0000-4000-8000-000000000006',
      '00000000-0000-4000-8000-000000000006',
      'token-00000000-0000-4000-8000-000000000006'
    )
    await criarSessao(
      'sessao-00000000-0000-4000-8000-000000000007',
      'conta-00000000-0000-4000-8000-000000000007',
      '00000000-0000-4000-8000-000000000007',
      'token-00000000-0000-4000-8000-000000000007'
    )
    await criarSessao(
      'sessao-00000000-0000-4000-8000-000000000008',
      'conta-00000000-0000-4000-8000-000000000008',
      '00000000-0000-4000-8000-000000000008',
      'token-00000000-0000-4000-8000-000000000008'
    )

    const me = await app.request('/api/v1/auth/me', {
      headers: headers('token-00000000-0000-4000-8000-000000000006'),
    })
    expect(me.status).toBe(200)
    expect(await me.json()).toMatchObject({
      id: '00000000-0000-4000-8000-000000000006',
      conta: { status: 'ATIVA' },
      capacidades: { podeAdministrarAcessos: true },
    })

    const criarEvento = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: headers('token-00000000-0000-4000-8000-000000000006', true),
      body: JSON.stringify({
        titulo: 'Reunião Smoke MVP',
        modalidade: 'PRESENCIAL',
        inicioEm: '2099-01-15T12:00:00.000Z',
        fimEm: '2099-01-15T15:00:00.000Z',
        localId: '00000000-0000-4000-8000-000000000005',
        organizadorMembroId: '00000000-0000-4000-8000-000000000006',
        setorId: '00000000-0000-4000-8000-000000000003',
      }),
    })
    expect(criarEvento.status).toBe(201)
    const evento = (await criarEvento.json()) as any
    expect(evento.titulo).toBe('Reunião Smoke MVP')

    const criarConvocacao = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: headers('token-00000000-0000-4000-8000-000000000006', true),
      body: JSON.stringify({ eventoId: evento.id }),
    })
    expect(criarConvocacao.status).toBe(201)
    const convocacao = (await criarConvocacao.json()) as any

    const adicionarFuncao = await app.request(
      `/api/v1/convocacoes/${convocacao.id}/funcoes`,
      {
        method: 'POST',
        headers: headers('token-00000000-0000-4000-8000-000000000006', true),
        body: JSON.stringify({ funcaoId: '00000000-0000-4000-8000-000000000014' }),
      }
    )
    expect(adicionarFuncao.status).toBe(201)

    const publicar = await app.request(
      `/api/v1/convocacoes/${convocacao.id}/publicar`,
      {
        method: 'POST',
        headers: headers('token-00000000-0000-4000-8000-000000000006'),
      }
    )
    expect(publicar.status).toBe(200)
    expect(await publicar.json()).toMatchObject({
      success: true,
      destinatariosGerados: 1,
    })

    const destinatario = sqlite.prepare(
      'SELECT id FROM convocacao_destinatarios WHERE convocacao_id = ? AND membro_id = ?'
    ).get(convocacao.id, '00000000-0000-4000-8000-000000000007') as { id: string } | undefined
    expect(destinatario?.id).toBeTruthy()

    const responderRsvp = await app.request(
      `/api/v1/minha-agenda/rsvp/${destinatario!.id}`,
      {
        method: 'PUT',
        headers: headers('token-00000000-0000-4000-8000-000000000007', true),
        body: JSON.stringify({ resposta: 'PARTICIPAREI' }),
      }
    )
    expect(responderRsvp.status).toBe(200)
    expect(await responderRsvp.json()).toMatchObject({
      convocacaoDestinatarioId: destinatario!.id,
      resposta: 'PARTICIPAREI',
    })

    const autorizarPorteiro = await app.request(
      `/api/v1/portaria/eventos/${evento.id}/operadores`,
      {
        method: 'POST',
        headers: headers('token-00000000-0000-4000-8000-000000000006', true),
        body: JSON.stringify({ membroId: '00000000-0000-4000-8000-000000000008' }),
      }
    )
    expect(autorizarPorteiro.status).toBe(201)

    const checkin = await app.request('/api/v1/checkin/qr', {
      method: 'POST',
      headers: headers('token-00000000-0000-4000-8000-000000000008', true),
      body: JSON.stringify({ qrToken: destinatario!.id }),
    })
    expect(checkin.status).toBe(201)
    expect(await checkin.json()).toMatchObject({
      eventoId: evento.id,
      membroId: '00000000-0000-4000-8000-000000000007',
      forma: 'QR',
    })

    const solicitarFechamento = await app.request(
      `/api/v1/portaria/eventos/${evento.id}/solicitar-fechamento`,
      {
        method: 'POST',
        headers: headers('token-00000000-0000-4000-8000-000000000008'),
      }
    )
    expect(solicitarFechamento.status).toBe(202)

    const fechar = await app.request(
      `/api/v1/portaria/eventos/${evento.id}/fechar`,
      {
        method: 'POST',
        headers: headers('token-00000000-0000-4000-8000-000000000006'),
      }
    )
    expect(fechar.status).toBe(200)
    expect(await fechar.json()).toMatchObject({
      resumo: {
        totalConvocados: 1,
        totalConvocadosPresentes: 1,
        totalConvocadosAusentes: 0,
        totalPresentes: 1,
      },
    })

    const relatorio = await app.request(
      `/api/v1/relatorios/presencas/eventos/${evento.id}/final`,
      {
        headers: headers('token-00000000-0000-4000-8000-000000000006'),
      }
    )
    expect(relatorio.status).toBe(200)
    const bodyRelatorio = (await relatorio.json()) as any
    expect(bodyRelatorio.fonte).toBe('SNAPSHOT_FECHAMENTO')
    expect(bodyRelatorio.resumo).toMatchObject({
      totalConvocados: 1,
      totalConvocadosPresentes: 1,
      totalConvocadosAusentes: 0,
      totalPresentes: 1,
    })
    expect(bodyRelatorio.itens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipoPessoa: 'MEMBRO',
          origemId: '00000000-0000-4000-8000-000000000007',
          situacao: 'PRESENTE',
          respostaRsvp: 'PARTICIPAREI',
          formaPresenca: 'QR',
        }),
      ])
    )
  })
})
