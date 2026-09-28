# Preparação da Beta — Checkpoint 2026-09-21

## Objetivo

Consolidar o estado funcional alcançado em `develop` após as frentes de Acessos, Portaria e Relatórios de Presença, definindo os critérios mínimos para a próxima homologação integrada.

## Estado atual

### Acessos e autenticação

Concluído em `develop`:
- fundação de autenticação e sessão;
- autorização técnica por perfis e escopos;
- capacidades consolidadas em `/auth/me`;
- gates de frontend para Portaria, Relatórios, Auditoria e Administração de Acessos;
- proteção Master / Administrador Regional;
- restrição institucional de escrita conforme baseline vigente.

Pendente:
- **PR #54 — ACC-05: recuperação de PIN e administração de contas**.
- A PR #54 está sincronizada com o `develop` atual, mergeável e com CI verde.
- Falta somente homologação integrada com Worker + frontend + D1 temporário antes do merge.

### Portaria e Recepção

Concluído em `develop`:
- múltiplos operadores temporários por reunião;
- capacidade de Portaria para operador temporário ativo;
- seleção somente de reuniões autorizadas;
- check-in por QR e manual;
- retificação de check-in;
- QR/link reutilizável para autocadastro de convidados;
- validação de convidados pela Portaria;
- encerramento da Portaria pela interface;
- bloqueio de novos registros após encerramento;
- snapshot final materializado;
- segundo fechamento idempotente do ponto de vista operacional, retornando `409 PORTARIA_FECHADA`;
- snapshot usado como fonte histórica dos relatórios.

Status desta frente no ciclo atual: **CONCLUÍDA**.

### Relatórios de Presença

Concluído em `develop`:
- relatório final por reunião;
- prévia operacional antes do fechamento;
- histórico de participação por membro;
- consolidação por período e escopo;
- seleção amigável de reunião e membro;
- seleção hierárquica Regional → Administração → Setor → Casa;
- seleção de Grupo de Trabalho por Regional;
- exportação CSV compatível com Excel;
- impressão / salvamento em PDF via navegador.

Status desta frente no ciclo atual: **CONCLUÍDA**.

## Critérios para Beta controlada

### GO

A Beta controlada pode ser preparada quando todos os itens abaixo estiverem atendidos:

- [x] CI de `develop` verde nas frentes já mergeadas.
- [x] Portaria concluída no escopo do ciclo.
- [x] Relatórios de Presença concluídos no escopo do ciclo.
- [x] ACC-05 sincronizada com o `develop` atual.
- [x] ACC-05 mergeável e com CI verde.
- [ ] ACC-05 homologada de forma integrada com Worker + frontend + D1 temporário.
- [ ] PR #54 mergeada em `develop`.
- [ ] Smoke test integrado pós-merge executado.
- [ ] PMO autoriza promoção de `develop` para `main`.

### NO-GO

Não promover `develop` para `main` se ocorrer qualquer uma das condições:

- falha na ativação ou recuperação de conta;
- quebra de segregação de escopo Master / Administrador Regional;
- porteiro temporário acessando reunião não autorizada;
- Portaria aceitando registro após fechamento;
- relatório histórico divergindo do snapshot final;
- CI vermelho;
- regressão em autenticação, logout ou capacidades de `/auth/me`.

## Smoke test integrado pós-#54

Após o merge da #54, validar no ambiente temporário:

1. autenticação e carregamento de `/auth/me`;
2. Master visualiza Administração de Acessos;
3. Administrador Regional visualiza somente sua Regional;
4. geração de link de ativação;
5. ativação de conta e definição de PIN;
6. reset administrativo de PIN e revogação de sessões;
7. bloqueio e desbloqueio de conta;
8. operador temporário visualiza Portaria somente quando autorizado;
9. check-in manual e por QR;
10. autocadastro e validação de convidado;
11. fechamento da Portaria;
12. consulta do relatório final da reunião;
13. consulta do histórico de membro;
14. exportação CSV e impressão/PDF.

## Promoção para main

A promoção `develop → main` deve ocorrer somente após:
- merge da #54;
- smoke test integrado aprovado;
- CI verde no HEAD final de `develop`;
- autorização expressa do PMO.

Não realizar deploy ou migração remota como consequência automática dessa promoção.

## Pendências fora deste fechamento

Permanecem como backlog posterior e **não bloqueiam o encerramento do ciclo atual**:
- S13 — acessibilidade estrutural e fluxos críticos;
- hardening HTTP adicional;
- decisões de retenção/base legal com Comissão LGPD;
- atualização controlada de Wrangler;
- refinamentos futuros de relatórios e UX;
- automações/mensageria que dependam de decisão de produto ou infraestrutura.

## Status executivo

**Portaria:** concluída.  
**Relatórios de Presença:** concluídos.  
**Acessos:** concluídos exceto homologação integrada e merge da PR #54.  
**Único blocker operacional deste ciclo:** **PR #54**.
