import { sqliteTable, text, integer, check } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ============================================================
// Funções auxiliares (Defaults)
// ============================================================
// Drizzle suporta UUID nativo, mas para SQLite D1 usamos randomUUID() gerado na aplicação
// ou sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))` 
// Usar UUID no cliente (Zod/crypto.randomUUID) é melhor no Cloudflare, então não vamos colocar 'default' gerado no banco para IDs por enquanto. Mas no schema vamos marcar.

const timestamps = {
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
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
export const gruposTrabalho = sqliteTable('grupos_trabalho', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  ativo: ativoDefault,
  
  // FKs nullables
  regionalId: text('regional_id').references(() => regionais.id),
  administracaoId: text('administracao_id').references(() => administracoes.id),
  setorId: text('setor_id').references(() => setores.id),
  
  ...timestamps,
}, (table) => ({
  checkEscopo: check(
    'check_escopo_unico',
    sql`
      (CASE WHEN ${table.regionalId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${table.administracaoId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${table.setorId} IS NOT NULL THEN 1 ELSE 0 END) = 1
    `
  )
}))

// ============================================================
// Membros, Funções e Vínculos Funcionais (S02)
// ============================================================

const timestampsS02 = {
  createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
}

export const membros = sqliteTable('membros', {
  id: text('id').primaryKey(), // UUID
  nome: text('nome').notNull(),
  dataNascimento: text('data_nascimento'),
  celular: text('celular'),
  casaId: text('casa_id').notNull().references(() => casas.id),
  ativo: ativoDefault,
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

export const vinculosFuncionais = sqliteTable('vinculos_funcionais', {
  id: text('id').primaryKey(),
  membroId: text('membro_id').notNull().references(() => membros.id),
  funcaoId: text('funcao_id').notNull().references(() => funcoes.id),
  
  regionalId: text('regional_id').references(() => regionais.id),
  administracaoId: text('administracao_id').references(() => administracoes.id),
  setorId: text('setor_id').references(() => setores.id),
  casaId: text('casa_id').references(() => casas.id),
  grupoTrabalhoId: text('grupo_trabalho_id').references(() => gruposTrabalho.id),
  
  ativo: ativoDefault,
  ...timestampsS02,
}, (table) => ({
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
  uniqueRegional: uniqueIndex('idx_vinculo_unico_regional').on(table.membroId, table.funcaoId, table.regionalId).where(sql`${table.regionalId} IS NOT NULL AND ${table.ativo} = 1`),
  uniqueAdministracao: uniqueIndex('idx_vinculo_unico_administracao').on(table.membroId, table.funcaoId, table.administracaoId).where(sql`${table.administracaoId} IS NOT NULL AND ${table.ativo} = 1`),
  uniqueSetor: uniqueIndex('idx_vinculo_unico_setor').on(table.membroId, table.funcaoId, table.setorId).where(sql`${table.setorId} IS NOT NULL AND ${table.ativo} = 1`),
  uniqueCasa: uniqueIndex('idx_vinculo_unico_casa').on(table.membroId, table.funcaoId, table.casaId).where(sql`${table.casaId} IS NOT NULL AND ${table.ativo} = 1`),
  uniqueGT: uniqueIndex('idx_vinculo_unico_gt').on(table.membroId, table.funcaoId, table.grupoTrabalhoId).where(sql`${table.grupoTrabalhoId} IS NOT NULL AND ${table.ativo} = 1`),
}))
