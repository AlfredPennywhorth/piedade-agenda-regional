// S00 — Schema Drizzle ORM (scaffolding mínimo)
//
// GOVERNANÇA: Este arquivo NÃO deve ser modificado sem aprovação do PMO.
// O schema definitivo será definido na Sprint S01 após decisão sobre:
//   - Modelo hierárquico institucional
//   - Regras de convocação
//   - Política de autenticação (PMO-001 — autenticação própria aprovada)
//   - Regras de LGPD
//
// RESSALVA PMO: Separação estrita entre código Node e código Worker.
// Importar apenas de 'drizzle-orm/sqlite-core' (compatível com D1 e Node).

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// ============================================================
// Tabela de scaffolding — NÃO utilizar em produção
// Serve apenas para validar a integração Drizzle + D1
// ============================================================
export const _migrationControl = sqliteTable('_migration_control', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sprint: text('sprint').notNull(),
  appliedAt: text('applied_at').notNull(),
})

// ============================================================
// Schemas de negócio — aguardando Sprint S01
// ============================================================
// export const membros = sqliteTable('membros', { ... })
// export const reunioes = sqliteTable('reunioes', { ... })
// export const convocacoes = sqliteTable('convocacoes', { ... })
