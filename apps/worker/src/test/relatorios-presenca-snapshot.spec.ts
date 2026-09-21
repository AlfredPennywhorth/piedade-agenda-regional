import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { hashToken } from '../security/tokens'
import { setupDb } from './setup'

describe('REL-PRES-01 — relatórios históricos por snapshot', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle>
  let app: ReturnType<typeof createApp>

  const setorId = 'setor-rel'
  const gestorId = 'gestor-rel'
  const semAcessoId = 'sem-acesso'

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    setupDb(sqlite)
    db = drizzle(sqlite, { schema })
    app = createApp(db)

    sqlite.exec(`
      INSERT INTO regionais (id, nome) VALUES ('regional-rel', 'Regional Relatórios');
      INSERT INTO administracoes (id, regional_id, nome)
        VALUES ('adm-rel', 'regional-rel', 'Administração Relatórios');
      INSERT INTO setores (id, administracao_id, nome)
        VALUES ('${setorId}', 'adm-rel', 'Setor Relatórios');
      INSERT INTO casas (id, setor_id, nome)
        VALUES ('casa-rel', '${setorId}', 'Casa Relatórios');

      INSERT INTO membros (id, nome, casa_id, ativo) VALUES
        ('${gestorId}', 'Gestor Relatórios', 'casa-rel', 1),
        ('gestor-tecnico', 'Gestor Técnico', 'casa-rel', 1),
        ('${semAcessoId}', 'Sem Acesso', 'casa-rel', 1),
        ('membro-alvo', 'Membro Alvo', 'casa-rel', 1),
        ('membro-outro', 'Outro Membro', 'casa-rel', 1);

      INSERT INTO funcoes (id, nome, codigo, ativo)
        VALUES ('func-gestor', 'Gestor Relatórios', 'GESTOR_RELATORIOS', 1);

      INSERT INTO contas_acesso (id, membro_id, status, ativado_em)
        VALUES ('conta-gestor-tecnico', 'gestor-tecnico', 'ATIVA', CURRENT_TIMESTAMP);

      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('acesso-gestor-tecnico', 'conta-gestor-tecnico', 'GESTOR_RELATORIOS', 'SETOR', '${setorId}');

      INSERT INTO vinculos_funcionais
        (id, membro_id, funcao_id, setor_id, ativo)
      VALUES
        ('vinc-gestor', '${gestorId}', 'func-gestor', '${setorId}', 1);

      INSERT INTO eventos
        (id, titulo, modalidade, inicio_em, fim_em, setor_id, ativo)
      VALUES
        ('evento-a', 'Reunião A', 'PRESENCIAL',
         '2026-08-01T10:00:00.000Z', '2026-08-01T12:00:00.000Z', '${setorId}', 1),
        ('evento-b', 'Reunião B', 'PRESENCIAL',
         '2026-09-01T10:00:00.000Z', '2026-09-01T12:00:00.000Z', '${setorId}', 1);

      INSERT INTO portaria_fechamentos
        (id, evento_id, fechado_por_membro_id, fechado_em,
         total_convocados, total_convocados_presentes, total_convocados_ausentes,
         total_convidados_validados, total_convidados_pendentes, total_presentes)
      VALUES
        ('fech-a', 'evento-a', '${gestorId}', '2026-08-01T12:10:00.000Z',
         2, 1, 1, 1, 0, 2),
        ('fech-b', 'evento-b', '${gestorId}', '2026-09-01T12:10:00.000Z',
         1, 1, 0, 0, 1, 1);

      INSERT INTO portaria_fechamento_itens
        (id, fechamento_id, evento_id, tipo_pessoa, origem_id, nome, localidade,
         situacao, resposta_rsvp, forma_presenca, registrado_em)
      VALUES
        ('item-a1', 'fech-a', 'evento-a', 'MEMBRO', 'membro-alvo',
         'Membro Alvo', 'Casa Relatórios', 'PRESENTE', 'PARTICIPAREI',
         'MANUAL', '2026-08-01T10:05:00.000Z'),
        ('item-a2', 'fech-a', 'evento-a', 'MEMBRO', 'membro-outro',
         'Outro Membro', 'Casa Relatórios', 'AUSENTE', 'NAO_PARTICIPAREI',
         NULL, NULL),
        ('item-a3', 'fech-a', 'evento-a', 'CONVIDADO', 'guest-a',
         'Convidado A', 'Localidade A', 'PRESENTE', NULL,
         'VALIDACAO_PORTEIRO', '2026-08-01T10:15:00.000Z'),
        ('item-b1', 'fech-b', 'evento-b', 'MEMBRO', 'membro-alvo',
         'Membro Alvo', 'Casa Relatórios', 'PRESENTE', 'PARTICIPAREI',
         'QR', '2026-09-01T10:03:00.000Z'),
        ('item-b2', 'fech-b', 'evento-b', 'CONVIDADO', 'guest-b',
         'Convidado Pendente', 'Localidade B', 'PENDENTE', NULL,
         NULL, NULL);
    `)
  })

  async function sessao(membroId: string, token: string, contaAcessoId: string | null = null) {
    const tokenHash = await hashToken(token)
    const agora = new Date().toISOString()
    sqlite.prepare(`
      INSERT INTO sessoes
        (id, conta_acesso_id, membro_id, token_hash, expira_em, ultimo_acesso_em, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `sessao-${membroId}`,
      contaAcessoId,
      membroId,
      tokenHash,
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      agora,
      agora
    )
  }

  const auth = (token: string) => ({
    Authorization: `Bearer ${token}`,
  })

  it('relatório final de reunião usa snapshot materializado', async () => {
    await sessao(gestorId, 'token-gestor')

    const res = await app.request('/api/v1/relatorios/presencas/eventos/evento-a/final', {
      headers: auth('token-gestor'),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.fonte).toBe('SNAPSHOT_FECHAMENTO')
    expect(body.resumo).toMatchObject({
      totalConvocados: 2,
      totalConvocadosPresentes: 1,
      totalConvocadosAusentes: 1,
      totalConvidadosValidados: 1,
      totalPresentes: 2,
    })
    expect(body.itens).toHaveLength(3)
  })

  it('perfil técnico GESTOR_RELATORIOS no escopo acessa relatório final', async () => {
    await sessao('gestor-tecnico', 'token-gestor-tecnico', 'conta-gestor-tecnico')

    const res = await app.request('/api/v1/relatorios/presencas/eventos/evento-a/final', {
      headers: auth('token-gestor-tecnico'),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ fonte: 'SNAPSHOT_FECHAMENTO' })
  })

  it('nega relatório final a usuário sem permissão', async () => {
    await sessao(semAcessoId, 'token-sem-acesso')

    const res = await app.request('/api/v1/relatorios/presencas/eventos/evento-a/final', {
      headers: auth('token-sem-acesso'),
    })

    expect(res.status).toBe(403)
  })

  it('histórico de membro lista somente reuniões fechadas autorizadas', async () => {
    await sessao(gestorId, 'token-gestor')

    const res = await app.request(
      '/api/v1/relatorios/presencas/membros/membro-alvo?dataInicio=2026-08-01T00:00:00.000Z&dataFim=2026-09-30T23:59:59.999Z',
      { headers: auth('token-gestor') }
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.membro.nome).toBe('Membro Alvo')
    expect(body.resumo).toEqual({
      totalReunioes: 2,
      totalPresentes: 2,
      totalAusentes: 0,
      taxaPresenca: 100,
    })
    expect(body.reunioes.map((item: any) => item.eventoId)).toEqual(['evento-b', 'evento-a'])
  })

  it('histórico de membro respeita filtro de período', async () => {
    await sessao(gestorId, 'token-gestor')

    const res = await app.request(
      '/api/v1/relatorios/presencas/membros/membro-alvo?dataInicio=2026-09-01T00:00:00.000Z',
      { headers: auth('token-gestor') }
    )

    const body = (await res.json()) as any
    expect(body.resumo.totalReunioes).toBe(1)
    expect(body.reunioes[0].eventoId).toBe('evento-b')
  })

  it('consolidado por período totaliza snapshots do escopo', async () => {
    await sessao(gestorId, 'token-gestor')

    const res = await app.request(
      `/api/v1/relatorios/presencas/periodo?escopoTipo=SETOR&escopoId=${setorId}&dataInicio=2026-08-01T00:00:00.000Z&dataFim=2026-09-30T23:59:59.999Z`,
      { headers: auth('token-gestor') }
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.resumo).toEqual({
      totalEventos: 2,
      totalConvocados: 3,
      totalConvocadosPresentes: 2,
      totalConvocadosAusentes: 1,
      totalConvidadosValidados: 1,
      totalConvidadosPendentes: 1,
      totalPresentes: 3,
      taxaPresencaConvocados: 66.67,
    })
    expect(body.eventos).toHaveLength(2)
  })

  it('nega consolidado para escopo sem autorização', async () => {
    await sessao(semAcessoId, 'token-sem-acesso')

    const res = await app.request(
      `/api/v1/relatorios/presencas/periodo?escopoTipo=SETOR&escopoId=${setorId}`,
      { headers: auth('token-sem-acesso') }
    )

    expect(res.status).toBe(403)
  })
})
