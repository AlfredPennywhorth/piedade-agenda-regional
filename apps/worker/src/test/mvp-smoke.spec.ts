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
      INSERT INTO regionais (id, nome) VALUES ('regional-mvp', 'Regional MVP');
      INSERT INTO administracoes (id, regional_id, nome)
        VALUES ('adm-mvp', 'regional-mvp', 'Administração MVP');
      INSERT INTO setores (id, administracao_id, nome)
        VALUES ('setor-mvp', 'adm-mvp', 'Setor MVP');
      INSERT INTO casas (id, setor_id, nome)
        VALUES ('casa-mvp', 'setor-mvp', 'Casa MVP');

      INSERT INTO locais
        (id, nome, endereco, numero, cidade, uf, ativo)
      VALUES
        ('local-mvp', 'Local MVP', 'Rua Teste', '100', 'São Paulo', 'SP', 1);

      INSERT INTO membros (id, nome, celular, casa_id, ativo) VALUES
        ('master-mvp', 'Master MVP', '11900001001', 'casa-mvp', 1),
        ('participante-mvp', 'Participante MVP', '11900001002', 'casa-mvp', 1),
        ('porteiro-mvp', 'Porteiro MVP', '11900001003', 'casa-mvp', 1);

      INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES
        ('conta-master-mvp', 'master-mvp', 'ATIVA', CURRENT_TIMESTAMP),
        ('conta-participante-mvp', 'participante-mvp', 'ATIVA', CURRENT_TIMESTAMP),
        ('conta-porteiro-mvp', 'porteiro-mvp', 'ATIVA', CURRENT_TIMESTAMP);

      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('acesso-master-mvp', 'conta-master-mvp', 'MASTER_SISTEMA', 'GLOBAL', NULL),
        ('acesso-participante-mvp', 'conta-participante-mvp', 'USUARIO_COMUM', 'CASA', 'casa-mvp');

      INSERT INTO funcoes (id, nome, codigo, ativo)
      VALUES ('funcao-convocada-mvp', 'Função Convocada MVP', 'FUNCAO_MVP', 1);

      INSERT INTO vinculos_funcionais
        (id, membro_id, funcao_id, setor_id, ativo)
      VALUES
        ('vinculo-participante-mvp', 'participante-mvp', 'funcao-convocada-mvp', 'setor-mvp', 1);
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
      'sessao-master-mvp',
      'conta-master-mvp',
      'master-mvp',
      'token-master-mvp'
    )
    await criarSessao(
      'sessao-participante-mvp',
      'conta-participante-mvp',
      'participante-mvp',
      'token-participante-mvp'
    )
    await criarSessao(
      'sessao-porteiro-mvp',
      'conta-porteiro-mvp',
      'porteiro-mvp',
      'token-porteiro-mvp'
    )

    const me = await app.request('/api/v1/auth/me', {
      headers: headers('token-master-mvp'),
    })
    expect(me.status).toBe(200)
    expect(await me.json()).toMatchObject({
      id: 'master-mvp',
      conta: { status: 'ATIVA' },
      capacidades: { podeAdministrarAcessos: true },
    })

    const criarEvento = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: headers('token-master-mvp', true),
      body: JSON.stringify({
        titulo: 'Reunião Smoke MVP',
        modalidade: 'PRESENCIAL',
        inicioEm: '2099-01-15T12:00:00.000Z',
        fimEm: '2099-01-15T15:00:00.000Z',
        localId: 'local-mvp',
        organizadorMembroId: 'master-mvp',
        setorId: 'setor-mvp',
      }),
    })
    expect(criarEvento.status).toBe(201)
    const evento = (await criarEvento.json()) as any
    expect(evento.titulo).toBe('Reunião Smoke MVP')

    const criarConvocacao = await app.request('/api/v1/convocacoes', {
      method: 'POST',
      headers: headers('token-master-mvp', true),
      body: JSON.stringify({ eventoId: evento.id }),
    })
    expect(criarConvocacao.status).toBe(201)
    const convocacao = (await criarConvocacao.json()) as any

    const adicionarFuncao = await app.request(
      `/api/v1/convocacoes/${convocacao.id}/funcoes`,
      {
        method: 'POST',
        headers: headers('token-master-mvp', true),
        body: JSON.stringify({ funcaoId: 'funcao-convocada-mvp' }),
      }
    )
    expect(adicionarFuncao.status).toBe(201)

    const publicar = await app.request(
      `/api/v1/convocacoes/${convocacao.id}/publicar`,
      {
        method: 'POST',
        headers: headers('token-master-mvp'),
      }
    )
    expect(publicar.status).toBe(200)
    expect(await publicar.json()).toMatchObject({
      success: true,
      destinatariosGerados: 1,
    })

    const destinatario = sqlite.prepare(
      'SELECT id FROM convocacao_destinatarios WHERE convocacao_id = ? AND membro_id = ?'
    ).get(convocacao.id, 'participante-mvp') as { id: string } | undefined
    expect(destinatario?.id).toBeTruthy()

    const responderRsvp = await app.request(
      `/api/v1/rsvp/${destinatario!.id}`,
      {
        method: 'PUT',
        headers: headers('token-participante-mvp', true),
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
        headers: headers('token-master-mvp', true),
        body: JSON.stringify({ membroId: 'porteiro-mvp' }),
      }
    )
    expect(autorizarPorteiro.status).toBe(201)

    const checkin = await app.request('/api/v1/checkin/qr', {
      method: 'POST',
      headers: headers('token-porteiro-mvp', true),
      body: JSON.stringify({ qrToken: destinatario!.id }),
    })
    expect(checkin.status).toBe(201)
    expect(await checkin.json()).toMatchObject({
      eventoId: evento.id,
      membroId: 'participante-mvp',
      forma: 'QR',
    })

    const fechar = await app.request(
      `/api/v1/portaria/eventos/${evento.id}/fechar`,
      {
        method: 'POST',
        headers: headers('token-porteiro-mvp'),
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
        headers: headers('token-master-mvp'),
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
          origemId: 'participante-mvp',
          situacao: 'PRESENTE',
          respostaRsvp: 'PARTICIPAREI',
          formaPresenca: 'QR',
        }),
      ])
    )
  })
})
