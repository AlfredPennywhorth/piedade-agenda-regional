# Modelo de Dados

Este diretório contém a documentação do modelo de dados do projeto **Agenda Regional São Paulo**.

## Tecnologia

- **Cloudflare D1** (SQLite em edge) via Drizzle ORM
- Schema fonte em: `apps/worker/src/db/schema.ts`
- Migrações versionadas em: `apps/worker/drizzle/`

## Entidades da Sprint S01 — Modelo Institucional

- `regionais` — nível máximo da instituição
- `administracoes` — vinculada à Regional
- `setores` — vinculado à Administração
- `casas` — Casa de Oração vinculada ao Setor, permitindo transferência de Setor sem alteração de identidade
- `grupos_trabalho` — escopo institucional flexível em Regional, Administração ou Setor (ver ADR-002)

## Entidades da Sprint S02 — Membros, Funções e Vínculos

### `membros`

Representa as pessoas cadastradas no sistema.

Campos principais:

- `id` — UUID textual
- `nome`
- `data_nascimento`
- `celular`
- `casa_id` — Casa de Oração principal do membro
- `ativo`
- `created_at`
- `updated_at`

### Regra da Casa principal

Cada membro possui exatamente uma **Casa de Oração principal**, registrada diretamente em `membros.casa_id`.

Essa relação representa o vínculo institucional principal da pessoa e não impede que ela exerça responsabilidades em outras Casas, Setores, Administrações, na Regional ou em Grupos de Trabalho.

Alterar a Casa principal não recria o membro e não altera seu `id`.

---

### `funcoes`

Representa as funções institucionais que podem ser atribuídas aos membros.

Campos principais:

- `id` — UUID textual
- `nome`
- `codigo` — opcional
- `descricao` — opcional
- `ativo`
- `created_at`
- `updated_at`

A função é cadastrada separadamente da pessoa e do local onde é exercida.

---

### `vinculos_funcionais`

Representa o exercício de uma função por um membro em um escopo institucional determinado.

Campos principais:

- `id` — UUID textual
- `membro_id`
- `funcao_id`
- `regional_id`
- `administracao_id`
- `setor_id`
- `casa_id`
- `grupo_trabalho_id`
- `ativo`
- `created_at`
- `updated_at`

### Regra de escopo único

Cada vínculo funcional deve possuir **exatamente um** dos seguintes escopos:

- Regional;
- Administração;
- Setor;
- Casa de Oração;
- Grupo de Trabalho.

Essa regra é protegida em duas camadas:

1. validação da API com Zod;
2. `CHECK` no banco de dados D1/SQLite.

### Regra de duplicidade

Não pode existir mais de um vínculo **ativo** com a mesma combinação:

`membro + função + mesmo escopo`

Essa proteção é implementada por cinco índices únicos parciais, um para cada tipo de escopo.

Vínculos inativos são preservados e não impedem a criação de um novo vínculo ativo equivalente.

---

## Integridade referencial

As entidades da S02 utilizam foreign keys para garantir:

- membro vinculado a uma Casa existente;
- vínculo funcional associado a um membro existente;
- vínculo funcional associado a uma função existente;
- escopo funcional associado a uma entidade institucional existente.

Nos testes SQLite, `foreign_keys` é explicitamente habilitado.

---

## Dados de desenvolvimento

> **AVISO:** Nenhum dado real de membro deve ser inserido no banco de desenvolvimento ou nos testes.
> Utilize exclusivamente dados sintéticos.

---

## Status

| Entidade              | Status       | Sprint        |
| --------------------- | ------------ | ------------- |
| `regionais`           | Finalizado   | S01           |
| `administracoes`      | Finalizado   | S01           |
| `setores`             | Finalizado   | S01           |
| `casas`               | Finalizado   | S01           |
| `grupos_trabalho`     | Finalizado   | S01           |
| `membros`             | Implementado | S02           |
| `funcoes`             | Implementado | S02           |
| `vinculos_funcionais` | Implementado | S02           |
| `reunioes`            | Planejado    | Sprint futura |
| `convocacoes`         | Planejado    | Sprint futura |
| `sessoes`             | Planejado    | Sprint futura |

> **Status:** Modelo institucional da S01 preservado e modelo de Membros, Funções e Vínculos Funcionais implementado na S02.
