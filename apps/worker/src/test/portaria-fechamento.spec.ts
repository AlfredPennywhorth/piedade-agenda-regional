import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { setupDb } from './setup'

describe('PORT-03 — fechamento e lista final consolidada', () => {
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
      INSERT INTO regionais (id, nome) VALUES ('regional-1', 'Regional 1');
      INSERT INTO administracoes (id, regional_id, nome)
        VALUES ('adm-1', 'regional-1', 'Administração 1');
      INSERT INTO setores (id, administracao_id, nome)
        VALUES ('setor-1', 'adm-1', 'Setor 1');
      INSERT INTO casas (id, setor_id, nome)
        VALUES ('casa-1', 'setor-1', 'Casa 1'),
               ('casa-2', 'setor-1', 'Casa 2');

      INSERT INTO membros (id, nome, casa_id, ativo) VALUES
        ('master', 'Master', 'casa-1', 1),
        ('porteiro', 'Porteiro', 'casa-1', 1),
        ('m1', 'Ana Presente', 'casa-1', 1),
        ('m2', 'Bruno Ausente', 'casa-2', 1);

      INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES
        ('conta-master', 'master', 'ATIVA', CURRENT_TIMESTAMP),
        ('conta-porteiro', 'porteiro', 'ATIVA', CURRENT_TIMESTAMP);

      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES ('acesso-master', 'conta-master', 'MASTER_SISTEMA', 'GLOBAL', NULL);

      INSERT INTO eventos
        (id, titulo, modalidade, inicio_em, fim_em, setor_id, ativo)
      VALUES
        ('evento-1', 'Reunião Final', 'PRESENCIAL',
         '2099-01-01T10:00:00.000Z', '2099-01-01T20:00:00.000Z',
         'setor-1', 1);

      INSERT INTO convocacoes (id, evento_id, status, ativo) VALUES
        ('conv-1', 'evento-1', 'PUBLICADA', 1),
        ('conv-2', 'evento-1', 'PUBLICADA', 1);

      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id) VALUES
        ('dest-1', 'conv-1', 'm1'),
        ('dest-2', 'conv-1', 'm2'),
        ('dest-3', 'conv-2', 'm1');

      INSERT INTO rsvp
        (id, convocacao_destinatario_id, resposta, respondido_em, atualizado_em)
      VALUES
        ('rsvp-1', 'dest-1', 'PARTICIPAREI', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('rsvp-2', 'dest-2', 'NAO_PARTICIPAREI', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

      INSERT INTO checkins
        (id, convocacao_destinatario_id, evento_id, membro_id, forma, status,
         operador_membro_id, data_hora_checkin)
      VALUES
        ('checkin-1', 'dest-1', 'evento-1', 'm1', 'MANUAL', 'ATIVO',
         'porteiro', '2099-01-01T10:10:00.000Z');

      INSERT INTO convidados_evento
        (id, evento_id, nome, localidade, status, ativo)
      VALUES
        ('guest-ok', 'evento-1', 'Convidado Validado', 'Localidade A', 'VALIDADO', 1),
        ('guest-pending', 'evento-1', 'Convidado Pendente', 'Localidade B', 'PENDENTE', 1);

      INSERT INTO presencas_convidado_evento
        (id, convidado_id, evento_id, forma, registrado_por_membro_id, registrado_em)
      VALUES
        ('guest-pres-1', 'guest-ok', 'evento-1', 'VALIDACAO_PORTEIRO',
         'porteiro', '2099-01-01T10:15:00.000Z');
    `)
  })

  async function sessao(id: string, contaId: string, membroId: string, token: string) {
    const tokenHash = await hashToken(token)
    const agora = new Date().toISOString()
    sqlite.prepare(`
      INSERT INTO sessoes
        (id, conta_acesso_id, membro_id, token_hash, expira_em,
         ultimo_acesso_em, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, contaId, membroId, tokenHash, '2099-01-01T22:00:00.000Z', agora, agora)
  }

  const auth = (token: string, json = false) => ({
    Authorization: `Bearer ${token}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  })

  async function prepararPorteiro() {
    await sessao('sessao-master', 'conta-master', 'master', 'token-master')
    await sessao('sessao-porteiro', 'conta-porteiro', 'porteiro', 'token-porteiro')

    const concessao = await app.request('/api/v1/portaria/eventos/evento-1/operadores', {
      method: 'POST',
      headers: auth('token-master', true),
      body: JSON.stringify({ membroId: 'porteiro' }),
    })
    expect(concessao.status).toBe(201)
  }

  it('fecha e consolida convocados únicos, convidados e totais', async () => {
    await prepararPorteiro()

    const fechar = await app.request('/api/v1/portaria/eventos/evento-1/fechar', {
      method: 'POST',
      headers: auth('token-porteiro'),
    })

    expect(fechar.status).toBe(200)
    const body = (await fechar.json()) as any

    expect(body.resumo).toEqual({
      totalConvocados: 2,
      totalConvocadosPresentes: 1,
      totalConvocadosAusentes: 1,
      totalConvidadosValidados: 1,
      totalConvidadosPendentes: 1,
      totalPresentes: 2,
    })

    expect(body.itens).toHaveLength(4)
    expect(body.itens).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tipoPessoa: 'MEMBRO',
        origemId: 'm1',
        nome: 'Ana Presente',
        localidade: 'Casa 1',
        situacao: 'PRESENTE',
        respostaRsvp: 'PARTICIPAREI',
        formaPresenca: 'MANUAL',
      }),
      expect.objectContaining({
        tipoPessoa: 'MEMBRO',
        origemId: 'm2',
        nome: 'Bruno Ausente',
        localidade: 'Casa 2',
        situacao: 'AUSENTE',
        respostaRsvp: 'NAO_PARTICIPAREI',
      }),
      expect.objectContaining({
        tipoPessoa: 'CONVIDADO',
        origemId: 'guest-ok',
        situacao: 'PRESENTE',
      }),
      expect.objectContaining({
        tipoPessoa: 'CONVIDADO',
        origemId: 'guest-pending',
        situacao: 'PENDENTE',
      }),
    ]))
  })

  it('revoga QR de autocadastro no fechamento', async () => {
    await prepararPorteiro()

    sqlite.exec(`
      INSERT INTO credenciais_cadastro_portaria_evento
        (id, evento_id, token_hash, expira_em, criado_por_membro_id, ativo)
      VALUES
        ('cred-1', 'evento-1', 'hash-qualquer', '2099-01-01T20:00:00.000Z',
         'porteiro', 1);
    `)

    const fechar = await app.request('/api/v1/portaria/eventos/evento-1/fechar', {
      method: 'POST',
      headers: auth('token-porteiro'),
    })
    expect(fechar.status).toBe(200)

    const credencial = sqlite.prepare(
      'SELECT ativo, revogado_em FROM credenciais_cadastro_portaria_evento WHERE id = ?'
    ).get('cred-1') as any

    expect(credencial.ativo).toBe(0)
    expect(credencial.revogado_em).toBeTruthy()
  })

  it('o porteiro que fechou continua podendo consultar a lista final após perder autorização temporária', async () => {
    await prepararPorteiro()

    await app.request('/api/v1/portaria/eventos/evento-1/fechar', {
      method: 'POST',
      headers: auth('token-porteiro'),
    })

    const lista = await app.request('/api/v1/portaria/eventos/evento-1/fechamento', {
      headers: auth('token-porteiro'),
    })

    expect(lista.status).toBe(200)
    const body = (await lista.json()) as any
    expect(body.resumo.totalPresentes).toBe(2)
    expect(body.itens).toHaveLength(4)
  })

  it('snapshot permanece imutável mesmo se dados operacionais forem alterados depois', async () => {
    await prepararPorteiro()

    await app.request('/api/v1/portaria/eventos/evento-1/fechar', {
      method: 'POST',
      headers: auth('token-porteiro'),
    })

    sqlite.prepare('UPDATE membros SET nome = ? WHERE id = ?')
      .run('Nome Alterado Depois', 'm1')
    sqlite.prepare('UPDATE casas SET nome = ? WHERE id = ?')
      .run('Casa Alterada Depois', 'casa-1')
    sqlite.prepare('UPDATE convidados_evento SET nome = ? WHERE id = ?')
      .run('Convidado Alterado Depois', 'guest-ok')

    const lista = await app.request('/api/v1/portaria/eventos/evento-1/fechamento', {
      headers: auth('token-porteiro'),
    })

    const body = (await lista.json()) as any
    expect(body.itens).toEqual(expect.arrayContaining([
      expect.objectContaining({ origemId: 'm1', nome: 'Ana Presente', localidade: 'Casa 1' }),
      expect.objectContaining({ origemId: 'guest-ok', nome: 'Convidado Validado' }),
    ]))
  })

  it('segundo fechamento é recusado', async () => {
    await prepararPorteiro()

    const primeiro = await app.request('/api/v1/portaria/eventos/evento-1/fechar', {
      method: 'POST',
      headers: auth('token-porteiro'),
    })
    expect(primeiro.status).toBe(200)

    const segundo = await app.request('/api/v1/portaria/eventos/evento-1/fechar', {
      method: 'POST',
      headers: auth('token-porteiro'),
    })
    expect(segundo.status).toBe(409)
    expect(await segundo.json()).toMatchObject({ code: 'PORTARIA_FECHADA' })
  })
})
