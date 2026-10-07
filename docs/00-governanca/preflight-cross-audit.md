# Preflight e cross-audit compartilhado

Esta é a fonte operacional mínima para ChatGPT, Codex, Copilot e demais agentes usados no projeto. GitHub continua sendo a fonte verificável do estado real.

## Gates antes de merge

1. Base canônica: trabalho comum → `develop`; release → `develop` para `main`.
2. HEAD/SHA conhecido e correspondente ao commit revisado.
3. CI verde no HEAD atual.
4. Preflight verde.
5. Nenhuma thread de review aberta.
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

O preflight automatiza apenas verificações objetivas. Segurança, aderência funcional e smoke continuam exigindo revisão humana.
