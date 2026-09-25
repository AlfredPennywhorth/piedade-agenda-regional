import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import { setupDb } from './setup'
import { hashToken } from '../security/tokens'
import { registrarCienciaPmo } from './responsabilidade-pmo-test-helper'

describe('PR-SEC-01 — leitura de Membros e Vínculos por escopo', () => {
  let sqlite: any
  let app: any

  const ids = {
    regionalA: 'reg-a',
    regionalB: 'reg-b',
    admA: 'adm-a',
    admB: 'adm-b',
    setorA: 'set-a',
    setorB: 'set-b',
    casaA: 'casa-a',
    casaB: 'casa-b',
    comumA: 'm-comum-a',
    comumB: 'm-comum-b',
    adminA: 'm-admin-a',
    master: 'm-master',
    funcao: 'funcao-1',
    vinculoA: 'vinculo-a',
    vinculoB: 'vinculo-b',
    vinculoCruzado: 'vinculo-cruzado',
  }

  async function criarSessao(
    membroId: string,
    token: string,
    perfilCodigo?: string,
    escopoTipo?: string,
    escopoId?: string | null
  ) {
    const contaId = `conta-${membroId}`
    const tokenHash = await hashToken(token)

    sqlite.prepare(
      "INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES (?, ?, 'ATIVA', CURRENT_TIMESTAMP)"
    ).run(contaId, membroId)

    if (perfilCodigo && escopoTipo) {
      sqlite.prepare(`
        INSERT INTO acessos_conta
          (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id, ativo)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(`acesso-${membroId}`, contaId, perfilCodigo, escopoTipo, escopoId ?? null)
      if (perfilCodigo === 'ADMINISTRADOR_SISTEMA' && escopoTipo === 'REGIONAL') {
        registrarCienciaPmo(sqlite, contaId, `acesso-${membroId}`)
      }
    }

    sqlite.prepare(`
      INSERT INTO sessoes
        (id, conta_acesso_id, membro_id, token_hash, expira_em, ultimo_acesso_em)
      VALUES (?, ?, ?, ?, '2099-01-01T00:00:00.000Z', CURRENT_TIMESTAMP)
    `).run(`sessao-${membroId}`, contaId, membroId, tokenHash)

    return token
  }

  function req(token: string, path: string) {
    return app.request(
      new Request(`http://localhost${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    )
  }

  beforeEach(async () => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    const db = drizzle(sqlite)
    setupDb(sqlite)
    app = createApp(db)

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES
        ('${ids.regionalA}', 'Regional A'),
        ('${ids.regionalB}', 'Regional B');

      INSERT INTO administracoes (id, regional_id, nome) VALUES
        ('${ids.admA}', '${ids.regionalA}', 'Administração A'),
        ('${ids.admB}', '${ids.regionalB}', 'Administração B');

      INSERT INTO setores (id, administracao_id, nome) VALUES
        ('${ids.setorA}', '${ids.admA}', 'Setor A'),
        ('${ids.setorB}', '${ids.admB}', 'Setor B');

      INSERT INTO casas (id, setor_id, nome) VALUES
        ('${ids.casaA}', '${ids.setorA}', 'Casa A'),
        ('${ids.casaB}', '${ids.setorB}', 'Casa B');

      INSERT INTO membros (id, nome, casa_id, ativo) VALUES
        ('${ids.comumA}', 'Comum A', '${ids.casaA}', 1),
        ('${ids.comumB}', 'Comum B', '${ids.casaB}', 1),
        ('${ids.adminA}', 'Admin A', '${ids.casaA}', 1),
        ('${ids.master}', 'Master', '${ids.casaA}', 1);

      INSERT INTO funcoes (id, nome, codigo, ativo)
      VALUES ('${ids.funcao}', 'Função Teste', 'FUNCAO_TESTE', 1);

      INSERT INTO vinculos_funcionais
        (id, membro_id, funcao_id, regional_id, ativo)
      VALUES
        ('${ids.vinculoA}', '${ids.comumA}', '${ids.funcao}', '${ids.regionalA}', 1),
        ('${ids.vinculoB}', '${ids.comumB}', '${ids.funcao}', '${ids.regionalB}', 1),
        ('${ids.vinculoCruzado}', '${ids.comumA}', '${ids.funcao}', '${ids.regionalB}', 1);
    `)
  })

  it('usuário comum vê somente o próprio cadastro e recebe 403 para outro membro', async () => {
    const token = await criarSessao(ids.comumA, 'token-comum-a')

    const lista = await req(token, '/api/v1/membros')
    expect(lista.status).toBe(200)
    const pessoas = await lista.json() as Array<{ id: string }>
    expect(pessoas.map(item => item.id)).toEqual([ids.comumA])

    const outro = await req(token, `/api/v1/membros/${ids.comumB}`)
    expect(outro.status).toBe(403)
  })

  it('Administrador Regional vê somente membros da própria Regional', async () => {
    const token = await criarSessao(
      ids.adminA,
      'token-admin-a',
      'ADMINISTRADOR_SISTEMA',
      'REGIONAL',
      ids.regionalA
    )

    const lista = await req(token, '/api/v1/membros')
    expect(lista.status).toBe(200)
    const pessoas = await lista.json() as Array<{ id: string }>
    const visiveis = new Set(pessoas.map(item => item.id))

    expect(visiveis.has(ids.comumA)).toBe(true)
    expect(visiveis.has(ids.adminA)).toBe(true)
    expect(visiveis.has(ids.comumB)).toBe(false)

    const fora = await req(token, `/api/v1/membros/${ids.comumB}`)
    expect(fora.status).toBe(403)
  })

  it('Master continua vendo todos os membros', async () => {
    const token = await criarSessao(
      ids.master,
      'token-master',
      'MASTER_SISTEMA',
      'GLOBAL',
      null
    )

    const lista = await req(token, '/api/v1/membros')
    expect(lista.status).toBe(200)
    const pessoas = await lista.json() as Array<{ id: string }>
    const visiveis = new Set(pessoas.map(item => item.id))

    expect(visiveis.has(ids.comumA)).toBe(true)
    expect(visiveis.has(ids.comumB)).toBe(true)
  })

  it('usuário comum vê somente os próprios vínculos', async () => {
    const token = await criarSessao(ids.comumA, 'token-vinculo-comum')

    const lista = await req(token, '/api/v1/vinculos-funcionais')
    expect(lista.status).toBe(200)
    const vinculos = await lista.json() as Array<{ id: string }>
    expect(new Set(vinculos.map(item => item.id))).toEqual(new Set([ids.vinculoA, ids.vinculoCruzado]))

    const outro = await req(token, `/api/v1/vinculos-funcionais/${ids.vinculoB}`)
    expect(outro.status).toBe(403)
  })

  it('Administrador Regional vê vínculos somente da Regional administrada', async () => {
    const token = await criarSessao(
      ids.adminA,
      'token-vinculo-admin',
      'ADMINISTRADOR_SISTEMA',
      'REGIONAL',
      ids.regionalA
    )

    const lista = await req(token, '/api/v1/vinculos-funcionais')
    expect(lista.status).toBe(200)
    const vinculos = await lista.json() as Array<{ id: string }>
    expect(vinculos.map(item => item.id)).toEqual([ids.vinculoA])

    const fora = await req(token, `/api/v1/vinculos-funcionais/${ids.vinculoB}`)
    expect(fora.status).toBe(403)
  })

  it('endpoint aninhado de membro não expõe vínculo de outra Regional ao Administrador', async () => {
    const token = await criarSessao(
      ids.adminA,
      'token-vinculo-aninhado-admin',
      'ADMINISTRADOR_SISTEMA',
      'REGIONAL',
      ids.regionalA
    )

    const res = await req(token, `/api/v1/membros/${ids.comumA}/vinculos`)
    expect(res.status).toBe(200)

    const vinculos = await res.json() as Array<{ id: string }>
    expect(vinculos.map(item => item.id)).toEqual([ids.vinculoA])
    expect(vinculos.some(item => item.id === ids.vinculoCruzado)).toBe(false)
  })

  it('lista de membros funciona em lotes acima de 90 IDs visíveis', async () => {
    const token = await criarSessao(
      ids.adminA,
      'token-admin-lotes',
      'ADMINISTRADOR_SISTEMA',
      'REGIONAL',
      ids.regionalA
    )

    const insert = sqlite.prepare(
      'INSERT INTO membros (id, nome, casa_id, ativo) VALUES (?, ?, ?, 1)'
    )
    for (let i = 0; i < 120; i++) {
      insert.run(`m-lote-${i}`, `Membro Lote ${i}`, ids.casaA)
    }

    const lista = await req(token, '/api/v1/membros')
    expect(lista.status).toBe(200)
    const pessoas = await lista.json() as Array<{ id: string }>
    expect(pessoas.length).toBeGreaterThanOrEqual(122)
    expect(pessoas.some(item => item.id === 'm-lote-119')).toBe(true)
  })
})
