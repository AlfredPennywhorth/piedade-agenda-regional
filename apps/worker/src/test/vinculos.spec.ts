import { describe, it, expect, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'

type VinculoResponse = {
  id: string
  ativo?: boolean
  membro?: { nome: string } | null
  funcao?: { nome: string } | null
  regional?: { nome: string } | null
  administracao?: { nome: string } | null
  setor?: { nome: string } | null
  casa?: { nome: string } | null
  grupoTrabalho?: { nome: string } | null
}

type ErroResponse = {
  error: string
}

type ListaVinculosResponse = VinculoResponse[]

const sqlite = new Database(':memory:')
sqlite.pragma('foreign_keys = ON')

const db = drizzle(sqlite, { schema })
const app = createApp(db)
let authToken = ''

import { setupDb } from './setup'
import { criarSessaoAutenticadaTeste, mesclarAutorizacao } from './auth-test-helper'

beforeAll(async () => {
  setupDb(sqlite)
  authToken = (await criarSessaoAutenticadaTeste(sqlite, 'vinculos-auth')).token
})

const req = async (path: string, options?: RequestInit) => {
  const request = new Request(`http://localhost${path}`, mesclarAutorizacao(authToken, options))
  return app.request(request)
}

describe('Testes de Vínculos Funcionais', () => {
  const membroId = '11111111-1111-4111-8111-111111111111'
  const funcaoId1 = '22222222-2222-4222-8222-222222222222'
  const funcaoId2 = '33333333-3333-4333-8333-333333333333'
  const regId = '44444444-4444-4444-8444-444444444444'
  const admId = '55555555-5555-4555-8555-555555555555'
  const setorId = '66666666-6666-4666-8666-666666666666'
  const casaId = '77777777-7777-4777-8777-777777777777'
  const casaId2 = '88888888-8888-4888-8888-888888888888'
  const gtId = '99999999-9999-4999-8999-999999999999'

  let vinculoCasaId = ''

  beforeAll(() => {
    sqlite.exec(`
      INSERT INTO regionais (id, nome)
      VALUES ('${regId}', 'Regional');

      INSERT INTO administracoes (id, regional_id, nome)
      VALUES ('${admId}', '${regId}', 'Adm');

      INSERT INTO setores (id, administracao_id, nome)
      VALUES ('${setorId}', '${admId}', 'Setor');

      INSERT INTO casas (id, setor_id, nome)
      VALUES ('${casaId}', '${setorId}', 'Casa 1');

      INSERT INTO casas (id, setor_id, nome)
      VALUES ('${casaId2}', '${setorId}', 'Casa 2');

      INSERT INTO grupos_trabalho (id, nome, regional_id)
      VALUES ('${gtId}', 'GT 1', '${regId}');

      INSERT INTO membros (id, nome, casa_id)
      VALUES ('${membroId}', 'Pessoa Teste', '${casaId}');

      INSERT INTO funcoes (id, nome)
      VALUES ('${funcaoId1}', 'Responsável');

      INSERT INTO funcoes (id, nome)
      VALUES ('${funcaoId2}', 'Membro');
    `)
  })

  it('7. criar vínculo Regional', async () => {
    const res = await req('/api/v1/vinculos-funcionais', {
      method: 'POST',
      body: JSON.stringify({
        membroId,
        funcaoId: funcaoId1,
        regionalId: regId,
      }),
    })

    expect(res.status).toBe(201)
  })

  it('8. criar vínculo Administração', async () => {
    const res = await req('/api/v1/vinculos-funcionais', {
      method: 'POST',
      body: JSON.stringify({
        membroId,
        funcaoId: funcaoId1,
        administracaoId: admId,
      }),
    })

    expect(res.status).toBe(201)
  })

  it('9. criar vínculo Setor', async () => {
    const res = await req('/api/v1/vinculos-funcionais', {
      method: 'POST',
      body: JSON.stringify({
        membroId,
        funcaoId: funcaoId1,
        setorId,
      }),
    })

    expect(res.status).toBe(201)
  })

  it('10. criar vínculo Casa', async () => {
    const res = await req('/api/v1/vinculos-funcionais', {
      method: 'POST',
      body: JSON.stringify({
        membroId,
        funcaoId: funcaoId1,
        casaId,
      }),
    })

    const json = (await res.json()) as VinculoResponse

    expect(res.status).toBe(201)
    vinculoCasaId = json.id
  })

  it('11. criar vínculo GT', async () => {
    const res = await req('/api/v1/vinculos-funcionais', {
      method: 'POST',
      body: JSON.stringify({
        membroId,
        funcaoId: funcaoId1,
        grupoTrabalhoId: gtId,
      }),
    })

    expect(res.status).toBe(201)
  })

  it('11 b. listar vínculos com membro, função e escopo resolvidos', async () => {
    const res = await req('/api/v1/vinculos-funcionais')
    const json = (await res.json()) as VinculoResponse[]

    expect(res.status).toBe(200)
    const vinculoGt = json.find(item => item.grupoTrabalho?.nome === 'GT 1')
    expect(vinculoGt).toBeDefined()
    expect(vinculoGt?.membro?.nome).toBe('Pessoa Teste')
    expect(vinculoGt?.funcao?.nome).toBe('Responsável')
    expect(vinculoGt?.grupoTrabalho?.nome).toBe('GT 1')
  })

  it('11 c. detalhar vínculo com relacionamentos resolvidos', async () => {
    const resLista = await req('/api/v1/vinculos-funcionais')
    const lista = (await resLista.json()) as VinculoResponse[]
    const vinculoCasa = lista.find(item => item.casa?.nome === 'Casa 1')

    expect(vinculoCasa).toBeDefined()

    const res = await req(`/api/v1/vinculos-funcionais/${vinculoCasa!.id}`)
    const json = (await res.json()) as VinculoResponse

    expect(res.status).toBe(200)
    expect(json.membro?.nome).toBe('Pessoa Teste')
    expect(json.funcao?.nome).toBe('Responsável')
    expect(json.casa?.nome).toBe('Casa 1')
  })

  it('12. permitir múltiplos vínculos para o mesmo membro', async () => {
    const res = await req(`/api/v1/membros/${membroId}/vinculos`)
    const json = (await res.json()) as ListaVinculosResponse

    expect(res.status).toBe(200)
    expect(json.length).toBe(5)
  })

  it('13. permitir mesma função para duas Casas diferentes', async () => {
    const res = await req('/api/v1/vinculos-funcionais', {
      method: 'POST',
      body: JSON.stringify({
        membroId,
        funcaoId: funcaoId1,
        casaId: casaId2,
      }),
    })

    expect(res.status).toBe(201)
  })

  it('14. impedir duplicata exata membro + função + mesmo escopo', async () => {
    const res = await req('/api/v1/vinculos-funcionais', {
      method: 'POST',
      body: JSON.stringify({
        membroId,
        funcaoId: funcaoId1,
        casaId,
      }),
    })

    const json = (await res.json()) as ErroResponse

    expect(res.status).toBe(400)
    expect(json.error).toContain('Este vínculo já existe e está ativo neste escopo')
  })

  it('15. rejeitar vínculo sem escopo', async () => {
    const res = await req('/api/v1/vinculos-funcionais', {
      method: 'POST',
      body: JSON.stringify({
        membroId,
        funcaoId: funcaoId2,
      }),
    })

    expect(res.status).toBe(400)
  })

  it('16. rejeitar vínculo com dois escopos', async () => {
    const res = await req('/api/v1/vinculos-funcionais', {
      method: 'POST',
      body: JSON.stringify({
        membroId,
        funcaoId: funcaoId2,
        casaId,
        setorId,
      }),
    })

    expect(res.status).toBe(400)
  })

  it('17. rejeitar vínculo com três ou mais escopos', async () => {
    const res = await req('/api/v1/vinculos-funcionais', {
      method: 'POST',
      body: JSON.stringify({
        membroId,
        funcaoId: funcaoId2,
        casaId,
        setorId,
        regionalId: regId,
      }),
    })

    expect(res.status).toBe(400)
  })

  it('21. inativar vínculo', async () => {
    const res = await req(`/api/v1/vinculos-funcionais/${vinculoCasaId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ativo: false,
      }),
    })

    const json = (await res.json()) as VinculoResponse

    expect(res.status).toBe(200)
    expect(json.ativo).toBe(false)
  })

  it('14 b. Deve permitir recriar vínculo exato se o anterior estiver inativo', async () => {
    const res = await req('/api/v1/vinculos-funcionais', {
      method: 'POST',
      body: JSON.stringify({
        membroId,
        funcaoId: funcaoId1,
        casaId,
      }),
    })

    expect(res.status).toBe(201)
  })

  it('Validação de estado resultante no PATCH não pode ter dois escopos', async () => {
    const res = await req(`/api/v1/vinculos-funcionais/${vinculoCasaId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        setorId,
      }),
    })

    const json = (await res.json()) as ErroResponse

    expect(res.status).toBe(400)
    expect(json.error).toContain('exatamente um escopo')
  })
})
