# Estudo preliminar — Preflight compartilhado (issue #184)

**Estado:** análise de extensões de mecanismos **já implementados**. O repositório possui `.github/workflows/preflight.yml`, que chama `scripts/preflight.mjs` em PRs ou execução manual e já produz resumo de impacto e bloqueia issues P0. Fonte complementar: `docs/00-governanca/preflight-cross-audit.md`. Esta PR não instala nem modifica gates.

## Objetivo

Reduzir ciclos de revisão e diferenças entre `develop`, `main`, deploy Worker/Pages e migrações D1, sem ferramentas pagas.

## Controles já implantados

- `.github/workflows/preflight.yml` aciona `scripts/preflight.mjs` em PRs e manualmente.
- Verifica **branch base/head e SHA do checkout**, produz resumo de impacto e bloqueia issues P0, conforme `docs/00-governanca/preflight-cross-audit.md`.
- **Gate de produção já implantado:** `.github/workflows/deploy-pages-production.yml` verifica um **Deploy Worker — Produção bem-sucedido para o mesmo `github.sha`** antes de publicar Pages; os workflows de produção compartilham o grupo de concorrência `production-release`, serializando execuções, sem estabelecer por si só a ordem Worker → Pages. Exige também confirmação explícita de release e smoke do Worker.

## Extensões propostas (ainda não implantadas por este estudo)

1. Consolidar CI obrigatória (lint, typecheck, testes e build) e revisões pendentes.
2. Avaliar tratamento de review threads P1/P2 e bloqueio de promoção quando houver review thread P1 não resolvida, sem repetir o gate P0 existente.
3. Inventariar migrações D1 da release e exigir evidência do backup antes do Worker de produção, complementando controles existentes.
4. Avaliar **extensões complementares** ao gate Worker → Pages já existente, como relatório consolidado da execução, detecção de divergência de configuração e registro de evidências do smoke; não reimplementar a checagem de mesmo SHA nem a ordem dos deploys.
5. Padronizar registro de smoke com cenários, versão e responsável, sem dados pessoais.
6. Não disparar deploy nem merge automaticamente neste estudo.

## Riscos a validar antes de automatizar

- GitHub Actions usa APIs com eventual atraso de estado; não assumir CI verde com checks ainda pendentes.
- As migrações D1 são executadas pelo workflow Worker; jamais reexecutar `seed` ou `reset` em produção.
- D1 Free exige revisão de consumo de consultas e limites de parâmetros, além de testes de autorização entre Regionais.
- Validação de variáveis e secrets deve confirmar presença, sem expor valores.
- A PR #306 foi homologada no build `6741936`; não promover trabalhos pós-release automaticamente.

## Entrega futura

**Estender o preflight existente**, sem criar workflow redundante: avaliar P1/P2, status das CIs, revisões pendentes, diferenças de configuração/ambiente e migrações em relação aos controles atuais de issues P0, SHA, ordem de deploy e resumo de impacto. Implementar somente após aprovação e com testes de falso positivo. Regras compartilhadas devem apontar para documentação canônica, evitando instruções duplicadas por agente.
