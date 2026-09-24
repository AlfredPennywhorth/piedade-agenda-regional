import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import { setupDb } from './setup'
import { hashToken } from '../security/tokens'

describe('PR-SEC-01 — leitura de Eventos e Convocações por escopo', () => {
  let sqlite: any
  let app: any

  const id = {
    regionalA: '11111111-1111-4111-8111-111111111111',
    regionalB: '22222222-2222-4222-8222-222222222222',
    admA: '33333333-3333-4333-8333-333333333333',
    admB: '44444444-4444-4444-8444-444444444444',
    setorA: '55555555-5555-4555-8555-555555555555',
    setorB: '66666666-6666-4666-8666-666666666666',
    casaA: '77777777-7777-4777-8777-777777777777',
    casaB: '88888888-8888-4888-8888-888888888888',
    membroA: '99999999-9999-4999-8999-999999999999',
    eventoA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    eventoB: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    convocacaoB: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    convocacaoB2: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    funcao: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  }

  async function criarSessao() {
    const contaId = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    const token = 'token-membro-a'
    const tokenHash = await hashToken(token)

    sqlite.prepare(
      "INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES (?, ?, 'ATIVA', CURRENT_TIMESTAMP)"
    ).run(contaId, id.membroA)

    sqlite.prepare(`
      INSERT INTO sessoes
        (id, conta_acesso_id, membro_id, token_hash, expira_em, ultimo_acesso_em)
      VALUES (?, ?, ?, ?, '2099-01-01T00:00:00.000Z', CURRENT_TIMESTAMP)
    `).run('12121212-1212-4212-8212-121212121212', contaId, id.membroA, tokenHash)

    return token
  }

  function req(token: string, path: string) {
    return app.request(
      new Request(`http://localhost${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    )
  }

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    const db = drizzle(sqlite)
    setupDb(sqlite)
    app = createApp(db)

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES
        ('${id.regionalA}', 'Regional A'),
        ('${id.regionalB}', 'Regional B');

      INSERT INTO administracoes (id, regional_id, nome) VALUES
        ('${id.admA}', '${id.regionalA}', 'Administração A'),
        ('${id.admB}', '${id.regionalB}', 'Administração B');

      INSERT INTO setores (id, administracao_id, nome) VALUES
        ('${id.setorA}', '${id.admA}', 'Setor A'),
        ('${id.setorB}', '${id.admB}', 'Setor B');

      INSERT INTO casas (id, setor_id, nome) VALUES
        ('${id.casaA}', '${id.setorA}', 'Casa A'),
        ('${id.casaB}', '${id.setorB}', 'Casa B');

      INSERT INTO membros (id, nome, casa_id, ativo)
      VALUES ('${id.membroA}', 'Membro A', '${id.casaA}', 1);

      INSERT INTO eventos
        (id, titulo, modalidade, inicio_em, fim_em, regional_id, ativo)
      VALUES
        ('${id.eventoA}', 'Evento A', 'ONLINE', '2030-01-01T12:00:00.000Z', '2030-01-01T13:00:00.000Z', '${id.regionalA}', 1),
        ('${id.eventoB}', 'Evento B', 'ONLINE', '2030-01-02T12:00:00.000Z', '2030-01-02T13:00:00.000Z', '${id.regionalB}', 1);

      INSERT INTO convocacoes (id, evento_id, status, ativo) VALUES
        ('${id.convocacaoB}', '${id.eventoB}', 'PUBLICADA', 1),
        ('${id.convocacaoB2}', '${id.eventoB}', 'PUBLICADA', 1);

      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id)
      VALUES ('13131313-1313-4313-8313-131313131313', '${id.convocacaoB}', '${id.membroA}');

      INSERT INTO funcoes (id, nome, codigo, ativo)
      VALUES ('${id.funcao}', 'Função Teste', 'FUNCAO_TESTE', 1);

      INSERT INTO convocacao_funcoes (id, convocacao_id, funcao_id)
      VALUES ('14141414-1414-4414-8414-141414141414', '${id.convocacaoB}', '${id.funcao}');
    `)
  })

  it('lista e detalhe de eventos não expõem outra Regional', async () => {
    const token = await criarSessao()

    const lista = await req(token, '/api/v1/eventos')
    expect(lista.status).toBe(200)
    const eventos = await lista.json() as Array<{ id: string }>
    expect(eventos.map(item => item.id)).toContain(id.eventoA)
    expect(eventos.map(item => item.id)).not.toContain(id.eventoB)

    const fora = await req(token, `/api/v1/eventos/${id.eventoB}`)
    expect(fora.status).toBe(403)
  })

  it('destinatário pode ler a própria convocação mesmo quando o evento está fora do escopo territorial', async () => {
    const token = await criarSessao()

    const detalhe = await req(token, `/api/v1/convocacoes/${id.convocacaoB}`)
    expect(detalhe.status).toBe(200)

    const funcoes = await req(token, `/api/v1/convocacoes/${id.convocacaoB}/funcoes`)
    expect(funcoes.status).toBe(200)

    const lista = await req(token, '/api/v1/convocacoes')
    expect(lista.status).toBe(200)
    const convocacoes = await lista.json() as Array<{ id: string }>
    expect(convocacoes.map(item => item.id)).toContain(id.convocacaoB)
    expect(convocacoes.map(item => item.id)).not.toContain(id.convocacaoB2)
  })

  it('não destinatário recebe 403 ao consultar convocação fora do escopo', async () => {
    const token = await criarSessao()

    const detalhe = await req(token, `/api/v1/convocacoes/${id.convocacaoB2}`)
    expect(detalhe.status).toBe(403)

    const funcoes = await req(token, `/api/v1/convocacoes/${id.convocacaoB2}/funcoes`)
    expect(funcoes.status).toBe(403)
  })
})
