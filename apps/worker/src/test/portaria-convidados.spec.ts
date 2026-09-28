import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { setupDb } from './setup'

describe('PORT-02 — autocadastro de convidados e validação pelo porteiro', () => {
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

  async function criarSessao(id: string, contaId: string, membroId: string, token: string) {
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
    await criarSessao('sessao-master', 'conta-master', 'membro-master', 'token-master')
    await criarSessao('sessao-porteiro', 'conta-porteiro', 'porteiro-1', 'token-porteiro')

    const concessao = await app.request('/api/v1/portaria/eventos/evento-1/operadores', {
      method: 'POST',
      headers: auth('token-master', true),
      body: JSON.stringify({ membroId: 'porteiro-1' }),
    })
    expect(concessao.status).toBe(201)
  }

  async function gerarCredencial() {
    const res = await app.request('/api/v1/portaria/eventos/evento-1/cadastro-convidados/credencial', {
      method: 'POST',
      headers: auth('token-porteiro'),
    })
    expect(res.status).toBe(201)
    return (await res.json()) as any
  }

  it('porteiro gera QR reutilizável do evento e token não fica em claro no banco', async () => {
    await prepararPorteiro()
    const gerada = await gerarCredencial()

    expect(gerada.credencial.token).toBeTruthy()
    expect(gerada.credencial.caminhoCadastro).toContain('/c?p=')

    const row = sqlite.prepare(
      'SELECT token_hash FROM credenciais_cadastro_portaria_evento WHERE evento_id = ?'
    ).get('evento-1') as any

    expect(row.token_hash).toBeTruthy()
    expect(row.token_hash).not.toBe(gerada.credencial.token)
  })

  it('QR de convidados permanece válido até o fim do dia da reunião em São Paulo', async () => {
    await prepararPorteiro()
    const gerada = await gerarCredencial()

    expect(gerada.credencial.expiraEm).toBe('2099-01-02T02:59:59.000Z')

    const row = sqlite.prepare(
      'SELECT expira_em FROM credenciais_cadastro_portaria_evento WHERE evento_id = ?'
    ).get('evento-1') as { expira_em: string }

    expect(row.expira_em).toBe('2099-01-02T02:59:59.000Z')
  })

  it('mesmo QR permite autocadastro de vários convidados sem criar membros', async () => {
    await prepararPorteiro()
    const gerada = await gerarCredencial()
    const antes = (sqlite.prepare('SELECT COUNT(*) AS total FROM membros').get() as any).total

    for (const [nome, localidade] of [
      ['Convidado Um', 'Casa A'],
      ['Convidado Dois', 'Casa B'],
    ]) {
      const res = await app.request(gerada.credencial.endpointCadastro, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, localidade }),
      })
      expect(res.status).toBe(201)
      expect(await res.json()).toMatchObject({
        cadastrado: true,
        convidado: { nome, localidade, status: 'PENDENTE' },
      })
    }

    const depois = (sqlite.prepare('SELECT COUNT(*) AS total FROM membros').get() as any).total
    expect(depois).toBe(antes)

    const convidados = sqlite.prepare(
      'SELECT nome, status FROM convidados_evento WHERE evento_id = ? ORDER BY nome'
    ).all('evento-1') as Array<{ nome: string; status: string }>
    expect(convidados).toEqual([
      { nome: 'Convidado Dois', status: 'PENDENTE' },
      { nome: 'Convidado Um', status: 'PENDENTE' },
    ])
  })

  it('autocadastro não cria presença antes da validação do porteiro', async () => {
    await prepararPorteiro()
    const gerada = await gerarCredencial()

    const cadastro = await app.request(gerada.credencial.endpointCadastro, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Convidado Pendente',
        localidade: 'Casa Teste',
        referencia: 'Visitante',
      }),
    })
    expect(cadastro.status).toBe(201)

    const presencas = sqlite.prepare(
      'SELECT COUNT(*) AS total FROM presencas_convidado_evento'
    ).get() as any
    expect(presencas.total).toBe(0)
  })

  it('porteiro valida convidado pendente e somente então registra presença', async () => {
    await prepararPorteiro()
    const gerada = await gerarCredencial()

    const cadastro = await app.request(gerada.credencial.endpointCadastro, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Convidado Validado', localidade: 'Casa Teste' }),
    })
    const convidado = ((await cadastro.json()) as any).convidado

    const validar = await app.request(
      `/api/v1/portaria/eventos/evento-1/convidados/${convidado.id}/validar`,
      { method: 'POST', headers: auth('token-porteiro') }
    )

    expect(validar.status).toBe(201)
    expect(await validar.json()).toMatchObject({
      convidadoId: convidado.id,
      status: 'VALIDADO',
      forma: 'VALIDACAO_PORTEIRO',
    })

    const row = sqlite.prepare(
      'SELECT status, validado_por_membro_id FROM convidados_evento WHERE id = ?'
    ).get(convidado.id) as any
    expect(row.status).toBe('VALIDADO')
    expect(row.validado_por_membro_id).toBe('porteiro-1')

    const presenca = sqlite.prepare(
      'SELECT forma, registrado_por_membro_id FROM presencas_convidado_evento WHERE convidado_id = ?'
    ).get(convidado.id) as any
    expect(presenca.forma).toBe('VALIDACAO_PORTEIRO')
    expect(presenca.registrado_por_membro_id).toBe('porteiro-1')
  })

  it('lista pendentes para validação sem expor token', async () => {
    await prepararPorteiro()
    const gerada = await gerarCredencial()

    await app.request(gerada.credencial.endpointCadastro, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Convidado na Fila',
        localidade: 'Localidade X',
        observacoes: 'Primeira visita',
      }),
    })

    const lista = await app.request('/api/v1/portaria/eventos/evento-1/convidados', {
      headers: auth('token-porteiro'),
    })
    expect(lista.status).toBe(200)

    const body = (await lista.json()) as any
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({
      nome: 'Convidado na Fila',
      localidade: 'Localidade X',
      status: 'PENDENTE',
      presencaId: null,
    })
    expect(JSON.stringify(body)).not.toContain('token')
  })

  it('portaria fechada bloqueia novos autocadastros', async () => {
    await prepararPorteiro()
    const gerada = await gerarCredencial()

    const solicitar = await app.request('/api/v1/portaria/eventos/evento-1/solicitar-fechamento', {
      method: 'POST',
      headers: auth('token-porteiro'),
    })
    expect(solicitar.status).toBe(202)

    const fechar = await app.request('/api/v1/portaria/eventos/evento-1/fechar', {
      method: 'POST',
      headers: auth('token-master'),
    })
    expect(fechar.status).toBe(200)

    const cadastro = await app.request(gerada.credencial.endpointCadastro, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Chegou Tarde', localidade: 'Casa Y' }),
    })
    expect(cadastro.status).toBe(409)
    expect(await cadastro.json()).toMatchObject({ code: 'PORTARIA_FECHADA' })
  })

  it('cadastro manual permanece disponível como contingência e já registra presença', async () => {
    await prepararPorteiro()

    const res = await app.request('/api/v1/portaria/eventos/evento-1/convidados', {
      method: 'POST',
      headers: auth('token-porteiro', true),
      body: JSON.stringify({
        nome: 'Sem Celular',
        localidade: 'Casa Z',
      }),
    })

    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ status: 'VALIDADO' })

    const presenca = sqlite.prepare(
      'SELECT forma FROM presencas_convidado_evento'
    ).get() as any
    expect(presenca.forma).toBe('MANUAL')
  })
})
