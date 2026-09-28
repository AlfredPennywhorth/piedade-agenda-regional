import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { podeGerenciarAgendaNoEscopo } from '../security/permissoes'
import { setupDb } from './setup'

describe('MVP-AGENDA-02 — governança de escrita da Agenda', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle>
  let app: ReturnType<typeof createApp>

  const ids = {
    r1: '00000000-0000-4000-8000-000000001001',
    r2: '00000000-0000-4000-8000-000000001002',
    a1: '00000000-0000-4000-8000-000000001011',
    a2: '00000000-0000-4000-8000-000000001012',
    s1: '00000000-0000-4000-8000-000000001021',
    s2: '00000000-0000-4000-8000-000000001022',
    c1: '00000000-0000-4000-8000-000000001031',
    c2: '00000000-0000-4000-8000-000000001032',
    c3: '00000000-0000-4000-8000-000000001033',
    gt1: '00000000-0000-4000-8000-000000001041',
    gt2: '00000000-0000-4000-8000-000000001042',
    mCasa: '00000000-0000-4000-8000-000000001051',
    mSetor: '00000000-0000-4000-8000-000000001052',
    mRegional: '00000000-0000-4000-8000-000000001053',
    mMaster: '00000000-0000-4000-8000-000000001054',
    mAlvo: '00000000-0000-4000-8000-000000001055',
    contaCasa: '00000000-0000-4000-8000-000000001061',
    contaSetor: '00000000-0000-4000-8000-000000001062',
    contaRegional: '00000000-0000-4000-8000-000000001063',
    contaMaster: '00000000-0000-4000-8000-000000001064',
    contaAlvo: '00000000-0000-4000-8000-000000001065',
  }

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    db = drizzle(sqlite, { schema })
    app = createApp(db)

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES
        ('${ids.r1}', 'Regional 1'),
        ('${ids.r2}', 'Regional 2');

      INSERT INTO administracoes (id, regional_id, nome) VALUES
        ('${ids.a1}', '${ids.r1}', 'Administração 1'),
        ('${ids.a2}', '${ids.r2}', 'Administração 2');

      INSERT INTO setores (id, administracao_id, nome) VALUES
        ('${ids.s1}', '${ids.a1}', 'Setor 1'),
        ('${ids.s2}', '${ids.a2}', 'Setor 2');

      INSERT INTO casas (id, setor_id, nome) VALUES
        ('${ids.c1}', '${ids.s1}', 'Casa 1'),
        ('${ids.c2}', '${ids.s1}', 'Casa 2'),
        ('${ids.c3}', '${ids.s2}', 'Casa 3');

      INSERT INTO grupos_trabalho
        (id, nome, regional_id, administracao_id, setor_id, ativo)
      VALUES
        ('${ids.gt1}', 'GT 1', '${ids.r1}', NULL, NULL, 1),
        ('${ids.gt2}', 'GT 2', '${ids.r2}', NULL, NULL, 1);

      INSERT INTO membros (id, nome, casa_id, ativo) VALUES
        ('${ids.mCasa}', 'Membro Casa', '${ids.c1}', 1),
        ('${ids.mSetor}', 'Gestor Setor', '${ids.c1}', 1),
        ('${ids.mRegional}', 'Gestor Regional', '${ids.c1}', 1),
        ('${ids.mMaster}', 'Master', '${ids.c1}', 1),
        ('${ids.mAlvo}', 'Membro Alvo', '${ids.c2}', 1);

      INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES
        ('${ids.contaCasa}', '${ids.mCasa}', 'ATIVA', CURRENT_TIMESTAMP),
        ('${ids.contaSetor}', '${ids.mSetor}', 'ATIVA', CURRENT_TIMESTAMP),
        ('${ids.contaRegional}', '${ids.mRegional}', 'ATIVA', CURRENT_TIMESTAMP),
        ('${ids.contaMaster}', '${ids.mMaster}', 'ATIVA', CURRENT_TIMESTAMP),
        ('${ids.contaAlvo}', '${ids.mAlvo}', 'ATIVA', CURRENT_TIMESTAMP);

      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('a-setor', '${ids.contaSetor}', 'GESTOR_AGENDA', 'SETOR', '${ids.s1}'),
        ('a-regional', '${ids.contaRegional}', 'GESTOR_AGENDA', 'REGIONAL', '${ids.r1}'),
        ('a-master', '${ids.contaMaster}', 'MASTER_SISTEMA', 'GLOBAL', NULL);
    `)
  })

  async function sessao(id: string, contaId: string, membroId: string, token: string) {
    const agora = new Date().toISOString()
    sqlite.prepare(`
      INSERT INTO sessoes
        (id, conta_acesso_id, membro_id, token_hash, expira_em, ultimo_acesso_em, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      contaId,
      membroId,
      await hashToken(token),
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      agora,
      agora
    )
  }

  const auth = (token: string) => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  })

  function eventoPayload(casaId: string) {
    return {
      titulo: 'Reunião de teste',
      modalidade: 'ONLINE',
      inicioEm: '2099-01-15T12:00:00.000Z',
      fimEm: '2099-01-15T14:00:00.000Z',
      urlOnline: 'https://meet.example.com/agenda',
      casaId,
    }
  }

  it('todo membro gere automaticamente a Agenda da própria Casa, mas não outra Casa', async () => {
    await expect(
      podeGerenciarAgendaNoEscopo(db, ids.mCasa, 'CASA', ids.c1)
    ).resolves.toBe(true)
    await expect(
      podeGerenciarAgendaNoEscopo(db, ids.mCasa, 'CASA', ids.c2)
    ).resolves.toBe(false)
  })

  it('GESTOR_AGENDA de Setor herda as Casas subordinadas, mas não a Regional', async () => {
    await expect(
      podeGerenciarAgendaNoEscopo(db, ids.mSetor, 'SETOR', ids.s1)
    ).resolves.toBe(true)
    await expect(
      podeGerenciarAgendaNoEscopo(db, ids.mSetor, 'CASA', ids.c2)
    ).resolves.toBe(true)
    await expect(
      podeGerenciarAgendaNoEscopo(db, ids.mSetor, 'REGIONAL', ids.r1)
    ).resolves.toBe(false)
  })

  it('GESTOR_AGENDA Regional herda Administração, Setor, Casa e GT da própria Regional', async () => {
    await expect(
      podeGerenciarAgendaNoEscopo(db, ids.mRegional, 'ADMINISTRACAO', ids.a1)
    ).resolves.toBe(true)
    await expect(
      podeGerenciarAgendaNoEscopo(db, ids.mRegional, 'SETOR', ids.s1)
    ).resolves.toBe(true)
    await expect(
      podeGerenciarAgendaNoEscopo(db, ids.mRegional, 'CASA', ids.c2)
    ).resolves.toBe(true)
    await expect(
      podeGerenciarAgendaNoEscopo(db, ids.mRegional, 'GRUPO_TRABALHO', ids.gt1)
    ).resolves.toBe(true)
    await expect(
      podeGerenciarAgendaNoEscopo(db, ids.mRegional, 'CASA', ids.c3)
    ).resolves.toBe(false)
  })

  it('Master permanece global e independente de vínculo Regional', async () => {
    await expect(
      podeGerenciarAgendaNoEscopo(db, ids.mMaster, 'REGIONAL', ids.r2)
    ).resolves.toBe(true)
    await expect(
      podeGerenciarAgendaNoEscopo(db, ids.mMaster, 'CASA', ids.c3)
    ).resolves.toBe(true)
  })

  it('rota de Eventos permite escrita na Casa própria e bloqueia outra Casa', async () => {
    const token = 'token-casa-agenda'
    await sessao('sessao-casa-agenda', ids.contaCasa, ids.mCasa, token)

    const permitido = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify(eventoPayload(ids.c1)),
    })
    expect(permitido.status).toBe(201)

    const negado = await app.request('/api/v1/eventos', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify(eventoPayload(ids.c2)),
    })
    expect(negado.status).toBe(403)
  })

  it('Gestor da Agenda Regional pode conceder GESTOR_AGENDA na própria Regional', async () => {
    const token = 'token-regional-agenda'
    await sessao('sessao-regional-agenda', ids.contaRegional, ids.mRegional, token)

    const permitido = await app.request('/api/v1/admin/acessos', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({
        contaAcessoId: ids.contaAlvo,
        perfilCodigo: 'GESTOR_AGENDA',
        escopoTipo: 'SETOR',
        escopoId: ids.s1,
      }),
    })
    expect(permitido.status).toBe(201)

    const outroPerfil = await app.request('/api/v1/admin/acessos', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({
        contaAcessoId: ids.contaAlvo,
        perfilCodigo: 'AUDITOR',
        escopoTipo: 'REGIONAL',
        escopoId: ids.r1,
      }),
    })
    expect(outroPerfil.status).toBe(403)

    const outraRegional = await app.request('/api/v1/admin/acessos', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({
        contaAcessoId: ids.contaAlvo,
        perfilCodigo: 'GESTOR_AGENDA',
        escopoTipo: 'REGIONAL',
        escopoId: ids.r2,
      }),
    })
    expect(outraRegional.status).toBe(403)
  })
})
