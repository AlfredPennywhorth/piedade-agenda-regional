# Modelo de Dados

Este diretório contém a documentação do modelo de dados do projeto **Agenda Regional São Paulo**.

## Tecnologia

- **Cloudflare D1** (SQLite em edge) via Drizzle ORM
- Migrações gerenciadas por `drizzle-kit`
- Schema fonte em: `apps/worker/src/db/schema.ts`

## Entidades da Sprint S01 (Modelo Institucional)

- `regionais` — nível máximo da instituição
- `administracoes` — contida na regional
- `setores` — contido na administração
- `casas` — (Casa de Oração) contida no setor, permitindo transferência de setor
- `grupos_trabalho` — escopo dinâmico (Regional, Administração ou Setor) (ver ADR-002)

> **AVISO:** Nenhum dado real de membro deve ser inserido no banco de desenvolvimento.
> Utilize apenas dados sintéticos.

## Status

| Entidade | Status | Sprint |
|---|---|---|
| `regionais` | Finalizado | S01 |
| `administracoes` | Finalizado | S01 |
| `setores` | Finalizado | S01 |
| `casas` | Finalizado | S01 |
| `grupos_trabalho`| Finalizado | S01 |
| `membros` | Aguarda S02+ | -- |
| `reunioes` | Aguarda S02+ | -- |
| `convocacoes` | Aguarda S02+ | -- |
| `sessoes` | Aguarda S02+ | -- |

> **Status:** Fundação de domínio institucional (S01) criada. Aguardando próximas sprints para implementação das lógicas operacionais de negócio.
