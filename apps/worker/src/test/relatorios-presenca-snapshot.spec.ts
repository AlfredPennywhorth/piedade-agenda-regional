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

      INSERT INTO contas_acesso (id, membro_id, status, ativado_em) VALUES
        ('conta-gestor', '${gestorId}', 'ATIVA', CURRENT_TIMESTAMP),
        ('conta-gestor-tecnico', 'gestor-tecnico', 'ATIVA', CURRENT_TIMESTAMP);

      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
      VALUES
        ('acesso-gestor', 'conta-gestor', 'GESTOR_RELATORIOS', 'SETOR', '${setorId}'),
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



  it('seleciona Setor responsável do GT regional sem alterar o escopo da reunião', async () => {
    await sessao(gestorId, 'token-gestor', 'conta-gestor')
    sqlite.exec(`
      INSERT INTO setores (id, administracao_id, nome, cnpj)
        VALUES ('setor-candidato', 'adm-rel', 'Setor de Apoio', '61526398000431');
      INSERT INTO regionais (id, nome) VALUES ('reg-outra', 'Outra Regional');
      INSERT INTO administracoes (id, regional_id, nome)
        VALUES ('adm-outra', 'reg-outra', 'Outra Administração');
      INSERT INTO setores (id, administracao_id, nome, cnpj)
        VALUES ('setor-fora', 'adm-outra', 'Setor Fora de Escopo', '61526398000432');
      INSERT INTO grupos_trabalho (id, nome, regional_id)
        VALUES ('gt-secretaria', 'Secretaria', 'regional-rel');
      INSERT INTO locais (id, nome, endereco, numero, cidade, uf)
        VALUES ('sede-gt', 'Sede GT', 'Rua Exemplo', '100', 'São Paulo', 'SP');
      INSERT INTO eventos
        (id, titulo, modalidade, inicio_em, fim_em, grupo_trabalho_id, organizador_membro_id, local_id)
      VALUES ('evento-gt', 'Reunião GT Secretaria', 'PRESENCIAL',
        '2026-10-21T10:00:00.000Z', '2026-10-21T12:00:00.000Z',
        'gt-secretaria', '${gestorId}', 'sede-gt');
      INSERT INTO portaria_fechamentos
        (id, evento_id, fechado_por_membro_id, fechado_em,
         total_convocados, total_convocados_presentes, total_convocados_ausentes,
         total_convidados_validados, total_convidados_pendentes, total_presentes)
      VALUES ('fech-gt', 'evento-gt', '${gestorId}', '2026-10-21T12:10:00.000Z',
        0, 0, 0, 0, 0, 0);
    `)
    const base = '/api/v1/relatorios/presencas/eventos/evento-gt'
    const contexto = await app.request(`${base}/contexto-pdf`, { headers: auth('token-gestor') })
    expect(contexto.status).toBe(200)
    const opcoes = (await contexto.json()) as any
    expect(opcoes.requerEscolha).toBe(true)
    expect(opcoes.setorFixoId).toBeNull()
    expect(opcoes.setores.map((x: any) => x.id)).toContain('setor-candidato')
    expect(opcoes.setores.map((x: any) => x.id)).not.toContain('setor-fora')
    const ausente = await app.request(`${base}/lista-presenca.pdf`, { headers: auth('token-gestor') })
    expect(ausente.status).toBe(409)
    expect(await ausente.json()).toMatchObject({ code: 'SETOR_RESPONSAVEL_AUSENTE' })
    const fora = await app.request(`${base}/lista-presenca.pdf?setorResponsavelId=setor-fora`, {
      headers: auth('token-gestor'),
    })
    expect(fora.status).toBe(403)
    const pdfResposta = await app.request(`${base}/lista-presenca.pdf?setorResponsavelId=setor-candidato`, {
      headers: auth('token-gestor'),
    })
    expect(pdfResposta.status).toBe(200)
    expect(await pdfResposta.text()).toContain('61.526.398/0004-31')
    expect(sqlite.prepare("SELECT setor_id, grupo_trabalho_id FROM eventos WHERE id = 'evento-gt'").get())
      .toMatchObject({ setor_id: null, grupo_trabalho_id: 'gt-secretaria' })
    const novoContexto = await app.request(`${base}/contexto-pdf`, { headers: auth('token-gestor') })
    expect(await novoContexto.json()).toMatchObject({ emitido: true, requerEscolha: false })
  })

  it('gera PDF apenas após fechamento, com CNPJ do Setor e endereço do local escolhido', async () => {
    await sessao(gestorId, 'token-gestor', 'conta-gestor')
    sqlite.exec(`
      UPDATE setores SET cnpj = '61526398000431' WHERE id = '${setorId}';
      INSERT INTO locais (id, nome, endereco, numero, cidade, uf)
        VALUES ('sede-ata', 'Bom Retiro', 'Rua Anhaia', '613', 'São Paulo', 'SP');
      UPDATE eventos SET local_id = 'sede-ata' WHERE id = 'evento-a';
    `)
    const res = await app.request('/api/v1/relatorios/presencas/eventos/evento-a/lista-presenca.pdf', {
      headers: auth('token-gestor'),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    const pdf = new TextDecoder().decode(await res.arrayBuffer())
    expect(pdf.startsWith('%PDF-1.4')).toBe(true)
    expect(pdf).toContain('61.526.398/0004-31')
    expect(pdf).toContain('RUA ANHAIA')
    expect(pdf).toContain('Membro Alvo')
    expect(pdf).toContain('Convidado A')
    expect(pdf).not.toContain('Outro Membro')
    expect(sqlite.prepare("SELECT COUNT(*) AS total FROM auditoria_logs WHERE acao = 'LISTA_PRESENCA_PDF_EMITIDA'").get()).toMatchObject({ total: 1 })
  })



  it('não atribui ao presente função de convocação cancelada', async () => {
    await sessao(gestorId, 'token-gestor', 'conta-gestor')
    sqlite.exec(`
      UPDATE setores SET cnpj = '61526398000431' WHERE id = '${setorId}';
      INSERT INTO locais (id, nome, endereco, numero, cidade, uf)
        VALUES ('sede-convocacao-cancelada', 'Bom Retiro', 'Rua Anhaia', '613', 'São Paulo', 'SP');
      UPDATE eventos SET local_id = 'sede-convocacao-cancelada' WHERE id = 'evento-a';
      INSERT INTO funcoes (id, nome, codigo, ativo) VALUES ('funcao-cancelada', 'Função Cancelada', 'CANCELADA', 1);
      INSERT INTO vinculos_funcionais (id, membro_id, funcao_id, setor_id, ativo)
        VALUES ('vinculo-cancelado', 'membro-alvo', 'funcao-cancelada', '${setorId}', 1);
      INSERT INTO convocacoes (id, evento_id, status, ativo)
        VALUES ('convocacao-cancelada', 'evento-a', 'CANCELADA', 0);
      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id)
        VALUES ('destino-cancelado', 'convocacao-cancelada', 'membro-alvo');
      INSERT INTO convocacao_destinatario_evidencias
        (id, convocacao_destinatario_id, funcao_id, vinculo_funcional_id, funcao_nome_snapshot)
        VALUES ('evidencia-cancelada', 'destino-cancelado', 'funcao-cancelada', 'vinculo-cancelado', 'Função Cancelada');
    `)
    const res = await app.request('/api/v1/relatorios/presencas/eventos/evento-a/lista-presenca.pdf', {
      headers: auth('token-gestor'),
    })
    expect(res.status).toBe(200)
    const pdf = await res.text()
    expect(pdf).toContain('Membro Alvo')
    expect(pdf).not.toContain('Cancelada')
  })

  it('congela PDF de ata mesmo após alteração posterior de endereço e CNPJ', async () => {
    await sessao(gestorId, 'token-gestor', 'conta-gestor')
    sqlite.exec(`
      UPDATE setores SET cnpj = '61526398000431' WHERE id = '${setorId}';
      INSERT INTO locais (id, nome, endereco, numero, cidade, uf)
        VALUES ('sede-imutavel', 'Bom Retiro', 'Rua Anhaia', '613', 'São Paulo', 'SP');
      UPDATE eventos SET local_id = 'sede-imutavel' WHERE id = 'evento-a';
    `)
    const path = '/api/v1/relatorios/presencas/eventos/evento-a/lista-presenca.pdf'
    const primeiro = await app.request(path, { headers: auth('token-gestor') })
    expect(primeiro.status).toBe(200)
    const primeiroPdf = await primeiro.text()
    sqlite.exec(`
      UPDATE locais SET endereco = 'Rua Alterada' WHERE id = 'sede-imutavel';
      UPDATE setores SET cnpj = '00000000000000' WHERE id = '${setorId}';
    `)
    const segundo = await app.request(path, { headers: auth('token-gestor') })
    expect(segundo.status).toBe(200)
    expect(await segundo.text()).toBe(primeiroPdf)
    expect(primeiroPdf).not.toContain('Rua Alterada')
    expect(primeiroPdf).toContain('RUA ANHAIA')
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM lista_presenca_pdf_atas').get()).toMatchObject({ total: 1 })
  })

  it('bloqueia PDF de Portaria não fechada e de usuário sem permissão', async () => {
    await sessao(gestorId, 'token-gestor', 'conta-gestor')
    await sessao(semAcessoId, 'token-sem-acesso')
    const aberto = await app.request('/api/v1/relatorios/presencas/eventos/evento-inexistente/lista-presenca.pdf', {
      headers: auth('token-gestor'),
    })
    expect(aberto.status).toBe(404)
    const proibido = await app.request('/api/v1/relatorios/presencas/eventos/evento-a/lista-presenca.pdf', {
      headers: auth('token-sem-acesso'),
    })
    expect(proibido.status).toBe(403)
  })

  it('não emite PDF definitivo quando faltam CNPJ ou sede', async () => {
    await sessao(gestorId, 'token-gestor', 'conta-gestor')
    const semCnpj = await app.request('/api/v1/relatorios/presencas/eventos/evento-a/lista-presenca.pdf', {
      headers: auth('token-gestor'),
    })
    expect(semCnpj.status).toBe(409)
    expect((await semCnpj.json()) as any).toMatchObject({ code: 'CNPJ_SETOR_AUSENTE' })
    sqlite.exec(`UPDATE setores SET cnpj = '61526398000431' WHERE id = '${setorId}';`)
    const semSede = await app.request('/api/v1/relatorios/presencas/eventos/evento-a/lista-presenca.pdf', {
      headers: auth('token-gestor'),
    })
    expect(semSede.status).toBe(409)
    expect((await semSede.json()) as any).toMatchObject({ code: 'ENDERECO_SEDE_AUSENTE' })
  })

  it('lista somente reuniões com Portaria fechada e acesso de gestor', async () => {
    await sessao(gestorId, 'token-gestor', 'conta-gestor')
    await sessao(semAcessoId, 'token-sem-acesso')
    const url = '/api/v1/relatorios/presencas/eventos/fechados'
    const gestor = await app.request(url, { headers: auth('token-gestor') })
    expect(gestor.status).toBe(200)
    expect(await gestor.json()).toEqual(expect.arrayContaining([
      { eventoId: 'evento-a', fechadoEm: '2026-08-01T12:10:00.000Z' },
      { eventoId: 'evento-b', fechadoEm: '2026-09-01T12:10:00.000Z' },
    ]))
    const usuario = await app.request(url, { headers: auth('token-sem-acesso') })
    expect(usuario.status).toBe(403)
  })
  it('relatório final de reunião usa snapshot materializado', async () => {
    await sessao(gestorId, 'token-gestor', 'conta-gestor')

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
    await sessao(gestorId, 'token-gestor', 'conta-gestor')

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

  it('nega histórico de membro quando nenhum evento do histórico é autorizado', async () => {
    await sessao(semAcessoId, 'token-sem-acesso')

    const res = await app.request('/api/v1/relatorios/presencas/membros/membro-alvo', {
      headers: auth('token-sem-acesso'),
    })

    expect(res.status).toBe(403)
  })

  it('não revela existência de membro sem histórico materializado', async () => {
    await sessao(gestorId, 'token-gestor', 'conta-gestor')

    const existenteSemHistorico = await app.request(
      '/api/v1/relatorios/presencas/membros/gestor-tecnico',
      { headers: auth('token-gestor') }
    )
    const inexistente = await app.request(
      '/api/v1/relatorios/presencas/membros/membro-inexistente',
      { headers: auth('token-gestor') }
    )

    expect(existenteSemHistorico.status).toBe(404)
    expect(inexistente.status).toBe(404)
    expect(await existenteSemHistorico.json()).toEqual({
      error: 'Histórico não encontrado',
      code: 'NOT_FOUND',
    })
    expect(await inexistente.json()).toEqual({
      error: 'Histórico não encontrado',
      code: 'NOT_FOUND',
    })
  })

  it('histórico de membro respeita filtro de período', async () => {
    await sessao(gestorId, 'token-gestor', 'conta-gestor')

    const res = await app.request(
      '/api/v1/relatorios/presencas/membros/membro-alvo?dataInicio=2026-09-01T00:00:00.000Z',
      { headers: auth('token-gestor') }
    )

    const body = (await res.json()) as any
    expect(body.resumo.totalReunioes).toBe(1)
    expect(body.reunioes[0].eventoId).toBe('evento-b')
  })

  it('consolidado por período totaliza snapshots do escopo', async () => {
    await sessao(gestorId, 'token-gestor', 'conta-gestor')

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
