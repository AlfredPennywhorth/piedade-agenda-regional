# Preparação de release — Regionais e Administrações

## Candidato homologado

- Implementação: PR #432, integrada em `develop` por `d0f49a2bc7e0fb3eb125a56cc2697408d8b999ae`.
- Telas: AGD-ADM-005/037/038 (Regionais) e AGD-ADM-006/039/040 (Administrações).
- CI pós-merge #2021: https://github.com/AlfredPennywhorth/piedade-agenda-regional/actions/runs/41131431838 — sucesso no candidato.
- Pages Beta #121: https://github.com/AlfredPennywhorth/piedade-agenda-regional/actions/runs/41132047152 — sucesso no mesmo SHA; tela de entrada conferida com build `d0f49a2`.
- PO confirmou **“aprovados”** após a publicação no Beta. Registro: https://github.com/AlfredPennywhorth/piedade-agenda-regional/pull/432#issuecomment-6534015408.
- Não é necessário regerar referências ou repetir o aceite estético.

## Reconciliação antes da promoção

Base de produção examinada: `main` em `067bd79e6ec22d15636690f396a0da9559a0de88`. As releases seletivas #427/#430 deixaram quatro commits exclusivos em `main`; os commits de implementação correspondentes já existem em `develop`. A contagem de commits/diff contra o ancestral comum não representa o delta real de produto.

A comparação direta das árvores `main` e `develop` mostrou apenas o novo lote territorial, testes/documentos e a diferença dos dois arquivos da exceção transitória do preflight #430. **Worker, schemas compartilhados, migrations, workflows de produção e as funcionalidades de Pontos/Tipos já publicadas têm conteúdo idêntico nas duas pontas.**

A reconciliação proposta integra o histórico de `main` em uma branch baseada no candidato Beta, preservando os arquivos de governança/preflight de `main`. O único conflito ocorreu em `apps/web/src/index.css`; a resolução preserva integralmente o CSS de `develop` homologado no Beta. Nenhum HTML de referência ou dado foi alterado.

Conferência obrigatória da PR de reconciliação: `apps/web/`, `apps/worker/`, `packages/shared/` e `.github/workflows/` devem permanecer byte a byte iguais ao candidato `d0f49a2b`. O delta em relação a `develop` fica restrito aos dois arquivos do preflight/governança e a este registro. A exceção #430 continua restrita àquela PR; não foi ampliada nem reutilizada.

**Método necessário:** a PR de reconciliação deve entrar em `develop` por **Create a merge commit**, preservando os dois pais e a ancestralidade de `main`. Squash ou rebase eliminariam o objetivo da reconciliação. O repositório permite merge commits. A aprovação desta preparação não executa esse merge.

Depois desse merge autorizado, atualizar/verificar a PR canônica `develop → main`; seu diff deve ficar limitado ao lote territorial homologado, seus testes/documentos e este registro. Se aparecer qualquer alteração de Worker/migration ou reversão de funcionalidade já publicada, interromper a promoção e revisar o delta. Executar CI/preflight e revisão Codex no HEAD final da release, sem reaproveitar aprovação de um SHA anterior.

## Publicação de produção — ainda não executada

1. Aprovar e integrar a reconciliação por merge commit; validar a PR de release `develop → main`.
2. Obter autorização específica de merge da release e registrar o novo SHA de `main` e a CI pós-merge.
3. Obter autorização de publicação. **O fluxo atual de Pages Produção exige um Deploy Worker Produção bem-sucedido no mesmo SHA e confirmação do smoke**, mesmo quando o delta funcional é somente de frontend. Não contornar esse gate nem alterar workflows nesta preparação.
4. Antes do workflow Worker, verificar de verdade o ponto de restauração/backup do D1 e os requisitos do runbook. O workflow contém a etapa de migrations; a comparação das árvores não encontrou migration nova, mas isso não comprova o estado do banco remoto nem autoriza marcar `confirm_backup` sem evidência.
5. Publicar Worker pelo fluxo existente, executar smoke e somente então publicar Pages no mesmo SHA, com as confirmações correspondentes. A ausência de mudança no Worker não equivale a dispensar essas etapas operacionais.
6. Conferir URL, build, autenticação, cabeçalho/logotipo e as seis telas em produção. Se houver falha, seguir o rollback do runbook, sem reescrever `main` ou restaurar banco por inferência.

## Limites

Esta preparação não faz merge em `develop`/`main`, deploy, migração, backup ou alteração de dados. A homologação Beta não comprova automaticamente todos os perfis e condições do ambiente de produção. PRs documentais #363/#364 permanecem independentes. Dívidas #425, #426, #431 e #417 preservadas, fora desta release. Os demais lotes visuais ficam para a sequência posterior.
