# ADR-003 — Modelo de Membros, Funções e Vínculos Funcionais

**Status:** DECIDIDO
**Data:** 2026-09-01
**Sprint:** S02

## Contexto

Um membro da Agenda Regional São Paulo pode possuir uma Casa de Oração principal e, simultaneamente, exercer diferentes funções em diversos níveis institucionais.

Exemplos:

- possuir uma Casa principal;
- ser responsável por outra Casa;
- exercer função em um Setor;
- participar de Grupo de Trabalho;
- exercer funções distintas em escopos diferentes.

O modelo não poderia limitar o membro a uma única função ou duplicar a pessoa para representar responsabilidades adicionais.

## Decisão

O modelo será dividido em três entidades:

- `membros`;
- `funcoes`;
- `vinculos_funcionais`.

### Casa principal

Cada membro possui uma Casa principal obrigatória, registrada em:

`membros.casa_id`

A alteração dessa Casa preserva a identidade e o `id` do membro.

### Funções

As funções são cadastradas independentemente dos membros e dos escopos onde são exercidas.

### Vínculos funcionais

Um vínculo funcional relaciona:

`membro + função + escopo`

O escopo pode ser exatamente um entre:

- Regional;
- Administração;
- Setor;
- Casa de Oração;
- Grupo de Trabalho.

A regra de exatamente um escopo é protegida pela aplicação e pelo banco de dados.

### Duplicidade

A mesma combinação ativa de:

`membro + função + mesmo escopo`

não pode existir mais de uma vez.

Vínculos inativos são preservados e não impedem a criação posterior de novo vínculo ativo equivalente.

## Consequências

### Positivas

- um membro pode exercer várias funções simultaneamente;
- a mesma função pode ser exercida em vários escopos;
- responsabilidades adicionais não alteram a Casa principal;
- é possível construir futuramente um mapa funcional completo do membro;
- vínculos podem ser inativados sem perda de registro.

### Restrições

- exatamente um escopo deve estar preenchido em cada vínculo;
- vínculos duplicados ativos são proibidos;
- não há exclusão física prevista para vínculos funcionais;
- histórico de alterações detalhado será tratado futuramente pelo mecanismo geral de auditoria.

## Implementação

A S02 implementa:

- schema Drizzle;
- validações Zod;
- API REST;
- migration D1/SQLite;
- foreign keys;
- `CHECK` de escopo único;
- índices únicos parciais para vínculos ativos;
- testes automatizados.
