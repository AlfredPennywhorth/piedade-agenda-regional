import {
  sqliteTable,
  text,
  integer,
  check,
  uniqueIndex,
  real,
  index,
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ============================================================
// Funções auxiliares (Defaults)
// ============================================================
// Drizzle suporta UUID nativo, mas para SQLite D1 usamos randomUUID() gerado na aplicação
// ou sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`
// Usar UUID no cliente (Zod/crypto.randomUUID) é melhor no Cloudflare, então não vamos colocar 'default' gerado no banco para IDs por enquanto. Mas no schema vamos marcar.

const timestamps = {
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
}

const ativoDefault = integer('ativo', { mode: 'boolean' }).notNull().default(true)

// ============================================================
// Estrutura Institucional
// ============================================================

export const regionais = sqliteTable('regionais', {
  id: text('id').primaryKey(), // UUID
  nome: text('nome').notNull(),
  codigo: text('codigo'),
  ativo: ativoDefault,
  ...timestamps,
})

export const administracoes = sqliteTable('administracoes', {
  id: text('id').primaryKey(),
  regionalId: text('regional_id')
    .notNull()
    .references(() => regionais.id),
  nome: text('nome').notNull(),
  codigo: text('codigo'),
  ativo: ativoDefault,
  ...timestamps,
})

export const setores = sqliteTable('setores', {
  id: text('id').primaryKey(),
  administracaoId: text('administracao_id')
    .notNull()
    .references(() => administracoes.id),
  nome: text('nome').notNull(),
  codigo: text('codigo'),
  ativo: ativoDefault,
  ...timestamps,
})

export const casas = sqliteTable('casas', {
  id: text('id').primaryKey(),
  setorId: text('setor_id')
    .notNull()
    .references(() => setores.id), // Permite atualização (Update)
  nome: text('nome').notNull(),
  codigo: text('codigo'), // código institucional
  ativo: ativoDefault,
  ...timestamps,
})

// ============================================================
// Grupos de Trabalho
// ============================================================
// Escopo flexível: Regional, Administração ou Setor.
// Exatamente um deve ser não nulo.
export const gruposTrabalho = sqliteTable(
  'grupos_trabalho',
  {
    id: text('id').primaryKey(),
    nome: text('nome').notNull(),
    ativo: ativoDefault,

    // FKs nullables
    regionalId: text('regional_id').references(() => regionais.id),
    administracaoId: text('administracao_id').references(() => administracoes.id),
    setorId: text('setor_id').references(() => setores.id),

    ...timestamps,
  },
  table => ({
    checkEscopo: check(
      'check_escopo_unico',
      sql`
      (CASE WHEN ${table.regionalId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${table.administracaoId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${table.setorId} IS NOT NULL THEN 1 ELSE 0 END) = 1
    `
    ),
  })
)

// ============================================================
// Membros, Funções e Vínculos Funcionais (S02)
// ============================================================

const timestampsS02 = {
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
}

export const membros = sqliteTable('membros', {
  id: text('id').primaryKey(), // UUID
  nome: text('nome').notNull(),
  // Legado: será removido após a regularização dos dados institucionais.
  dataNascimento: text('data_nascimento'),
  dataOrdenacao: text('data_ordenacao'),
  codigoCarteirinha: text('codigo_carteirinha').unique(),
  celular: text('celular').unique(),
  casaId: text('casa_id')
    .notNull()
    .references(() => casas.id),
  ativo: ativoDefault,
  autenticacaoAtiva: integer('autenticacao_ativa', { mode: 'boolean' }).notNull().default(false),
  pinHash: text('pin_hash'),
  pinSalt: text('pin_salt'),
  bloqueadoAte: text('bloqueado_ate'),
  tentativasPin: integer('tentativas_pin').notNull().default(0),
  ativadoEm: text('ativado_em'),
  ...timestampsS02,
})

export const funcoes = sqliteTable('funcoes', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  codigo: text('codigo'),
  descricao: text('descricao'),
  ativo: ativoDefault,
  ...timestampsS02,
})

export const vinculosFuncionais = sqliteTable(
  'vinculos_funcionais',
  {
    id: text('id').primaryKey(),
    membroId: text('membro_id')
      .notNull()
      .references(() => membros.id),
    funcaoId: text('funcao_id')
      .notNull()
      .references(() => funcoes.id),

    regionalId: text('regional_id').references(() => regionais.id),
    administracaoId: text('administracao_id').references(() => administracoes.id),
    setorId: text('setor_id').references(() => setores.id),
    casaId: text('casa_id').references(() => casas.id),
    grupoTrabalhoId: text('grupo_trabalho_id').references(() => gruposTrabalho.id),

    ativo: ativoDefault,
    ...timestampsS02,
  },
  table => ({
    checkEscopo: check(
      'check_vinculo_escopo_unico',
      sql`
      (CASE WHEN ${table.regionalId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${table.administracaoId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${table.setorId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${table.casaId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${table.grupoTrabalhoId} IS NOT NULL THEN 1 ELSE 0 END) = 1
    `
    ),
    uniqueRegional: uniqueIndex('idx_vinculo_unico_regional')
      .on(table.membroId, table.funcaoId, table.regionalId)
      .where(sql`${table.regionalId} IS NOT NULL AND ${table.ativo} = 1`),
    uniqueAdministracao: uniqueIndex('idx_vinculo_unico_administracao')
      .on(table.membroId, table.funcaoId, table.administracaoId)
      .where(sql`${table.administracaoId} IS NOT NULL AND ${table.ativo} = 1`),
    uniqueSetor: uniqueIndex('idx_vinculo_unico_setor')
      .on(table.membroId, table.funcaoId, table.setorId)
      .where(sql`${table.setorId} IS NOT NULL AND ${table.ativo} = 1`),
    uniqueCasa: uniqueIndex('idx_vinculo_unico_casa')
      .on(table.membroId, table.funcaoId, table.casaId)
      .where(sql`${table.casaId} IS NOT NULL AND ${table.ativo} = 1`),
    uniqueGT: uniqueIndex('idx_vinculo_unico_gt')
      .on(table.membroId, table.funcaoId, table.grupoTrabalhoId)
      .where(sql`${table.grupoTrabalhoId} IS NOT NULL AND ${table.ativo} = 1`),
  })
)

// ============================================================
// Contas de Acesso (PR-ACC-01)
// ============================================================

export const contasAcesso = sqliteTable(
  'contas_acesso',
  {
    id: text('id').primaryKey(),
    membroId: text('membro_id')
      .notNull()
      .unique()
      .references(() => membros.id),
    status: text('status').notNull().default('PENDENTE_ATIVACAO'),
    pinHash: text('pin_hash'),
    pinSalt: text('pin_salt'),
    bloqueadoAte: text('bloqueado_ate'),
    tentativasPin: integer('tentativas_pin').notNull().default(0),
    ativadoEm: text('ativado_em'),
    ...timestampsS02,
  },
  table => ({
    checkStatus: check(
      'check_conta_acesso_status',
      sql`${table.status} IN ('PENDENTE_ATIVACAO','ATIVA','BLOQUEADA','DESATIVADA')`
    ),
    idxStatus: index('idx_contas_acesso_status').on(table.status),
  })
)

// ============================================================
// Perfis técnicos, escopos e governança de acesso (PR-ACC-03)
// ============================================================

export const perfisAcesso = sqliteTable(
  'perfis_acesso',
  {
    codigo: text('codigo').primaryKey(),
    nome: text('nome').notNull(),
    descricao: text('descricao').notNull(),
    ativo: ativoDefault,
    ...timestampsS02,
  },
  table => ({
    checkAtivo: check('check_perfil_acesso_ativo', sql`${table.ativo} IN (0, 1)`),
  })
)

export const acessosConta = sqliteTable(
  'acessos_conta',
  {
    id: text('id').primaryKey(),
    contaAcessoId: text('conta_acesso_id')
      .notNull()
      .references(() => contasAcesso.id),
    perfilCodigo: text('perfil_codigo')
      .notNull()
      .references(() => perfisAcesso.codigo),
    escopoTipo: text('escopo_tipo').notNull(),
    escopoId: text('escopo_id'),
    concedidoPorContaId: text('concedido_por_conta_id').references(() => contasAcesso.id),
    revogadoPorContaId: text('revogado_por_conta_id').references(() => contasAcesso.id),
    revogadoEm: text('revogado_em'),
    ativo: ativoDefault,
    ...timestampsS02,
  },
  table => ({
    checkEscopo: check(
      'check_acesso_conta_escopo',
      sql`(${table.escopoTipo} = 'GLOBAL' AND ${table.escopoId} IS NULL)
        OR (${table.escopoTipo} IN ('REGIONAL','ADMINISTRACAO','SETOR','CASA','GRUPO_TRABALHO')
          AND ${table.escopoId} IS NOT NULL)`
    ),
    checkMasterGlobal: check(
      'check_master_somente_global',
      sql`(${table.perfilCodigo} = 'MASTER_SISTEMA'
          AND ${table.escopoTipo} = 'GLOBAL' AND ${table.escopoId} IS NULL)
        OR (${table.perfilCodigo} <> 'MASTER_SISTEMA' AND ${table.escopoTipo} <> 'GLOBAL')`
    ),
    checkAdminRegional: check(
      'check_admin_somente_regional',
      sql`${table.perfilCodigo} <> 'ADMINISTRADOR_SISTEMA'
        OR ${table.escopoTipo} = 'REGIONAL'`
    ),
    checkAuditorEscopo: check(
      'check_auditor_escopo',
      sql`${table.perfilCodigo} <> 'AUDITOR'
        OR ${table.escopoTipo} IN ('REGIONAL','ADMINISTRACAO')`
    ),
    idxConta: index('idx_acessos_conta_conta').on(table.contaAcessoId, table.ativo),
    idxEscopo: index('idx_acessos_conta_escopo').on(
      table.escopoTipo,
      table.escopoId,
      table.ativo
    ),
  })
)

export const cienciasResponsabilidade = sqliteTable(
  'ciencias_responsabilidade',
  {
    id: text('id').primaryKey(),
    contaAcessoId: text('conta_acesso_id')
      .notNull()
      .references(() => contasAcesso.id),
    acessoContaId: text('acesso_conta_id')
      .notNull()
      .references(() => acessosConta.id),
    tipo: text('tipo').notNull(),
    versaoTexto: text('versao_texto').notNull(),
    textoHash: text('texto_hash').notNull(),
    cienteEm: text('ciente_em')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  table => ({
    checkTipo: check(
      'check_ciencia_tipo',
      sql`${table.tipo} IN ('RESPONSAVEL_REGIONAL_PMO','AVISO_PRIVACIDADE')`
    ),
    uniqueCiencia: uniqueIndex('idx_ciencia_responsabilidade_unica').on(
      table.contaAcessoId,
      table.acessoContaId,
      table.tipo,
      table.versaoTexto
    ),
  })
)

export const bootstrapMaster = sqliteTable(
  'bootstrap_master',
  {
    id: text('id').primaryKey(),
    contaAcessoId: text('conta_acesso_id')
      .notNull()
      .references(() => contasAcesso.id),
    concluidoEm: text('concluido_em')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  table => ({
    checkId: check('check_bootstrap_master_unico', sql`${table.id} = 'PRIMEIRO_MASTER'`),
  })
)

// ============================================================
// Autenticação e Permissões (S03)
// ============================================================

export const linksAtivacao = sqliteTable('links_ativacao', {
  id: text('id').primaryKey(), // UUID
  contaAcessoId: text('conta_acesso_id').references(() => contasAcesso.id),
  membroId: text('membro_id')
    .notNull()
    .references(() => membros.id),
  tokenHash: text('token_hash').notNull().unique(),
  expiraEm: text('expira_em').notNull(),
  utilizadoEm: text('utilizado_em'),
  revogadoEm: text('revogado_em'),
  ...timestampsS02,
})

export const sessoes = sqliteTable('sessoes', {
  id: text('id').primaryKey(), // UUID
  contaAcessoId: text('conta_acesso_id').references(() => contasAcesso.id),
  membroId: text('membro_id')
    .notNull()
    .references(() => membros.id),
  tokenHash: text('token_hash').notNull().unique(),
  expiraEm: text('expira_em').notNull(),
  revogadoEm: text('revogado_em'),
  ultimoAcessoEm: text('ultimo_acesso_em'),
  userAgent: text('user_agent'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
})

export const tentativasAcesso = sqliteTable('tentativas_acesso', {
  id: text('id').primaryKey(), // UUID
  contaAcessoId: text('conta_acesso_id').references(() => contasAcesso.id),
  membroId: text('membro_id').references(() => membros.id),
  tipo: text('tipo').notNull(), // ATIVACAO, LOGIN_PIN, RECUPERACAO_ADMIN, LOGOUT
  sucesso: integer('sucesso', { mode: 'boolean' }).notNull(),
  motivo: text('motivo'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
})

export const rateLimitsAutenticacao = sqliteTable('rate_limits_autenticacao', {
  chaveHash: text('chave_hash').primaryKey(),
  falhasConsecutivas: integer('falhas_consecutivas').notNull().default(0),
  bloqueadoAte: text('bloqueado_ate'),
  expiraEm: text('expira_em').notNull(),
  ...timestampsS02,
})

// ============================================================
// Locais e Eventos (S04)
// ============================================================

export const locais = sqliteTable('locais', {
  id: text('id').primaryKey(), // UUID
  nome: text('nome').notNull(),
  endereco: text('endereco').notNull(),
  numero: text('numero').notNull(),
  complemento: text('complemento'),
  bairro: text('bairro'),
  cidade: text('cidade').notNull(),
  uf: text('uf').notNull(),
  cep: text('cep'),
  referencia: text('referencia'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  urlMaps: text('url_maps'),
  urlWaze: text('url_waze'),
  ativo: ativoDefault,
  ...timestampsS02,
})

export const seriesRecorrencia = sqliteTable(
  'series_recorrencia',
  {
    id: text('id').primaryKey(),
    titulo: text('titulo').notNull(),
    descricao: text('descricao'),
    pauta: text('pauta'),
    modalidade: text('modalidade').notNull(),

    frequencia: text('frequencia').notNull(), // DIARIA, SEMANAL, QUINZENAL, MENSAL_DIA_FIXO, MENSAL_POSICAO_SEMANA
    intervalo: integer('intervalo').notNull().default(1),
    dataInicio: text('data_inicio').notNull(), // YYYY-MM-DD (local America/Sao_Paulo)
    dataFim: text('data_fim').notNull(), // YYYY-MM-DD (local America/Sao_Paulo)
    horarioInicio: text('horario_inicio').notNull(), // HH:MM
    horarioFim: text('horario_fim').notNull(), // HH:MM
    timezone: text('timezone').notNull().default('America/Sao_Paulo'),

    diaSemana: integer('dia_semana'), // 0-6
    diaMes: integer('dia_mes'), // 1-31
    posicaoSemanaMes: integer('posicao_semana_mes'), // 1-5, -1

    localId: text('local_id').references(() => locais.id),
    urlOnline: text('url_online'),
    organizadorMembroId: text('organizador_membro_id').references(() => membros.id),

    regionalId: text('regional_id').references(() => regionais.id),
    administracaoId: text('administracao_id').references(() => administracoes.id),
    setorId: text('setor_id').references(() => setores.id),
    casaId: text('casa_id').references(() => casas.id),
    grupoTrabalhoId: text('grupo_trabalho_id').references(() => gruposTrabalho.id),

    observacoes: text('observacoes'),
    ativo: ativoDefault,
    ...timestampsS02,
  },
  table => ({
    checkEscopo: check(
      'check_serie_escopo_unico',
      sql`
      (CASE WHEN ${table.regionalId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${table.administracaoId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${table.setorId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${table.casaId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${table.grupoTrabalhoId} IS NOT NULL THEN 1 ELSE 0 END) = 1
    `
    ),
    idxDataInicio: index('idx_series_data_inicio').on(table.dataInicio),
    idxAtivo: index('idx_series_ativo').on(table.ativo),
  })
)

export const eventos = sqliteTable(
  'eventos',
  {
    id: text('id').primaryKey(), // UUID
    titulo: text('titulo').notNull(),
    descricao: text('descricao'),
    pauta: text('pauta'),
    modalidade: text('modalidade').notNull(), // PRESENCIAL, ONLINE, HIBRIDO
    inicioEm: text('inicio_em').notNull(), // ISO 8601 UTC
    fimEm: text('fim_em').notNull(), // ISO 8601 UTC
    localId: text('local_id').references(() => locais.id),
    urlOnline: text('url_online'),
    organizadorMembroId: text('organizador_membro_id').references(() => membros.id),

    // Escopo Institucional (Exatamente UM preenchido)
    regionalId: text('regional_id').references(() => regionais.id),
    administracaoId: text('administracao_id').references(() => administracoes.id),
    setorId: text('setor_id').references(() => setores.id),
    casaId: text('casa_id').references(() => casas.id),
    grupoTrabalhoId: text('grupo_trabalho_id').references(() => gruposTrabalho.id),

    observacoes: text('observacoes'),
    serieRecorrenciaId: text('serie_recorrencia_id').references(() => seriesRecorrencia.id),
    recorrenciaExcecao: integer('recorrencia_excecao', { mode: 'boolean' })
      .notNull()
      .default(false),

    // S09
    possuiManha: integer('possui_manha', { mode: 'boolean' }).notNull().default(false),
    possuiTarde: integer('possui_tarde', { mode: 'boolean' }).notNull().default(false),
    possuiNoite: integer('possui_noite', { mode: 'boolean' }).notNull().default(false),

    ativo: ativoDefault,
    ...timestampsS02,
  },
  table => ({
    checkEscopo: check(
      'check_evento_escopo_unico',
      sql`
      (CASE WHEN ${table.regionalId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${table.administracaoId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${table.setorId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${table.casaId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${table.grupoTrabalhoId} IS NOT NULL THEN 1 ELSE 0 END) = 1
    `
    ),
    idxInicioEm: index('idx_eventos_inicio_em').on(table.inicioEm),
    idxAtivo: index('idx_eventos_ativo').on(table.ativo),
    idxLocalId: index('idx_eventos_local_id').on(table.localId),
    idxSerieRecorrenciaId: index('idx_eventos_serie_recorrencia_id').on(table.serieRecorrenciaId),
  })
)

// ============================================================
// Convocações (S06)
// ============================================================

export const convocacoes = sqliteTable(
  'convocacoes',
  {
    id: text('id').primaryKey(),
    eventoId: text('evento_id')
      .notNull()
      .references(() => eventos.id),
    status: text('status').notNull(), // RASCUNHO, PUBLICADA, CANCELADA
    observacoes: text('observacoes'),
    publicadaEm: text('publicada_em'),
    canceladaEm: text('cancelada_em'),
    ativo: ativoDefault,
    ...timestampsS02,
  },
  table => ({
    checkStatus: check(
      'check_status_convocacao',
      sql`${table.status} IN ('RASCUNHO','PUBLICADA','CANCELADA')`
    ),
    idxEventoId: index('idx_convocacoes_evento_id').on(table.eventoId),
    idxStatus: index('idx_convocacoes_status').on(table.status),
  })
)

export const convocacaoFuncoes = sqliteTable(
  'convocacao_funcoes',
  {
    id: text('id').primaryKey(),
    convocacaoId: text('convocacao_id')
      .notNull()
      .references(() => convocacoes.id),
    funcaoId: text('funcao_id')
      .notNull()
      .references(() => funcoes.id),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  table => ({
    uniqueConvocacaoFuncao: uniqueIndex('idx_convocacao_funcao_unico').on(
      table.convocacaoId,
      table.funcaoId
    ),
    idxConvocacaoId: index('idx_convocacao_funcoes_convocacao_id').on(table.convocacaoId),
  })
)

export const convocacaoDestinatarios = sqliteTable(
  'convocacao_destinatarios',
  {
    id: text('id').primaryKey(),
    convocacaoId: text('convocacao_id')
      .notNull()
      .references(() => convocacoes.id),
    membroId: text('membro_id')
      .notNull()
      .references(() => membros.id),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  table => ({
    uniqueDestinatario: uniqueIndex('idx_convocacao_destinatario_unico').on(
      table.convocacaoId,
      table.membroId
    ),
    idxConvocacaoId: index('idx_convocacao_destinatarios_convocacao_id').on(table.convocacaoId),
    idxMembroId: index('idx_convocacao_destinatarios_membro_id').on(table.membroId),
  })
)

export const convocacaoDestinatarioEvidencias = sqliteTable(
  'convocacao_destinatario_evidencias',
  {
    id: text('id').primaryKey(),
    convocacaoDestinatarioId: text('convocacao_destinatario_id')
      .notNull()
      .references(() => convocacaoDestinatarios.id),
    funcaoId: text('funcao_id')
      .notNull()
      .references(() => funcoes.id),
    vinculoFuncionalId: text('vinculo_funcional_id')
      .notNull()
      .references(() => vinculosFuncionais.id),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  table => ({
    uniqueEvidencia: uniqueIndex('idx_convocacao_evidencia_unica').on(
      table.convocacaoDestinatarioId,
      table.funcaoId,
      table.vinculoFuncionalId
    ),
    idxDestinatarioId: index('idx_convocacao_evidencias_dest_id').on(
      table.convocacaoDestinatarioId
    ),
  })
)

export const rsvp = sqliteTable(
  'rsvp',
  {
    id: text('id').primaryKey(),
    convocacaoDestinatarioId: text('convocacao_destinatario_id')
      .notNull()
      .unique()
      .references(() => convocacaoDestinatarios.id),
    resposta: text('resposta').notNull(),
    justificativa: text('justificativa'),
    periodosParticipacao: text('periodos_participacao', { mode: 'json' }).$type<string[]>(), // S09: Array of MANHA, TARDE, NOITE
    respondidoEm: text('respondido_em').notNull(),
    atualizadoEm: text('atualizado_em').notNull(),
    ...timestampsS02,
  },
  table => ({
    checkResposta: check(
      'check_rsvp_resposta',
      sql`${table.resposta} IN ('PARTICIPAREI','NAO_PARTICIPAREI','NAO_SEI')`
    ),
    idxRsvpDestId: index('idx_rsvp_convocacao_dest_id').on(table.convocacaoDestinatarioId),
  })
)

// ============================================================
// Refeições (S09)
// ============================================================

export const eventoRefeicoes = sqliteTable(
  'evento_refeicoes',
  {
    id: text('id').primaryKey(),
    eventoId: text('evento_id')
      .notNull()
      .references(() => eventos.id),
    tipo: text('tipo').notNull(), // CAFE_MANHA, ALMOCO, LANCHE, JANTAR
    ativo: ativoDefault,
    ...timestampsS02,
  },
  table => ({
    checkTipo: check(
      'check_evento_refeicoes_tipo',
      sql`${table.tipo} IN ('CAFE_MANHA','ALMOCO','LANCHE','JANTAR')`
    ),
    uniqueEventoTipo: uniqueIndex('idx_evento_refeicoes_unico').on(table.eventoId, table.tipo),
  })
)

// ============================================================
// Notificações e Web Push (S10)
// ============================================================

export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    membroId: text('membro_id')
      .notNull()
      .references(() => membros.id),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    ativo: ativoDefault,
    ...timestampsS02,
  },
  table => ({
    idxEndpoint: uniqueIndex('idx_push_endpoint').on(table.endpoint),
    idxPushMembro: index('idx_push_membro').on(table.membroId),
  })
)

// ============================================================
// Portaria e Check-in (S11)
// ============================================================

export const checkins = sqliteTable(
  'checkins',
  {
    id: text('id').primaryKey(),
    convocacaoDestinatarioId: text('convocacao_destinatario_id')
      .notNull()
      .references(() => convocacaoDestinatarios.id),
    eventoId: text('evento_id')
      .notNull()
      .references(() => eventos.id),
    membroId: text('membro_id')
      .notNull()
      .references(() => membros.id),
    dataHoraCheckin: text('data_hora_checkin')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    forma: text('forma').notNull(), // QR, MANUAL
    status: text('status').notNull().default('ATIVO'),
    operadorMembroId: text('operador_membro_id').references(() => membros.id),
    ...timestampsS02,
  },
  table => ({
    checkForma: check('check_checkin_forma', sql`${table.forma} IN ('QR', 'MANUAL')`),
    checkStatus: check('check_checkin_status', sql`${table.status} IN ('ATIVO', 'RETIFICADO')`),
    uniqueEventoMembro: uniqueIndex('idx_checkin_evento_membro_unico')
      .on(table.eventoId, table.membroId)
      .where(sql`${table.status} = 'ATIVO'`),
    idxDestinatario: index('idx_checkin_destinatario').on(table.convocacaoDestinatarioId),
    idxMembro: index('idx_checkin_membro').on(table.membroId),
  })
)

export const portariasEvento = sqliteTable(
  'portarias_evento',
  {
    eventoId: text('evento_id').primaryKey().references(() => eventos.id),
    status: text('status').notNull().default('ABERTA'),
    fechadaEm: text('fechada_em'),
    fechadaPorMembroId: text('fechada_por_membro_id').references(() => membros.id),
    ...timestampsS02,
  },
  table => ({
    checkStatus: check('check_portaria_evento_status', sql`${table.status} IN ('ABERTA','FECHADA')`),
  })
)

export const portariaOperadoresEvento = sqliteTable(
  'portaria_operadores_evento',
  {
    id: text('id').primaryKey(),
    eventoId: text('evento_id').notNull().references(() => eventos.id),
    membroId: text('membro_id').notNull().references(() => membros.id),
    concedidoPorMembroId: text('concedido_por_membro_id').references(() => membros.id),
    revogadoEm: text('revogado_em'),
    ativo: ativoDefault,
    ...timestampsS02,
  },
  table => ({
    uniqueAtivo: uniqueIndex('idx_portaria_operador_evento_ativo')
      .on(table.eventoId, table.membroId)
      .where(sql`${table.ativo} = 1`),
    idxEvento: index('idx_portaria_operador_evento').on(table.eventoId, table.ativo),
    idxMembro: index('idx_portaria_operador_membro').on(table.membroId, table.ativo),
  })
)

// ============================================================
// Auditoria (S12)
// ============================================================

export const auditoriaLogs = sqliteTable(
  'auditoria_logs',
  {
    id: text('id').primaryKey(),
    acao: text('acao').notNull(),
    atorMembroId: text('ator_membro_id').references(() => membros.id),
  atorContaAcessoId: text('ator_conta_acesso_id').references(() => contasAcesso.id),
    recursoTipo: text('recurso_tipo').notNull(),
    recursoId: text('recurso_id').notNull(),
    escopoTipo: text('escopo_tipo'),
    escopoId: text('escopo_id'),
    contexto: text('contexto', { mode: 'json' }).$type<Record<string, unknown>>(),
    criadoEm: text('criado_em')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  table => ({
    idxAcao: index('idx_auditoria_acao').on(table.acao),
    idxAtor: index('idx_auditoria_ator').on(table.atorMembroId),
    idxRecurso: index('idx_auditoria_recurso').on(table.recursoTipo, table.recursoId),
    idxEscopo: index('idx_auditoria_escopo').on(table.escopoTipo, table.escopoId),
    idxCriadoEm: index('idx_auditoria_criado_em').on(table.criadoEm),
  })
)
