import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { readFileSync } from 'node:fs'
import { URL as NodeURL } from 'node:url'
import { createApp } from '../index'
import * as s from '../db/schema'
import { setupDb } from './setup'
import { hashToken } from '../security/tokens'
import { registrarCienciaPmo } from './responsabilidade-pmo-test-helper'
const uuid = () => crypto.randomUUID()

describe('Eventos pessoais e segregação', () => {
  let sqlite: Database.Database, db: any, app: ReturnType<typeof createApp>
  let reg: string, outraReg: string, adm: string, outraAdm: string, setor: string
  let casa: string,
    irma: string,
    outroSetor: string,
    casaOutraAdm: string,
    casaOutraReg: string,
    gt: string
  let autor: { id: string; token: string }, colega: typeof autor, master: typeof autor
  const horario = { inicioEm: '2099-10-10T10:00:00.000Z', fimEm: '2099-10-10T12:00:00.000Z' }
  async function usuario(
    casaId: string,
    perfil = 'USUARIO_COMUM',
    tipo = 'CASA',
    escopoId: string | null = casaId
  ) {
    const id = uuid(),
      contaId = uuid(),
      token = uuid(),
      acessoId = uuid()
    await db.insert(s.membros).values({ id, nome: id, casaId, ativo: true })
    await db.insert(s.contasAcesso).values({ id: contaId, membroId: id, status: 'ATIVA' })
    await db.insert(s.acessosConta).values({
      id: acessoId,
      contaAcessoId: contaId,
      perfilCodigo: perfil,
      escopoTipo: tipo,
      escopoId,
    })
    if (perfil === 'ADMINISTRADOR_SISTEMA') registrarCienciaPmo(sqlite, contaId, acessoId)
    await db.insert(s.sessoes).values({
      id: uuid(),
      contaAcessoId: contaId,
      membroId: id,
      tokenHash: await hashToken(token),
      expiraEm: '2099-12-31T00:00:00Z',
    })
    return { id, token }
  }
  function req(u: typeof autor, path: string, method = 'GET', body?: unknown) {
    return app.request(`/api/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }
  async function evento(escopo: Record<string, string>, overrides: Record<string, unknown> = {}) {
    const id = uuid()
    await db.insert(s.eventos).values({
      id,
      titulo: id,
      modalidade: 'ONLINE',
      urlOnline: 'https://example.org/reuniao',
      ...horario,
      criadorMembroId: colega.id,
      ...escopo,
      ...overrides,
    })
    return id
  }
  const visiveis = async (u: typeof autor) =>
    ((await (await req(u, '/eventos')).json()) as Array<{ id: string }>).map(e => e.id)
  beforeEach(async () => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    db = drizzle(sqlite)
    app = createApp(db)
    reg = uuid()
    outraReg = uuid()
    adm = uuid()
    outraAdm = uuid()
    setor = uuid()
    casa = uuid()
    irma = uuid()
    outroSetor = uuid()
    casaOutraAdm = uuid()
    casaOutraReg = uuid()
    gt = uuid()
    await db.insert(s.regionais).values([
      { id: reg, nome: 'Reg' },
      { id: outraReg, nome: 'Outra' },
    ])
    const admOutraReg = uuid(),
      setorIrmao = uuid(),
      setorOutraAdm = uuid(),
      setorOutraReg = uuid()
    await db.insert(s.administracoes).values([
      { id: adm, regionalId: reg, nome: 'Adm' },
      { id: outraAdm, regionalId: reg, nome: 'Outra' },
      { id: admOutraReg, regionalId: outraReg, nome: 'Outra Reg' },
    ])
    await db.insert(s.setores).values([
      { id: setor, administracaoId: adm, nome: 'Setor' },
      { id: setorIrmao, administracaoId: adm, nome: 'Irmao' },
      { id: setorOutraAdm, administracaoId: outraAdm, nome: 'Outra Adm' },
      { id: setorOutraReg, administracaoId: admOutraReg, nome: 'Outra Reg' },
    ])
    await db.insert(s.casas).values([
      { id: casa, setorId: setor, nome: 'Casa' },
      { id: irma, setorId: setor, nome: 'Irma' },
      { id: outroSetor, setorId: setorIrmao, nome: 'Outro Setor' },
      { id: casaOutraAdm, setorId: setorOutraAdm, nome: 'Outra Adm' },
      { id: casaOutraReg, setorId: setorOutraReg, nome: 'Outra Reg' },
    ])
    await db.insert(s.gruposTrabalho).values({ id: gt, regionalId: reg, nome: 'GT' })
    autor = await usuario(casa)
    colega = await usuario(casa)
    master = await usuario(casa, 'MASTER_SISTEMA', 'GLOBAL', null)
  })
  afterEach(() => sqlite.close())
  it('cria Próprio com autor da sessão e agenda sem convocação ou RSVP', async () => {
    const res = await req(autor, '/eventos', 'POST', {
      titulo: 'Meu compromisso',
      modalidade: 'ONLINE',
      ...horario,
      urlOnline: 'https://example.org',
      casaId: casa,
      pessoal: true,
      criadorMembroId: colega.id,
    })
    expect(res.status).toBe(201)
    const e = (await res.json()) as any
    expect(e).toMatchObject({
      criadorMembroId: autor.id,
      organizadorMembroId: autor.id,
      pessoal: true,
    })
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM convocacoes').get()).toEqual({ n: 0 })
    const agenda = (await (await req(autor, '/minha-agenda')).json()) as any[]
    expect(agenda).toHaveLength(1)
    expect(agenda[0]).toMatchObject({
      evento: { id: e.id },
      convocacao: null,
      destinatarioId: null,
      rsvp: null,
    })
    expect(await (await req(colega, '/minha-agenda')).json()).toEqual([])
    expect(await (await req(master, '/minha-agenda')).json()).toEqual([])
  })
  it('evento institucional não entra na agenda sem convocação publicada', async () => {
    await evento({ casaId: casa }, { criadorMembroId: autor.id })
    expect(await (await req(autor, '/minha-agenda')).json()).toEqual([])
  })
  it('pessoal só é acessível ao autor e Master, inclusive recursos auxiliares', async () => {
    const id = await evento(
      { casaId: casa },
      { pessoal: true, criadorMembroId: autor.id, organizadorMembroId: autor.id }
    )
    const gestor = await usuario(casa, 'GESTOR_AGENDA', 'REGIONAL', reg),
      relator = await usuario(casa, 'GESTOR_RELATORIOS', 'CASA', casa)
    for (const u of [colega, gestor, relator]) {
      expect(await visiveis(u)).not.toContain(id)
      for (const path of [
        `/eventos/${id}`,
        `/eventos/${id}/refeicoes`,
        `/relatorios/eventos/${id}`,
      ])
        expect((await req(u, path)).status).toBe(403)
      expect((await req(u, `/eventos/${id}`, 'PATCH', { titulo: 'Intrusão' })).status).toBe(403)
      expect((await req(u, `/eventos/${id}/cancelar`, 'POST', {})).status).toBe(403)
      expect(
        (await req(u, `/portaria/eventos/${id}/credenciais-operador`, 'POST', {})).status
      ).toBe(403)
    }
    expect(await visiveis(autor)).toContain(id)
    expect(await visiveis(master)).toContain(id)
    for (const u of [autor, master])
      expect((await req(u, `/eventos/${id}`, 'PATCH', { titulo: 'Alterado' })).status).toBe(200)
  })
  it('usuário comum não vê eventos dos colegas nem rascunhos ancestrais', async () => {
    await evento({ casaId: casa })
    await evento({ regionalId: reg })
    await evento({ setorId: setor })
    const meu = await evento({ casaId: casa }, { criadorMembroId: autor.id })
    expect(await visiveis(autor)).toEqual([meu])
  })
  it.each(['CASA', 'SETOR', 'ADMINISTRACAO', 'REGIONAL', 'GRUPO_TRABALHO'])(
    'gestor %s vê só seu escopo e descendentes',
    async tipo => {
      const gestor = await usuario(
        casa,
        'GESTOR_AGENDA',
        tipo,
        (
          {
            CASA: casa,
            SETOR: setor,
            ADMINISTRACAO: adm,
            REGIONAL: reg,
            GRUPO_TRABALHO: gt,
          } as Record<string, string>
        )[tipo]
      )
      const eventos = {
        casa: await evento({ casaId: casa }),
        irma: await evento({ casaId: irma }),
        outroSetor: await evento({ casaId: outroSetor }),
        outraAdm: await evento({ casaId: casaOutraAdm }),
        outraReg: await evento({ casaId: casaOutraReg }),
        setor: await evento({ setorId: setor }),
        adm: await evento({ administracaoId: adm }),
        regional: await evento({ regionalId: reg }),
        gt: await evento({ grupoTrabalhoId: gt }),
      }
      const esperados = (
        {
          CASA: ['casa'],
          SETOR: ['casa', 'irma', 'setor'],
          ADMINISTRACAO: ['casa', 'irma', 'outroSetor', 'setor', 'adm'],
          REGIONAL: ['casa', 'irma', 'outroSetor', 'outraAdm', 'setor', 'adm', 'regional', 'gt'],
          GRUPO_TRABALHO: ['gt'],
        } as Record<string, Array<keyof typeof eventos>>
      )[tipo].map(k => eventos[k])
      const pessoal = await evento({ casaId: casa }, { pessoal: true })
      expect((await visiveis(gestor)).sort()).toEqual(esperados.sort())
      expect(await visiveis(master)).toHaveLength(10)
      expect(await visiveis(master)).toContain(pessoal)
    }
  )
  it('administrador regional respeita a regional concedida', async () => {
    const admin = await usuario(casa, 'ADMINISTRADOR_SISTEMA', 'REGIONAL', reg)
    const dentro = await evento({ casaId: casaOutraAdm })
    await evento({ casaId: casaOutraReg })
    expect(await visiveis(admin)).toEqual([dentro])
  })
  it('destinatário vê evento publicado fora do território e perde acesso ao cancelar convocação', async () => {
    const id = await evento({ casaId: casaOutraReg }),
      convocacaoId = uuid()
    await db.insert(s.convocacoes).values({ id: convocacaoId, eventoId: id, status: 'RASCUNHO' })
    await db
      .insert(s.convocacaoDestinatarios)
      .values({ id: uuid(), convocacaoId, membroId: autor.id })
    expect(await visiveis(autor)).not.toContain(id)
    sqlite.prepare("UPDATE convocacoes SET status = 'PUBLICADA' WHERE id = ?").run(convocacaoId)
    expect(await visiveis(autor)).toContain(id)
    expect((await req(autor, `/eventos/${id}`)).status).toBe(200)
    sqlite.prepare("UPDATE convocacoes SET status = 'CANCELADA' WHERE id = ?").run(convocacaoId)
    expect((await req(autor, `/eventos/${id}`)).status).toBe(403)
  })
  it('própria Casa ou delegação em outra Regional não autoriza editar evento alheio', async () => {
    const id = await evento({ casaId: casa }),
      outroGestor = await usuario(casa, 'GESTOR_AGENDA', 'REGIONAL', outraReg)
    for (const u of [autor, outroGestor])
      expect((await req(u, `/eventos/${id}`, 'PATCH', { titulo: 'Intrusão' })).status).toBe(403)
    const gestor = await usuario(casa, 'GESTOR_AGENDA', 'SETOR', setor)
    expect((await req(gestor, `/eventos/${id}`, 'PATCH', { titulo: 'Autorizado' })).status).toBe(
      200
    )
  })
  it('gestor não usa a própria Casa para mover evento alheio para fora da delegação', async () => {
    const gestor = await usuario(casa, 'GESTOR_AGENDA', 'REGIONAL', outraReg)
    const id = await evento({ casaId: casaOutraReg })
    expect((await req(gestor, `/eventos/${id}`, 'PATCH', { casaId: casa })).status).toBe(403)
    expect(
      (await req(gestor, `/eventos/${id}`, 'PATCH', { titulo: 'Dentro da delegação' })).status
    ).toBe(200)
  })

  it('autor mantém gestão do evento pessoal original quando muda de Casa', async () => {
    const id = await evento(
      { casaId: casa },
      { pessoal: true, criadorMembroId: autor.id, organizadorMembroId: autor.id }
    )
    sqlite.prepare('UPDATE membros SET casa_id = ? WHERE id = ?').run(casaOutraReg, autor.id)
    expect(
      (await req(autor, `/eventos/${id}`, 'PATCH', { titulo: 'Pessoal preservado' })).status
    ).toBe(200)
    expect((await req(autor, `/eventos/${id}`, 'PATCH', { casaId: casaOutraAdm })).status).toBe(403)
  })

  it('convocação não permite contornar a restrição de gestão de evento alheio', async () => {
    const id = await evento({ casaId: casa })
    expect((await req(autor, '/convocacoes', 'POST', { eventoId: id })).status).toBe(403)
    const convocacaoId = uuid()
    await db.insert(s.convocacoes).values({ id: convocacaoId, eventoId: id, status: 'RASCUNHO' })
    for (const path of [
      `/convocacoes/${convocacaoId}`,
      `/convocacoes/${convocacaoId}/funcoes`,
      `/convocacoes/${convocacaoId}/destinatarios`,
    ])
      expect((await req(autor, path)).status).toBe(403)
    expect(await (await req(autor, '/convocacoes')).json()).toEqual([])
  })
  it('API distingue consulta de gestão para destinatários', async () => {
    const id = await evento({ casaId: casa }),
      convocacaoId = uuid()
    await db.insert(s.convocacoes).values({ id: convocacaoId, eventoId: id, status: 'PUBLICADA' })
    await db
      .insert(s.convocacaoDestinatarios)
      .values({ id: uuid(), convocacaoId, membroId: autor.id })
    const data = (await (await req(autor, '/eventos')).json()) as any[]
    expect(data[0]).toMatchObject({ id, podeGerenciar: false })
    expect(await (await req(colega, `/eventos/${id}`)).json()).toMatchObject({
      podeGerenciar: true,
    })
  })
  it('rejeita pessoal fora de Casa, transferência e conversão; cancelar remove da agenda', async () => {
    const base = {
      titulo: 'Pessoal',
      modalidade: 'ONLINE',
      ...horario,
      urlOnline: 'https://example.org',
      pessoal: true,
    }
    expect((await req(master, '/eventos', 'POST', { ...base, regionalId: reg })).status).toBe(400)
    expect(
      (
        await req(autor, '/eventos', 'POST', {
          ...base,
          casaId: casa,
          organizadorMembroId: colega.id,
        })
      ).status
    ).toBe(403)
    const id = await evento(
      { casaId: casa },
      { pessoal: true, criadorMembroId: autor.id, organizadorMembroId: autor.id }
    )
    expect((await req(autor, `/eventos/${id}`, 'PATCH', { pessoal: false })).status).toBe(409)
    expect(
      (await req(autor, `/eventos/${id}`, 'PATCH', { organizadorMembroId: colega.id })).status
    ).toBe(403)
    expect((await req(master, '/convocacoes', 'POST', { eventoId: id })).status).toBe(409)
    expect((await req(autor, `/eventos/${id}/cancelar`, 'POST', {})).status).toBe(200)
    expect(await (await req(autor, '/minha-agenda')).json()).toEqual([])
  })
  it('pessoal participa dos conflitos e priorização sem RSVP', async () => {
    const id = await evento({ casaId: casa }, { pessoal: true, criadorMembroId: autor.id })
    await evento({ casaId: casa }, { pessoal: true, criadorMembroId: autor.id })
    const agenda = (await (await req(autor, '/minha-agenda')).json()) as any[]
    expect(agenda.every(e => e.conflito?.tipo === 'SOBREPOSICAO')).toBe(true)
    expect((await req(autor, `/minha-agenda/prioridade/${id}`, 'POST', {})).status).toBe(200)
  })
})

it('migração preserva público, recupera autoria e impede pessoal inválido ou convocação', () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(
      `CREATE TABLE membros (id text PRIMARY KEY); CREATE TABLE eventos (id text PRIMARY KEY, organizador_membro_id text, serie_recorrencia_id text, casa_id text, ativo integer); CREATE TABLE auditoria_logs (recurso_tipo text, recurso_id text, acao text, ator_membro_id text, criado_em text, id text); CREATE TABLE convocacoes (id text PRIMARY KEY, evento_id text); INSERT INTO membros VALUES ('autor'), ('organizador'); INSERT INTO eventos VALUES ('antigo', 'organizador', NULL, 'casa', 1), ('serie', NULL, 's1', 'casa', 1); INSERT INTO auditoria_logs VALUES ('EVENTO', 'antigo', 'EVENTO_CRIADO', 'autor', '2026-01-01', 'a1'), ('SERIE_RECORRENCIA', 's1', 'SERIE_RECORRENCIA_CRIADA', 'autor', '2026-01-01', 'a2');`
    )
    sqlite.exec(
      readFileSync(new NodeURL('../../drizzle/0042_eventos_pessoais.sql', import.meta.url), 'utf8')
    )
    expect(
      sqlite.prepare('SELECT id, pessoal, criador_membro_id FROM eventos ORDER BY id').all()
    ).toEqual([
      { id: 'antigo', pessoal: 0, criador_membro_id: 'autor' },
      { id: 'serie', pessoal: 0, criador_membro_id: 'autor' },
    ])
    expect(() => sqlite.exec("INSERT INTO eventos (id, pessoal) VALUES ('invalido', 1)")).toThrow(
      'EVENTO_PESSOAL_INVALIDO'
    )
    sqlite.exec("UPDATE eventos SET pessoal = 1 WHERE id = 'antigo'")
    expect(() => sqlite.exec("INSERT INTO convocacoes VALUES ('c1', 'antigo')")).toThrow(
      'EVENTO_PESSOAL_SEM_CONVOCACAO'
    )
  } finally {
    sqlite.close()
  }
})
