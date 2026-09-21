import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { setupDb } from './setup'

describe('PORT-02 — convidados eventuais por evento', () => {
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
        VALUES ('casa-1', 'setor-1', 'Casa 1');

      INSERT INTO membros (id, nome, casa_id, ativo) VALUES
        ('membro-master', 'Master', 'casa-1', 1),
        ('porteiro-1', 'Porteiro 1', 'casa-1', 1);

      INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES
        ('conta-master', 'membro-master', 'ATIVA', CURRENT_TIMESTAMP),
        ('conta-porteiro', 'porteiro-1', 'ATIVA', CURRENT_TIMESTAMP);

      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES ('acesso-master', 'conta-master', 'MASTER_SISTEMA', 'GLOBAL', NULL);

      INSERT INTO eventos
        (id, titulo, modalidade, inicio_em, fim_em, setor_id, ativo)
      VALUES
        ('evento-1', 'Evento 1', 'PRESENCIAL',
         '2099-01-01T10:00:00.000Z', '2099-01-01T20:00:00.000Z',
         'setor-1', 1);
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
      '2099-01-01T22:00:00.000Z',
      agora,
      agora
    )
  }

  const auth = (token: string, json = false) => ({
    Authorization: `Bearer ${token}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  })

  async function prepararPorteiro() {
    await criarSessao('sessao-master', 'conta-master', 'membro-master', 'token-master')
    await criarSessao('sessao-porteiro', 'conta-porteiro', 'porteiro-1', 'token-porteiro')

    const concessao = await app.request('/api/v1/portaria/eventos/evento-1/operadores', {
      method: 'POST',
      headers: auth('token-master', true),
      body: JSON.stringify({ membroId: 'porteiro-1' }),
    })

    expect(concessao.status).toBe(201)
  }

  it('porteiro temporário cadastra convidado sem criar membro permanente', async () => {
    await prepararPorteiro()

    const antes = sqlite.prepare('SELECT COUNT(*) AS total FROM membros').get() as any

    const response = await app.request('/api/v1/portaria/eventos/evento-1/convidados', {
      method: 'POST',
      headers: auth('token-porteiro', true),
      body: JSON.stringify({
        nome: 'Convidado Externo',
        referencia: 'Visitante',
      }),
    })

    expect(response.status).toBe(201)
    const body = (await response.json()) as any
    expect(body.nome).toBe('Convidado Externo')
    expect(body.credencial.token).toBeTruthy()
    expect(body.credencial.caminhoPresenca).toContain(body.credencial.token)

    const depois = sqlite.prepare('SELECT COUNT(*) AS total FROM membros').get() as any
    expect(depois.total).toBe(antes.total)

    const credencial = sqlite.prepare(
      'SELECT token_hash FROM credenciais_convidado_evento WHERE convidado_id = ?'
    ).get(body.id) as any

    expect(credencial.token_hash).toBeTruthy()
    expect(credencial.token_hash).not.toBe(body.credencial.token)
  })

  it('link público registra presença uma única vez', async () => {
    await prepararPorteiro()

    const criar = await app.request('/api/v1/portaria/eventos/evento-1/convidados', {
      method: 'POST',
      headers: auth('token-porteiro', true),
      body: JSON.stringify({ nome: 'Convidado Link' }),
    })
    const convidado = (await criar.json()) as any

    const primeira = await app.request(convidado.credencial.caminhoPresenca, {
      method: 'POST',
    })
    expect(primeira.status).toBe(201)
    expect(await primeira.json()).toMatchObject({
      registrado: true,
      convidado: { nome: 'Convidado Link' },
    })

    const segunda = await app.request(convidado.credencial.caminhoPresenca, {
      method: 'POST',
    })
    expect(segunda.status).toBe(409)
  })

  it('porteiro pode registrar presença manual de convidado', async () => {
    await prepararPorteiro()

    const criar = await app.request('/api/v1/portaria/eventos/evento-1/convidados', {
      method: 'POST',
      headers: auth('token-porteiro', true),
      body: JSON.stringify({ nome: 'Convidado Manual' }),
    })
    const convidado = (await criar.json()) as any

    const presenca = await app.request(
      `/api/v1/portaria/eventos/evento-1/convidados/${convidado.id}/presenca`,
      {
        method: 'POST',
        headers: auth('token-porteiro'),
      }
    )

    expect(presenca.status).toBe(201)
    expect(await presenca.json()).toMatchObject({
      convidadoId: convidado.id,
      forma: 'MANUAL',
    })
  })

  it('portaria fechada bloqueia presença pública do convidado', async () => {
    await prepararPorteiro()

    const criar = await app.request('/api/v1/portaria/eventos/evento-1/convidados', {
      method: 'POST',
      headers: auth('token-porteiro', true),
      body: JSON.stringify({ nome: 'Convidado Tardio' }),
    })
    const convidado = (await criar.json()) as any

    const fechar = await app.request('/api/v1/portaria/eventos/evento-1/fechar', {
      method: 'POST',
      headers: auth('token-porteiro'),
    })
    expect(fechar.status).toBe(200)

    const presenca = await app.request(convidado.credencial.caminhoPresenca, {
      method: 'POST',
    })
    expect(presenca.status).toBe(409)
    expect(await presenca.json()).toMatchObject({ code: 'PORTARIA_FECHADA' })
  })

  it('lista convidados com informação de presença sem expor a credencial', async () => {
    await prepararPorteiro()

    const criar = await app.request('/api/v1/portaria/eventos/evento-1/convidados', {
      method: 'POST',
      headers: auth('token-porteiro', true),
      body: JSON.stringify({ nome: 'Convidado Listado' }),
    })
    const convidado = (await criar.json()) as any

    await app.request(
      `/api/v1/portaria/eventos/evento-1/convidados/${convidado.id}/presenca`,
      {
        method: 'POST',
        headers: auth('token-porteiro'),
      }
    )

    const lista = await app.request('/api/v1/portaria/eventos/evento-1/convidados', {
      headers: auth('token-porteiro'),
    })

    expect(lista.status).toBe(200)
    const body = (await lista.json()) as any
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({
      nome: 'Convidado Listado',
      forma: 'MANUAL',
    })
    expect(JSON.stringify(body)).not.toContain('token')
  })
})
