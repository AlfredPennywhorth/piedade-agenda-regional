# ADR-002 — Modelagem de Escopo para Grupos de Trabalho

**Data:** 2026-08-31
**Status:** APROVADO (Sprint S01)

## Contexto

Um Grupo de Trabalho (GT) na instituição não pertence a um nível fixo da hierarquia. Ele pode ser constituído em escopo de Regional, Administração ou Setor. (Ex: "GT Fundo Musical" no nível Regional, ou "GT Y" no nível de Setor).

Foi necessário modelar o relacionamento do GT no banco de dados sem criar três tabelas idênticas e isoladas (`grupos_trabalho_regional`, `grupos_trabalho_administracao`, etc).

## Alternativas Consideradas

### 1. Polimorfismo Típico (Entity-Attribute-Value Simplificado)
*   Tabela com `escopo` (enum: 'regional', 'administracao', 'setor') e `escopo_id` (string UUID).
*   **Vantagem:** Apenas duas colunas.
*   **Desvantagem:** Quebra a integridade referencial do banco. O SQLite não conseguiria validar automaticamente via `FOREIGN KEY` se o ID apontado existe na tabela correta, exigindo tratamento complexo na camada da aplicação (podendo gerar órfãos de dados se uma entidade pai for excluída).

### 2. Três Foreign Keys Mutuamente Exclusivas (ESCOLHIDA)
*   Tabela `grupos_trabalho` com três colunas: `regional_id`, `administracao_id`, `setor_id`.
*   Todas são configuradas como Nullables e declaradas como `FOREIGN KEY`s apontando para suas tabelas de origem.
*   Adiciona-se uma constraint `CHECK` no banco de dados garantindo que a soma dos campos "não nulos" seja exatamente igual a `1`.

## Decisão (PMO-S01)

A **Alternativa 2 (Foreign Keys Mutuamente Exclusivas)** foi adotada.

Esta escolha delega a integridade referencial nativamente para o banco de dados. Um GT jamais existirá apontando para um ID inexistente de uma Regional/Adm/Setor, e a constraint CHECK impede a criação de um GT sem escopo ou pertencendo a múltiplos escopos simultaneamente.

## Validação em Camadas

A regra do "escopo único" foi imposta em duas camadas, conforme exigência do PMO:
1.  **Zod Schema:** Na recepção dos dados na API, o pacote Shared valida se a request contém exatamente 1 ID preenchido via `refine()`.
2.  **Constraint D1/SQLite:** No momento do `INSERT` ou `UPDATE`, o próprio SGBD avalia a regra matemática `(regional_id IS NOT NULL) + (administracao_id IS NOT NULL) + (setor_id IS NOT NULL) = 1`.

## Consequências

-   Atualizações (PATCH) em Grupos de Trabalho exigem que a API forneça clareza sobre qual escopo está sendo substituído e os demais sejam enviados como nulos caso haja alteração de escopo (apesar de raramente um GT mudar de escopo).
-   Integração segura, sem risco de dados corrompidos.
