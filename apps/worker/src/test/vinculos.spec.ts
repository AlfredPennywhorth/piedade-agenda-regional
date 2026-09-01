import { describe, it, expect, beforeAll } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'

type VinculoResponse = {
  id: string
  ativo?: boolean
}

type ErroResponse = {
  error: string
}

type ListaVinculosResponse = VinculoResponse[]

const sqlite = new Database(':memory:')
sqlite.pragma('foreign_keys = ON')

const db = drizzle(sqlite, { schema })
const app = createApp(db)

beforeAll(() => {
  const setupSql = `
    CREATE TABLE regionais (
      id text PRIMARY KEY NOT NULL,
      nome text NOT NULL,
      codigo text,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE administracoes (
      id text PRIMARY KEY NOT NULL,
      regional_id text NOT NULL,
      nome text NOT NULL,
      codigo text,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (regional_id) REFERENCES regionais(id)
    );

    CREATE TABLE setores (
      id text PRIMARY KEY NOT NULL,
      administracao_id text NOT NULL,
      nome text NOT NULL,
      codigo text,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (administracao_id) REFERENCES administracoes(id)
    );

    CREATE TABLE casas (
      id text PRIMARY KEY NOT NULL,
      setor_id text NOT NULL,
      nome text NOT NULL,
      codigo text,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (setor_id) REFERENCES setores(id)
    );

    CREATE TABLE grupos_trabalho (
      id text PRIMARY KEY NOT NULL,
      nome text NOT NULL,
      ativo integer DEFAULT true NOT NULL,
      regional_id text,
      administracao_id text,
      setor_id text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (regional_id) REFERENCES regionais(id),
      FOREIGN KEY (administracao_id) REFERENCES administracoes(id),
      FOREIGN KEY (setor_id) REFERENCES setores(id)
    );

    CREATE TABLE membros (
      id text PRIMARY KEY NOT NULL,
      nome text NOT NULL,
      data_nascimento text,
      celular text,
      casa_id text NOT NULL,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (casa_id) REFERENCES casas(id)
    );

    CREATE TABLE funcoes (
      id text PRIMARY KEY NOT NULL,
      nome text NOT NULL,
      codigo text,
      descricao text,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE vinculos_funcionais (
      id text PRIMARY KEY NOT NULL,
      membro_id text NOT NULL,
      funcao_id text NOT NULL,
      regional_id text,
      administracao_id text,
      setor_id text,
      casa_id text,
      grupo_trabalho_id text,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,

      FOREIGN KEY (membro_id) REFERENCES membros(id),
      FOREIGN KEY (funcao_id) REFERENCES funcoes(id),
      FOREIGN KEY (regional_id) REFERENCES regionais(id),
      FOREIGN KEY (administracao_id) REFERENCES administracoes(id),
      FOREIGN KEY (setor_id) REFERENCES setores(id),
      FOREIGN KEY (casa_id) REFERENCES casas(id),
      FOREIGN KEY (grupo_trabalho_id) REFERENCES grupos_trabalho(id),

      CONSTRAINT check_vinculo_escopo_unico CHECK(
        (CASE WHEN regional_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN administracao_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN setor_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN casa_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN grupo_trabalho_id IS NOT NULL THEN 1 ELSE 0 END) = 1
      )
    );

    CREATE UNIQUE INDEX idx_vinculo_unico_regional
      ON vinculos_funcionais (membro_id, funcao_id, regional_id)
      WHERE regional_id IS NOT NULL AND ativo = 1;

    CREATE UNIQUE INDEX idx_vinculo_unico_administracao
      ON vinculos_funcionais (membro_id, funcao_id, administracao_id)
      WHERE administracao_id IS NOT NULL AND ativo = 1;

    CREATE UNIQUE INDEX idx_vinculo_unico_setor
      ON vinculos_funcionais (membro_id, funcao_id, setor_id)
      WHERE setor_id IS NOT NULL AND ativo = 1;

    CREATE UNIQUE INDEX idx_vinculo_unico_casa
      ON vinculos_funcionais (membro_id, funcao_id, casa_id)
      WHERE casa_id IS NOT NULL AND ativo = 1;

    CREATE UNIQUE INDEX idx_vinculo_unico_gt
      ON vinculos_funcionais (membro_id, funcao_id, grupo_trabalho_id)
      WHERE grupo_trabalho_id IS NOT NULL AND ativo = 1;
  `

  sqlite.exec(setupSql)
})

const req = async (path: string, options?: RequestInit) => {
  const request = new Request(`http://localhost${path}`, options)
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
