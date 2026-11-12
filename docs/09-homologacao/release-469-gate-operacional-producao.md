# Release seletiva #469 — gate operacional de produção (sem autorização de deploy)

> **Situação: PLANO E PRÉ-VALIDAÇÃO.** Este documento NÃO constitui aprovação para merge na `main`, não aciona GitHub Actions de produção e não autoriza alteração de dados. A PR #469 mantém o HEAD `49eedc3e40133dee9bdc4e6295a4e2acc619c2fa` na verificação de 04/11/2026. Revalidar todos os identificadores na execução futura.

## 1. Evidência apurada

- PR #469: CI #2149 **success**, Preflight #910 **success**, revisão Codex no HEAD sem achados relevantes, threads resolvidas, `mergeable=true`, **não mergeada**.
- Comparação com `main`: 13 arquivos (11 de aplicação/testes, 2 de política/testes Preflight), nenhum arquivo LGPD ou nova migration. Não selecionar `develop` como fonte do deploy.
- HML469 GitHub Actions run #1 **success**: testes automatizados no commit exato, em runner temporário, sem Cloudflare. Os testes Worker usam Node/Vitest e shim SQLite; **não equivalem a execução no D1 remoto/Workers runtime**.
- Ambiente Cloudflare isolado **não criado**: capacidade da conta no limite; exigência de custo incremental US$ 0. Não criar infraestrutura adicional sem comprovante.
- Estado de produção real, backups/time-travel habilitados, migrations D1 pendentes, dados legados e URLs públicas: **NÃO VERIFICADOS POR ACESSO À CLOUDFLARE**. Não assinalar essas verificações como aprovadas.

## 2. Condições bloqueantes (GO/NO-GO)

1. **Identidade:** confirmar que `main` e PR #469 não mudaram; repetir CI, Preflight, análises de revisão e diff LGPD. Se `main` mudou, rebase/refazer gates. Não usar `develop` como substituto.
2. **Segurança:** nenhum arquivo LGPD, schema ou migração incidental; nenhuma alteração fora da lista aprovada #468/#459/#463/#465/#467/#454 e proteção do próprio Preflight. Preservar issues P0/threads resolvidas e exceção de preflight estreita já revisada.
3. **D1 produção (somente leitura antes da autorização):** conferir o ID e nome do D1 alvo, estado de migrations **aplicadas e pendentes** (o workflow de Worker executa `wrangler d1 migrations apply --remote --env production` independentemente de a PR alterar migrations), integridade básica de convocação por evento, backup/time-travel e ponto de restauração identificável. **Se existir migration pendente, suspender** e abrir análise específica; a PR não contém novas migrations.
4. **Backup/reversão:** confirmar capacidade efetiva de restaurar D1 e a janela de recuperação; registrar método e responsável. Time Travel é mecanismo de recuperação, **não substitui** procedimento validado de restauração; qualquer restauração pode sobrescrever atualizações posteriores e exige decisão institucional.
5. **Implantação:** manter apenas os workflows existentes em `main`, com `environment: production` e confirmações explícitas. Primeiro Worker, verificar execução e smoke; só depois Pages com mesmo SHA. Worker/Pages **não são uma transação atômica**: conferir compatibilidade temporária entre a UI antiga e API nova antes do Worker; se incompatível, NO-GO.
6. **Cota Cloudflare:** não criar novos recursos; produção usa Worker, D1 e Pages existentes. Confirmar que novas execuções não implicam cobrança adicional nem ultrapassam limites operacionais.
7. **Autorização:** nenhum merge em `main` nem deploy antes de autorização específica do PMO, baseada no relatório GO/NO-GO. Não marcar campos `confirm_release`, `confirm_backup` ou `confirm_worker_smoke` como verdadeiros sem evidência factual correspondente.

## 3. Sequência de publicação — somente após GO e autorização

1. Registrar `main` SHA de origem, HEAD da PR e SHA do merge aprovado. Conferir que a release efetiva não inclui LGPD.
2. Antes do Worker: ponto de recuperação D1 real identificado e verificável, migrations pendentes = zero, ações de reversão compreendidas, equipe ciente da janela e recursos.
3. Executar workflow **Deploy Worker — Produção** em `main` no SHA aprovado; registrar run ID e sucesso dos estágios de preflight D1, migrações, publicação e secrets. Se qualquer etapa falhar: PARAR, não iniciar Pages.
4. Smoke API no Worker publicado: saúde/versão, login/PIN sintético autorizado, convocações existentes sem mutação, inclusão/segregação por PA somente com caso de teste autorizado, exceção Brás/Bom Retiro, RSVP negativo, 409 ao tentar alterar PA publicado, preservação de relatórios/Portaria e ausência de LGPD pendente.
5. Somente após smoke Worker aprovado, executar **Deploy Pages — Produção** no mesmo SHA, verificando URL API produção, versão exibida, navegação, tela mobile 320/375px, identificadores Portaria e ausência de conflitos artificiais.
6. Consolidar screenshots sanitizados, run IDs, SHAs, resultados e encerramento formal. Registros legados de destinatários incorretos permanecem em tarefa separada; **não remover automaticamente RSVP, checkins ou auditoria**.

## 4. Plano de reversão e limites

- **Antes de merge/deploy:** basta manter PR aberta; não há efeito nos usuários.
- **Falha no Worker antes de Pages:** interromper; verificar impacto de eventuais migrations que tenham rodado; reimplantar a última versão conhecida e saudável do Worker **somente por procedimento autorizado e específico para o SHA**. Não presumir que rollback do código reverta migrations ou dados.
- **Falha após Pages:** interromper novas alterações, registrar sintoma, retornar Pages e Worker aos últimos SHAs saudáveis coerentes; priorizar compatibilidade de API e não afetar D1 sem diagnóstico. Uma restauração de D1 pode perder transações legítimas posteriores — ação excepcional, mediante avaliação e autorização explícita.
- **Rollback auditável:** guardar execução anterior bem-sucedida, commit completo, hora, responsáveis, comandos/ações e testes de pós-reversão. Testar login, convocações, Portaria e relatórios após recuperar.
- **Se faltarem** evidências de cota, migrações pendentes, time travel, versão e rollback: **NO-GO**. Não há blindagem absoluta contra regressão.

## 5. Estado do gate (04/11/2026)

| Critério | Estado |
| --- | --- |
| Revisão e checks de código #469 | APROVADO no SHA indicado |
| Integração automatizada efêmera | APROVADA; não substitui runtime real |
| Segregação LGPD no diff da release | APROVADA na comparação |
| Compatibilidade runtime Cloudflare real | PENDENTE |
| D1 produção: ID/migrations pendentes/ponto de restauração | PENDENTE |
| Evidência de custo incremental e cotas | PENDENTE |
| Smoke operacional Worker/Pages no mesmo SHA | PENDENTE, só após deploy autorizado |
| Autorização específica para merge/deploy | PENDENTE |

**Resultado atual: NO-GO para produção até comprovar os itens acima.** Não modificar `main`, Beta, dados reais ou Cloudflare neste gate documental.
