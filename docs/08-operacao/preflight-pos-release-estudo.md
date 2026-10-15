# Estudo preliminar — Preflight compartilhado (issue #184)

**Estado:** análise de extensões de mecanismos **já implementados**. O repositório possui `.github/workflows/preflight.yml`, que chama `scripts/preflight.mjs` em PRs ou execução manual e já produz resumo de impacto e bloqueia issues P0. Fonte complementar: `docs/00-governanca/preflight-cross-audit.md`. Esta PR não instala nem modifica gates.

## Objetivo
Reduzir ciclos de revisão e diferenças entre `develop`, `main`, deploy Worker/Pages e migrações D1, sem ferramentas pagas.

## Controles já implantados
- `.github/workflows/preflight.yml` aciona `scripts/preflight.mjs` em PRs e manualmente.
- Verifica **branch base/head e SHA do checkout**, produz resumo de impacto e bloqueia issues P0, conforme `docs/00-governanca/preflight-cross-audit.md`.

## Extensões propostas (ainda não implantadas por este estudo)
1. Consolidar CI obrigatória (lint, typecheck, testes e build) e revisões pendentes.
2. Avaliar tratamento de review threads P1/P2 e bloqueio de promoção diante de P1 não resolvido, sem repetir o gate P0 existente.
3. Inventariar migrações D1 da release e exigir evidência do backup antes do Worker de produção, complementando controles existentes.
4. Verificar compatibilidade do **mesmo SHA** no deploy Worker/Pages e sequência dos deploys, além da verificação de checkout já implantada.
5. Padronizar registro de smoke com cenários, versão e responsável, sem dados pessoais.
6. Não disparar deploy nem merge automaticamente neste estudo.

## Riscos a validar antes de automatizar
- GitHub Actions usa APIs com eventual atraso de estado; não assumir CI verde com checks ainda pendentes.
- As migrações D1 são executadas pelo workflow Worker; jamais reexecutar `seed` ou `reset` em produção.
- D1 Free exige revisão de consumo de consultas e limites de parâmetros, além de testes de autorização entre Regionais.
- Validação de variáveis e secrets deve confirmar presença, sem expor valores.
- A PR #306 foi homologada no build `6741936`; não promover trabalhos pós-release automaticamente.

## Entrega futura
**Estender o preflight existente**, sem criar workflow redundante: avaliar P1/P2, status das CIs, revisões pendentes, diferença de SHAs e migrações em relação ao controle atual de issues P0 e resumo de impacto. Implementar somente após aprovação e com testes de falso positivo. Regras compartilhadas devem apontar para documentação canônica, evitando instruções duplicadas por agente.
