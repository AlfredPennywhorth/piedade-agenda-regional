# Modelo de Dados

Este diretório contém a documentação do modelo de dados do projeto **Agenda Regional São Paulo**.

## Tecnologia

- **Cloudflare D1** (SQLite em edge) via Drizzle ORM
- Migrações gerenciadas por `drizzle-kit`
- Schema fonte em: `apps/worker/src/db/schema.ts`

## Entidades previstas (a definir pelo PMO)

- `membros` — cadastro de membros (dados mínimos, conformidade LGPD)
- `reunioes` — registro de reuniões
- `convocacoes` — convocações individuais
- `sessoes` — sessões de autenticação (ver ADR-001)
- `links_ativacao` — links individuais de ativação

> **AVISO:** Nenhum dado real de membro deve ser inserido no banco de desenvolvimento.
> Utilize apenas dados sintéticos.

## Status

| Entidade | Status |
|---|---|
| `_migration_control` | Scaffolding S00 |
| `membros` | Aguarda S01 |
| `reunioes` | Aguarda S01 |
| `convocacoes` | Aguarda S01 |
| `sessoes` | Aguarda definição ADR-001 + S01 |

> **Status:** Schema de scaffolding criado. Modelo de negócio aguarda Sprint S01.
