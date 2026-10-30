# Preflight e cross-audit compartilhado

Esta é a fonte operacional mínima para ChatGPT, Codex, Copilot e demais agentes usados no projeto. GitHub continua sendo a fonte verificável do estado real.

## Gates antes de merge

1. Base canônica: trabalho comum → `develop`; release → `develop` para `main`.
2. HEAD/SHA conhecido e correspondente ao commit revisado.
3. CI verde no HEAD atual.
4. Preflight verde.
5. Nenhuma thread de review aberta. Esse gate deve ser imposto pela proteção nativa do GitHub **Require conversation resolution before merging**, pois a resolução de conversa não oferece um gatilho confiável de GitHub Actions para reavaliar o mesmo SHA.
6. Nenhuma issue aberta com label `P0`.
7. Se houver alteração em `apps/worker/drizzle/`, tratar como migration e exigir plano de backup/rollback.
8. Não executar merge sem autorização do PMO.
9. Não executar deploy automaticamente; Worker/Pages são disparados pelo PMO.

## Cross-audit antes de liberar

- Segurança: autenticação, autorização, IDOR, XSS/CSRF, tokens e endpoints públicos.
- Escopos: Regional/Administração/Setor/Casa/GT e regras de Master.
- LGPD: minimização, exposição em logs/URLs e dados pessoais.
- Banco: migration, compatibilidade, unicidade, rollback/ponto de restauração.
- Contrato: frontend/backend/shared schemas e mensagens de erro.
- Operação: Worker antes de Pages quando aplicável; mesmo SHA em produção.
- UX: mobile/desktop, acessibilidade e códigos de tela.
- Documentação: regra funcional alterada deve atualizar sua fonte canônica.

## Drift checker mínimo

Durante revisão, comparar:
- `develop` × branch da PR;
- `main` × `develop` antes de release;
- workflows de deploy × runbooks;
- documentação funcional × comportamento implementado;
- instruções de agentes × estes gates.

O preflight automatiza verificações objetivas de base/SHA/impacto e blockers P0. A resolução de threads deve permanecer sob a proteção nativa da branch. Segurança, aderência funcional e smoke continuam exigindo revisão humana.

## Exceção transitória de release seletivo — PR #430 (30/10/2026)

A regra canônica continua sendo `develop → main`. Diante da divergência das branches e da aprovação exclusiva da UX de Pontos de Atendimento na PR #429, o preflight permite **somente a PR #430**, com base `main` e head `release/pr429-pontos-filtros-main-20261030`, identificados pelo evento autenticado do GitHub Actions.

A exceção exige diff limitado **exatamente** aos três arquivos a seguir:
- `apps/web/src/components/pontos-atendimento/PontosAtendimentoView.tsx` — alteração funcional homologada, frontend apenas;
- `scripts/preflight.mjs` — gate de uso único, vinculado à PR #430;
- `docs/00-governanca/preflight-cross-audit.md` — justificativa e rastreabilidade.

A exceção não vale para outras PRs, branches, merges diretos ou execuções manuais; qualquer arquivo adicional reprova o preflight. Permanece obrigatória a CI no HEAD, revisão do delta, verificação de P0 e de threads, autorização expressa do PMO para merge e deploy, além de smoke pós-deploy. Não altera Worker, D1 ou as demais regras de produção.

Após esta promoção, avaliar em PR separada um mecanismo geral e auditável de releases seletivos; **não ampliar a exceção temporária**.
