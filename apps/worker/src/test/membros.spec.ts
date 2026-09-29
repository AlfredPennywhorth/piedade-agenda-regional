import { describe, it, expect, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { createApp } from '../index'
import * as schema from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { setupDb } from './setup'
import { criarSessaoAutenticadaTeste, mesclarAutorizacao } from './auth-test-helper'

type MembroResponse = {
  id: string
  nome?: string
  casaId?: string
  ativo?: boolean
}

type ErroResponse = {
  error: string
}

describe('Membros (S01) - Testes de Integração Drizzle/SQLite', () => {
  let sqlite: any
  let db: ReturnType<typeof drizzle>
  let app: any
  let authToken = ''

  const req = async (path: string, options?: RequestInit) => {
    const request = new Request(`http://localhost${path}`, mesclarAutorizacao(authToken, options))
    return app.request(request)
  }

  const regionalId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const administracaoId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const setorId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const casaId = '11111111-1111-4111-8111-111111111111'
  const casaId2 = '22222222-2222-4222-8222-222222222222'
  const casaInexistenteId = '99999999-9999-4999-8999-999999999999'
  const membroId = '33333333-3333-4333-8333-333333333333'

  beforeEach(async () => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema })
    setupDb(sqlite)
    app = createApp(db)

    sqlite.exec(`
      INSERT INTO regionais (id, nome)
      VALUES ('${regionalId}', 'Regional 1');

      INSERT INTO administracoes (id, regional_id, nome)
      VALUES ('${administracaoId}', '${regionalId}', 'Adm 1');

      INSERT INTO setores (id, administracao_id, nome)
      VALUES ('${setorId}', '${administracaoId}', 'Setor 1');

      INSERT INTO casas (id, setor_id, nome)
      VALUES ('${casaId}', '${setorId}', 'Casa 1');

      INSERT INTO casas (id, setor_id, nome)
      VALUES ('${casaId2}', '${setorId}', 'Casa 2');

      INSERT INTO membros (id, nome, celular, data_ordenacao, codigo_carteirinha, casa_id, ativo)
      VALUES ('${membroId}', 'Pessoa Teste Base', '11999999999', '1990-01-01', 'BASE-001', '${casaId}', 1);
    `)
    authToken = (await criarSessaoAutenticadaTeste(sqlite, 'membros-auth')).token
  })

  it('1. Deve criar membro válido', async () => {
    const res = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Pessoa Teste A',
        dataOrdenacao: '2000-01-01',
        codigoCarteirinha: 'TESTE-A',
        casaId,
      }),
    })

    const json = (await res.json()) as MembroResponse

    expect(res.status).toBe(201)
    expect(json.nome).toBe('Pessoa Teste A')
    expect(json.id).toBeDefined()
  })

  it('1b. Não deve sincronizar membro inativo em convocações DCO futuras', async () => {
    const funcaoDco = sqlite.prepare(
      "SELECT id FROM funcoes WHERE codigo = 'DCO' AND ativo = 1"
    ).get() as { id: string }

    sqlite.exec(`
      INSERT INTO eventos
        (id, titulo, modalidade, inicio_em, fim_em, casa_id, ativo)
      VALUES
        ('evento-dco-inativo', 'Evento DCO Futuro', 'ONLINE',
         '2030-01-01T12:00:00.000Z', '2030-01-01T13:00:00.000Z', '${casaId}', 1);

      INSERT INTO convocacoes
        (id, evento_id, status, publicada_em, ativo)
      VALUES
        ('conv-dco-inativo', 'evento-dco-inativo', 'PUBLICADA', CURRENT_TIMESTAMP, 1);

      INSERT INTO convocacao_funcoes
        (id, convocacao_id, funcao_id)
      VALUES
        ('cf-dco-inativo', 'conv-dco-inativo', '${funcaoDco.id}');
    `)

    const res = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Pessoa Inativa',
        dataOrdenacao: '2000-01-01',
        codigoCarteirinha: 'TESTE-INATIVO',
        casaId,
        ativo: false,
      }),
    })

    const json = (await res.json()) as MembroResponse

    expect(res.status).toBe(201)
    expect(json.ativo).toBe(false)

    const vinculoDco = sqlite.prepare(
      'SELECT ativo FROM vinculos_funcionais WHERE membro_id = ? AND funcao_id = ?'
    ).get(json.id, funcaoDco.id) as { ativo: number }

    // O vínculo automático permanece ativo para que uma futura reativação do
    // membro volte a torná-lo elegível sem exigir reparo administrativo.
    expect(vinculoDco.ativo).toBe(1)

    const destinatarios = sqlite.prepare(
      'SELECT COUNT(*) AS total FROM convocacao_destinatarios WHERE convocacao_id = ? AND membro_id = ?'
    ).get('conv-dco-inativo', json.id) as { total: number }

    // Apesar do vínculo ativo, membro inativo não pode ser sincronizado
    // retroativamente para convocações já publicadas.
    expect(destinatarios.total).toBe(0)

    const resReativar = await req(`/api/v1/membros/${json.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ativo: true }),
    })

    expect(resReativar.status).toBe(200)

    const vinculoAposReativacao = sqlite.prepare(
      'SELECT ativo FROM vinculos_funcionais WHERE membro_id = ? AND funcao_id = ?'
    ).get(json.id, funcaoDco.id) as { ativo: number }

    expect(vinculoAposReativacao.ativo).toBe(1)

    sqlite.exec(`
      INSERT INTO eventos
        (id, titulo, modalidade, inicio_em, fim_em, casa_id, ativo)
      VALUES
        ('evento-dco-reativado', 'Evento DCO Após Reativação', 'ONLINE',
         '2030-02-01T12:00:00.000Z', '2030-02-01T13:00:00.000Z', '${casaId}', 1);

      INSERT INTO convocacoes
        (id, evento_id, status, ativo)
      VALUES
        ('conv-dco-reativado', 'evento-dco-reativado', 'RASCUNHO', 1);

      INSERT INTO convocacao_funcoes
        (id, convocacao_id, funcao_id)
      VALUES
        ('cf-dco-reativado', 'conv-dco-reativado', '${funcaoDco.id}');
    `)

    const resPublicar = await req('/api/v1/convocacoes/conv-dco-reativado/publicar', {
      method: 'POST',
    })

    expect(resPublicar.status).toBe(200)

    const destinatarioAposReativacao = sqlite.prepare(
      'SELECT id FROM convocacao_destinatarios WHERE convocacao_id = ? AND membro_id = ?'
    ).get('conv-dco-reativado', json.id)

    expect(destinatarioAposReativacao).toBeDefined()
  })

  it('2. Deve rejeitar membro com Casa inexistente', async () => {
    const res = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Pessoa Teste B',
        dataOrdenacao: '2000-01-01',
        codigoCarteirinha: 'TESTE-B',
        casaId: casaInexistenteId,
      }),
    })

    const json = (await res.json()) as ErroResponse

    expect(res.status).toBe(400)
    expect(json.error).toContain('Casa vinculada não existe')
  })

  it('3. Deve alterar Casa principal preservando ID e sincronizar Usuário Comum', async () => {
    sqlite.exec(`
      INSERT INTO contas_acesso (id, membro_id, status)
      VALUES ('conta-membro-base', '${membroId}', 'ATIVA');

      INSERT INTO acessos_conta
        (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id, ativo)
      VALUES
        ('acesso-comum-antigo', 'conta-membro-base', 'USUARIO_COMUM', 'CASA', '${casaId}', 1);
    `)

    const resPatch = await req(`/api/v1/membros/${membroId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        casaId: casaId2,
      }),
    })

    const json = (await resPatch.json()) as MembroResponse

    expect(resPatch.status).toBe(200)
    expect(json.id).toBe(membroId)
    expect(json.casaId).toBe(casaId2)

    const acessos = sqlite.prepare(
      `SELECT escopo_tipo, escopo_id, ativo
       FROM acessos_conta
       WHERE conta_acesso_id = 'conta-membro-base'
         AND perfil_codigo = 'USUARIO_COMUM'
       ORDER BY created_at`
    ).all() as Array<{ escopo_tipo: string; escopo_id: string; ativo: number }>

    expect(acessos.some(acesso => acesso.escopo_id === casaId && acesso.ativo === 0)).toBe(true)
    expect(acessos.some(acesso =>
      acesso.escopo_tipo === 'CASA' &&
      acesso.escopo_id === casaId2 &&
      acesso.ativo === 1
    )).toBe(true)
  })

  it('4. Deve inativar membro (ativo = false)', async () => {
    const resPatch = await req(`/api/v1/membros/${membroId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ativo: false,
      }),
    })

    const json = (await resPatch.json()) as MembroResponse

    expect(resPatch.status).toBe(200)
    expect(json.ativo).toBe(false)
  })

  it('18. Rejeitar membro inexistente no GET e PATCH', async () => {
    const membroInexistenteId = '88888888-8888-4888-8888-888888888888'

    const resGet = await req(`/api/v1/membros/${membroInexistenteId}`)

    expect(resGet.status).toBe(404)

    const resPatch = await req(`/api/v1/membros/${membroInexistenteId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ativo: false,
      }),
    })

    expect(resPatch.status).toBe(404)
  })

  it('19. Deve rejeitar celular com formato inválido no POST', async () => {
    const res = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Membro Teste', dataOrdenacao: '2000-01-01', codigoCarteirinha: 'TESTE-19', casaId, celular: '123' }), // Inválido
    })
    const json = await res.json() as any
    expect(res.status).toBe(400)
    expect(JSON.stringify(json.error)).toContain('Formato de celular inválido')
  })

  it('20. Deve normalizar celular corretamente no POST', async () => {
    const res = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Membro Normalizado', dataOrdenacao: '2000-01-01', codigoCarteirinha: 'TESTE-20', casaId, celular: '+55 (11) 98888-7777' }),
    })
    const json = await res.json() as any
    expect(res.status).toBe(201)
    
    // Verifica no banco se foi salvo normalizado
    const salvo = await db.select().from(schema.membros).where(eq(schema.membros.id, json.id)).get()
    expect(salvo?.celular).toBe('11988887777')
  })

  it('21. Deve bloquear celular duplicado no POST e registrar tentativa', async () => {
    const res = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Duplicado', dataOrdenacao: '2000-01-01', codigoCarteirinha: 'TESTE-21', casaId, celular: '+55 11 99999-9999' }), // celular do membroId base ('11999999999')
    })
    const json = await res.json() as any
    expect(res.status).toBe(409)
    expect(json.code).toBe('CELULAR_JA_VINCULADO')

    const tentativa = await db.select().from(schema.tentativasAcesso).where(eq(schema.tentativasAcesso.tipo, 'CONFLITO_CELULAR')).get()
    expect(tentativa).toBeDefined()
    expect(tentativa?.sucesso).toBe(false)
    expect(tentativa?.motivo).toBe('Celular já vinculado a outro membro')
  })

  it('22. Deve bloquear celular duplicado no PATCH e registrar tentativa', async () => {
    // Cria um segundo membro com celular diferente
    const resCreate = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Segundo Membro', dataOrdenacao: '2000-01-01', codigoCarteirinha: 'TESTE-22', casaId, celular: '11977777777' }),
    })
    const jsonCreate = await resCreate.json() as any
    const segundoMembroId = jsonCreate.id

    // Tenta atualizar para o celular do membro base
    const resPatch = await req(`/api/v1/membros/${segundoMembroId}`, {
      method: 'PATCH',
      body: JSON.stringify({ celular: '11999999999' }),
    })
    const jsonPatch = await resPatch.json() as any
    expect(resPatch.status).toBe(409)
    expect(jsonPatch.code).toBe('CELULAR_JA_VINCULADO')

    // Deve ter registrado tentativa ligada ao ID do membro que tentou
    const tentativa = await db.select().from(schema.tentativasAcesso)
      .where(and(
        eq(schema.tentativasAcesso.tipo, 'CONFLITO_CELULAR'),
        eq(schema.tentativasAcesso.membroId, segundoMembroId)
      ))
      .get()
    expect(tentativa).toBeDefined()
  })

  it('23. Deve bloquear mesmo nome na mesma Casa de Oração', async () => {
    const res = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({
        nome: '  Pessoa   Teste Base ',
        dataOrdenacao: '2001-01-01',
        codigoCarteirinha: 'TESTE-23',
        casaId,
        celular: '11966666666',
      }),
    })

    const json = await res.json() as any
    expect(res.status).toBe(409)
    expect(json.code).toBe('NOME_JA_VINCULADO_NA_CASA')
  })

  it('24. Deve permitir mesmo nome em Casa diferente', async () => {
    const res = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Pessoa Teste Base',
        dataOrdenacao: '2001-01-01',
        codigoCarteirinha: 'TESTE-24',
        casaId: casaId2,
        celular: '11965555555',
      }),
    })

    expect(res.status).toBe(201)
  })

  it('25. Deve excluir cadastro indevido sem dependências', async () => {
    const resCreate = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Cadastro Duplicado Indevido',
        dataOrdenacao: '2002-01-01',
        codigoCarteirinha: 'TESTE-25',
        casaId,
        celular: '11964444444',
      }),
    })
    expect(resCreate.status).toBe(201)
    const criado = await resCreate.json() as any

    const resDelete = await req(`/api/v1/membros/${criado.id}`, {
      method: 'DELETE',
    })

    expect(resDelete.status).toBe(200)
    const restante = await db.select().from(schema.membros).where(eq(schema.membros.id, criado.id)).get()
    expect(restante).toBeUndefined()
  })

  it('26. Deve bloquear exclusão quando o membro possui dependências', async () => {
    sqlite.exec(`
      INSERT INTO contas_acesso (id, membro_id, status)
      VALUES ('conta-dependente-exclusao', '${membroId}', 'PENDENTE_ATIVACAO');
    `)

    const resDelete = await req(`/api/v1/membros/${membroId}`, {
      method: 'DELETE',
    })

    const json = await resDelete.json() as any
    expect(resDelete.status).toBe(409)
    expect(json.code).toBe('MEMBRO_POSSUI_DEPENDENCIAS')
  })

  it('27. Deve sincronizar DCO ao mover e reativar membro no mesmo PATCH', async () => {
    const funcaoDco = sqlite.prepare(
      "SELECT id FROM funcoes WHERE codigo = 'DCO' AND ativo = 1"
    ).get() as { id: string }

    sqlite.exec(`
      UPDATE membros SET ativo = 0 WHERE id = '${membroId}';

      INSERT INTO eventos
        (id, titulo, modalidade, inicio_em, fim_em, casa_id, ativo)
      VALUES
        ('evento-move-reativa', 'Evento destino reativação', 'ONLINE',
         '2030-03-01T12:00:00.000Z', '2030-03-01T13:00:00.000Z', '${casaId2}', 1);

      INSERT INTO convocacoes
        (id, evento_id, status, publicada_em, ativo)
      VALUES
        ('conv-move-reativa', 'evento-move-reativa', 'PUBLICADA', CURRENT_TIMESTAMP, 1);

      INSERT INTO convocacao_funcoes
        (id, convocacao_id, funcao_id)
      VALUES
        ('cf-move-reativa', 'conv-move-reativa', '${funcaoDco.id}');
    `)

    const resPatch = await req(`/api/v1/membros/${membroId}`, {
      method: 'PATCH',
      body: JSON.stringify({ casaId: casaId2, ativo: true }),
    })

    expect(resPatch.status).toBe(200)

    const destinatario = sqlite.prepare(
      'SELECT id FROM convocacao_destinatarios WHERE convocacao_id = ? AND membro_id = ?'
    ).get('conv-move-reativa', membroId)

    expect(destinatario).toBeDefined()
  })

  it('28. Não deve sincronizar DCO ao mover e inativar membro no mesmo PATCH', async () => {
    const funcaoDco = sqlite.prepare(
      "SELECT id FROM funcoes WHERE codigo = 'DCO' AND ativo = 1"
    ).get() as { id: string }

    sqlite.exec(`
      INSERT INTO eventos
        (id, titulo, modalidade, inicio_em, fim_em, casa_id, ativo)
      VALUES
        ('evento-move-inativa', 'Evento destino inativação', 'ONLINE',
         '2030-04-01T12:00:00.000Z', '2030-04-01T13:00:00.000Z', '${casaId2}', 1);

      INSERT INTO convocacoes
        (id, evento_id, status, publicada_em, ativo)
      VALUES
        ('conv-move-inativa', 'evento-move-inativa', 'PUBLICADA', CURRENT_TIMESTAMP, 1);

      INSERT INTO convocacao_funcoes
        (id, convocacao_id, funcao_id)
      VALUES
        ('cf-move-inativa', 'conv-move-inativa', '${funcaoDco.id}');
    `)

    const resPatch = await req(`/api/v1/membros/${membroId}`, {
      method: 'PATCH',
      body: JSON.stringify({ casaId: casaId2, ativo: false }),
    })

    expect(resPatch.status).toBe(200)

    const destinatario = sqlite.prepare(
      'SELECT id FROM convocacao_destinatarios WHERE convocacao_id = ? AND membro_id = ?'
    ).get('conv-move-inativa', membroId)

    expect(destinatario).toBeUndefined()
  })

  it('29. Deve preservar vínculo DCO manual e bloquear exclusão', async () => {
    const resCreate = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Cadastro com DCO Manual',
        dataOrdenacao: '2003-01-01',
        codigoCarteirinha: 'TESTE-29',
        casaId,
        celular: '11963222222',
      }),
    })
    expect(resCreate.status).toBe(201)
    const criado = await resCreate.json() as any

    const funcaoDco = sqlite.prepare(
      "SELECT id FROM funcoes WHERE codigo = 'DCO' AND ativo = 1"
    ).get() as { id: string }

    const resVinculoManual = await req('/api/v1/vinculos-funcionais', {
      method: 'POST',
      body: JSON.stringify({
        membroId: criado.id,
        funcaoId: funcaoDco.id,
        casaId,
        ativo: false,
      }),
    })
    expect(resVinculoManual.status).toBe(201)
    const vinculoManual = await resVinculoManual.json() as any

    const resDelete = await req(`/api/v1/membros/${criado.id}`, {
      method: 'DELETE',
    })

    const jsonDelete = await resDelete.json() as any
    expect(resDelete.status).toBe(409)
    expect(jsonDelete.code).toBe('MEMBRO_POSSUI_DEPENDENCIAS')

    const manualPreservado = sqlite.prepare(
      'SELECT id FROM vinculos_funcionais WHERE id = ?'
    ).get(vinculoManual.id)
    expect(manualPreservado).toBeDefined()
  })

  it('30. Deve excluir todos os vínculos DCO automáticos após mudança de Casa', async () => {
    const resCreate = await req('/api/v1/membros', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Cadastro Movido Indevido',
        dataOrdenacao: '2003-01-01',
        codigoCarteirinha: 'TESTE-29',
        casaId,
        celular: '11963333333',
      }),
    })
    expect(resCreate.status).toBe(201)
    const criado = await resCreate.json() as any

    const resMover = await req(`/api/v1/membros/${criado.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ casaId: casaId2 }),
    })
    expect(resMover.status).toBe(200)

    const vinculosAntes = sqlite.prepare(
      `SELECT origem
       FROM vinculos_funcionais vf
       INNER JOIN funcoes f ON f.id = vf.funcao_id
       WHERE vf.membro_id = ? AND f.codigo = 'DCO'`
    ).all(criado.id) as Array<{ origem: string | null }>
    expect(vinculosAntes.length).toBeGreaterThanOrEqual(2)
    expect(vinculosAntes.every(vinculo => vinculo.origem === 'MEMBRO_AUTOMATICO')).toBe(true)

    const resDelete = await req(`/api/v1/membros/${criado.id}`, {
      method: 'DELETE',
    })

    expect(resDelete.status).toBe(200)

    const vinculosDepois = sqlite.prepare(
      'SELECT COUNT(*) AS total FROM vinculos_funcionais WHERE membro_id = ?'
    ).get(criado.id) as { total: number }
    expect(vinculosDepois.total).toBe(0)
  })


  it('31. Deve preservar DCO legado sem origem e bloquear exclusão', async () => {
    const membroLegadoId = '44444444-4444-4444-8444-444444444444'
    const funcaoDco = sqlite.prepare(
      "SELECT id FROM funcoes WHERE codigo = 'DCO' AND ativo = 1"
    ).get() as { id: string }

    sqlite.exec(`
      INSERT INTO membros
        (id, nome, celular, data_ordenacao, codigo_carteirinha, casa_id, ativo)
      VALUES
        ('${membroLegadoId}', 'Membro Legado DCO', '11961111111',
         '2004-01-01', 'TESTE-31', '${casaId}', 1);

      INSERT INTO vinculos_funcionais
        (id, membro_id, funcao_id, casa_id, origem, ativo)
      VALUES
        ('vinculo-dco-legado', '${membroLegadoId}', '${funcaoDco.id}',
         '${casaId}', NULL, 1);
    `)

    const resDelete = await req(`/api/v1/membros/${membroLegadoId}`, {
      method: 'DELETE',
    })

    const jsonDelete = await resDelete.json() as any
    expect(resDelete.status).toBe(409)
    expect(jsonDelete.code).toBe('MEMBRO_POSSUI_DEPENDENCIAS')

    const legadoPreservado = sqlite.prepare(
      'SELECT origem FROM vinculos_funcionais WHERE id = ?'
    ).get('vinculo-dco-legado') as { origem: string | null } | undefined

    expect(legadoPreservado).toBeDefined()
    expect(legadoPreservado?.origem).toBeNull()
  })

})
