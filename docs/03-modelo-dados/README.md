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
- `data_nascimento` — **legado**, sem uso funcional vigente; mantido temporariamente até saneamento/migração de remoção
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

## Entidades da Sprint S04 — Locais e Eventos

### `locais`

Representa espaços físicos que podem sediar eventos presencias ou híbridos.
É uma entidade reutilizável.

Campos principais:
- `id` — UUID textual
- `nome`
- `endereco`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `cep` — Dados de localização
- `latitude`, `longitude` — Coordenadas opcionais
- `url_maps`, `url_waze` — URLs (restritas a http/https)
- `ativo`
- `created_at` e `updated_at`

### `eventos`

Representa o cadastro-base de um evento de ocorrência única na S04 (sem exclusão física, sem recorrência nesta sprint).

Campos principais:
- `id` — UUID textual
- `titulo`, `descricao`, `pauta`
- `modalidade` — `PRESENCIAL`, `ONLINE` ou `HIBRIDO`
- `inicio_em`, `fim_em` — Persistidos em ISO 8601 UTC
- `local_id` — Opcional, requerido se PRESENCIAL ou HIBRIDO
- `url_online` — Opcional (restrito a http/https), requerido se ONLINE ou HIBRIDO
- `organizador_membro_id` — Opcional
- `ativo`
- `created_at` e `updated_at`

### Regra de Escopo Único

Semelhante aos vínculos funcionais, cada evento deve possuir **exatamente um** dos seguintes escopos institucionais:
- Regional (`regional_id`);
- Administração (`administracao_id`);
- Setor (`setor_id`);
- Casa de Oração (`casa_id`);
- Grupo de Trabalho (`grupo_trabalho_id`).

Essa regra é validada tanto na API (Zod superRefine) quanto no D1 (CHECK constraint `check_evento_escopo_unico`).

### Regra de Fuso e Horário

- O fim do evento (`fim_em`) deve ser sempre estritamente posterior ao seu início (`inicio_em`).
- O evento não pode atravessar mais de um dia considerando o timezone operacional `America/Sao_Paulo`.

## Entidades da Sprint S05 — Recorrência de Eventos

### `series_recorrencia`

Modela a regra de recorrência, isolada da materialização física.
Campos principais:
- `frequencia` — DIARIA, SEMANAL, QUINZENAL, MENSAL_DIA_FIXO, MENSAL_POSICAO_SEMANA
- `data_inicio`, `data_fim` — Obrigatórias, ditam o horizonte de materialização (YYYY-MM-DD em fuso local).
- `horario_inicio`, `horario_fim` — Horários estáticos (America/Sao_Paulo).
- Demais atributos

### Séries de Recorrência e Exceções

O banco armazena de forma independente eventos gerados em lote, sendo cada ocorrência um registro na tabela `eventos`. A tabela `series_recorrencia` atua apenas como geradora, mas a chave estrangeira em `eventos.serie_recorrencia_id` mantém o vínculo histórico. Quando um evento singular dessa série for alterado, o flag `recorrencia_excecao` vira `true`.

## Entidades da Sprint S06 — Convocações

- `convocacoes` — entidade que centraliza o convite institucional atrelado a um evento.
  - Campos: ID, eventoId, status (RASCUNHO, PUBLICADA, CANCELADA), observacoes, datas de lifecycle.
  - Herda o escopo institucional diretamente do evento atrelado; não possui escopo próprio.
- `convocacao_funcoes` — tabela associativa entre convocação e as funções requeridas para o evento (ex: "Porteiro", "Músico").
- `convocacao_destinatarios` — snapshot do destinatário lógico (pessoa).
  - Campos: ID, convocacaoId, membroId.
- `convocacao_destinatario_evidencias` — evidências (vínculos e funções) que tornaram aquele destinatário elegível.
  - Campos: ID, convocacaoDestinatarioId, funcaoId, vinculoFuncionalId.
  - Um destinatário pode ter múltiplas evidências caso seja elegível por diferentes funções ou vínculos no mesmo escopo.
  - Como é um snapshot gerado na publicação, não reflete retroativamente alterações feitas no membro ou no vínculo posteriormente.

### Alterações em `eventos`

Para suportar a recorrência, a tabela `eventos` recebeu:
- `serie_recorrencia_id` — Vínculo FK para identificar a qual série a ocorrência pertence.
- `recorrencia_excecao` — Flag indicando se a ocorrência sofreu mutação individual ("SOMENTE ESTA"), desconectando algumas das regras da matriz, mas mantendo a FK.

---

## Integridade referencial

As entidades da S02, S03, S04 e S05 utilizam foreign keys para garantir a validade dos relacionamentos (membros, casas, vínculos, locais, eventos, series_recorrencia). Nos testes SQLite, `foreign_keys = ON` é explicitamente habilitado.

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
| `membros`             | Finalizado   | S02           |
| `funcoes`             | Finalizado   | S02           |
| `vinculos_funcionais` | Finalizado   | S02           |
| `links_ativacao`      | Finalizado   | S03           |
| `sessoes`             | Finalizado   | S03           |
| `tentativas_acesso`   | Finalizado   | S03           |
| `locais`              | Finalizado   | S04           |
| `eventos`             | Finalizado   | S04           |
| `series_recorrencia`  | Implementado | S05           |
| `convocacoes`         | Implementado | S06           |
| `reunioes`            | Planejado    | Sprint futura |

> **Status:** Modelo base (S01), Membros e Vínculos (S02), Autenticação (S03), e Locais/Eventos (S04) preservados. Séries de Recorrência (S05) introduzidas pela Migration 0005.
