# Rascunho de Issues - Sprint S13 (Acessibilidade, LGPD e Segurança)

Este documento contém os rascunhos das issues que compõem o backlog da S13, formatados e prontos para inserção em gerenciadores de projeto (GitHub Issues/Jira).

---

## Issue 1: [S13.01.A] Auth/Sessão — Política de Expiração e Revogação
**Objetivo:** Implementar limites de validade para as sessões e revogação mecânica global.
**Contexto:** Atualmente a sessão pode não estar respeitando tempos rígidos de expiração inativa ou máxima, gerando riscos caso um celular seja furtado logado.
**Escopo:** Backend (AuthMiddleware, Banco de Sessões) e Frontend (Interceptador HTTP).
**Fora de Escopo:** Implementar Redis ou rate limiting de senha nesta issue.
**Requisitos:**
- Limite de inatividade de 12 horas.
- Validade máxima absoluta de 30 dias.
- Logout explícito deve marcar `revogado_em = NOW()`.
- Redefinição de PIN deve revogar todas as sessões anteriores daquele membro.
**Critérios de Aceite:** API retorna 401 para sessões inativas há >12h; UI exibe modal de sessão expirada.
**Testes:** Teste Unitário (validar datas); Teste API (simular token velho); Teste UX/Manual (Aguardar modal na UI após 401).
**Dependências:** Nenhuma.
**Riscos:** Deslogar massivamente a base de usuários no deploy se as datas antigas forem inválidas.
**DoD:** Código testado, PR revisado, QA manual aprovado, sem blockers.
**Labels Sugeridas:** `backend`, `security`, `s13`, `auth`
**Ordem de Execução:** 1 (Caminho Crítico)

---

## Issue 2: [S13.01.B] Auth/Sessão — Proteção contra Força Bruta (Rate Limiting)
**Objetivo:** Proteger a rota de login contra enumeração e brute-force.
**Contexto:** O sistema pode permitir tentativas contínuas de adivinhação do PIN de um membro.
**Escopo:** Backend (Rota `/api/login`), Armazenamento (Cloudflare KV ou D1).
**Fora de Escopo:** Bloqueio excludente por IP, Wait/Sleep síncrono.
**Requisitos:**
- A cada 5 falhas contínuas de PIN, retornar status 429.
- A cada 10 falhas contínuas, bloquear login por 15 minutos.
- Inserir header `Retry-After`.
- Mensagem anti-enumeração genérica (Credenciais Inválidas).
**Critérios de Aceite:** Bloqueio após 10 erros exibe mensagem clara; Rate limit respeita a identidade.
**Testes:** API script executando loop de erros; Teste temporal provando o header Retry-After; Validação paralela garantindo ausência de timing attacks.
**Dependências:** Decisão do PMO sobre D1 vs KV.
**Riscos:** Inadvertidamente bloquear acessos legítimos por redes compartilhadas (portanto focar na identidade, não apenas no IP).
**DoD:** KV/D1 implementado, 429 testado.
**Labels Sugeridas:** `backend`, `security`, `s13`
**Ordem de Execução:** 2 (Caminho Crítico)

---

## Issue 3: [S13.02] Segurança HTTP e Autenticação
**Objetivo:** Refinar o transporte do token de sessão para mitigar XSS.
**Contexto:** Token hoje mora no localStorage, altamente vulnerável se houver vazamento XSS.
**Escopo:** Hono (Configurar Cookie, CORS), Frontend (Remover localStorage, usar credentials: include).
**Fora de Escopo:** JWT Stateless (continuamos com sessão stateful).
**Requisitos:**
- Substituir gravação no localStorage por Cookie HttpOnly.
- Configurar Strict / Lax CORS e proteção CSRF associada.
**Critérios de Aceite:** O payload de login responde um Set-Cookie válido. Navegador faz requests automáticos.
**Testes:** Inspecionar document.cookie (não deve exibir token). Teste e2e do ciclo de login.
**Dependências:** Decisão final do PMO/PO aceitando o esforço da mudança para Cookie (conforme Dossier Técnico).
**Riscos:** Quebrar o PWA em aparelhos com forte restrição de cross-site cookies.
**DoD:** Teste e2e verde.
**Labels Sugeridas:** `security`, `frontend`, `backend`
**Ordem de Execução:** 3

---

## Issue 4: [S13.03] Acessibilidade Estrutural (WCAG Estático)
**Objetivo:** Assegurar que a estrutura do HTML passe em validadores estáticos e respeite regras primárias de acessibilidade visual.
**Contexto:** Componentes visuais podem carecer de contraste ou hierarquia semântica.
**Escopo:** Frontend (Componentes Shadcn/Tailwind).
**Fora de Escopo:** Refatoração visual da interface (design system).
**Requisitos:**
- Contraste de texto.
- Labels nos formulários e hierarquia H1-H6 correta.
- Tags semânticas (nav, main, article).
**Critérios de Aceite:** Ferramenta axe-core aponta 0 violações críticas no fluxo principal.
**Testes:** CI rodando validação automatizada de acessibilidade estática (avaliar opções).
**Dependências:** Nenhuma.
**Riscos:** Alteração de CSS quebrar a estética atual.
**DoD:** Sem quebras visuais e 0 logs de erro estático em a11y.
**Labels Sugeridas:** `frontend`, `a11y`, `ui`
**Ordem de Execução:** Paralelizada (a partir de 1)

---

## Issue 5: [S13.04] Acessibilidade dos Fluxos (Foco e Teclado)
**Objetivo:** Garantir a total navegabilidade por teclado e leitores de tela nos processos principais.
**Contexto:** Modais e leitor QR Code podem aprisionar o teclado (focus trap falho) ou ficarem ininteligíveis no VoiceOver.
**Escopo:** Frontend (Tabelas de Relatórios, Modais, Leitor QR).
**Fora de Escopo:** Telas administrativas antigas/legadas não tocadas na S12.
**Requisitos:**
- Modal QR Code e Check-in Manual utilizáveis apenas com TAB/Enter.
- Tabelas suportam navegação lógica via screen reader.
- UI não desmonta com zoom em 200%.
**Critérios de Aceite:** Aprovação manual via teclado + VoiceOver no fluxo GESTOR.
**Testes:** Teste Manual (Screen Reader, Teclado).
**Dependências:** S13.03 finalizada minimamente.
**Riscos:** Inserir Focus Traps muito agressivos que bloqueiem o escape do usuário via tecla ESC.
**DoD:** Teste funcional provado por vídeo/recording.
**Labels Sugeridas:** `frontend`, `a11y`
**Ordem de Execução:** Paralelizada (após a 4)

---

## Issue 6: [S13.05] Minimização de Payload (LGPD)
**Objetivo:** Retirar dados desnecessários das respostas da API de relatórios.
**Contexto:** O `GET /api/relatorios/evento/X/nominal` pode estar devolvendo a entidade `membro` completa, com número de celular, pin_hash (criptografado) etc.
**Escopo:** Backend (DTOs, Queries SQL S12).
**Fora de Escopo:** Apagar o celular do cadastro da pessoa.
**Requisitos:**
- Selecionar colunas específicas (apenas ID, Nome, Casa, Status RSVP).
- Celular ausente na listagem de presenças e auditoria geral.
**Critérios de Aceite:** Payload JSON de resposta na aba Network do browser comprovadamente limpo (DTO sanitizado).
**Testes:** Teste Unitário nos Controllers DTO. Teste API (Raw Payload Inspection).
**Dependências:** Nenhuma técnica (pode rodar agora).
**Riscos:** Frontend quebrar porque esperava uma key removida.
**DoD:** API otimizada e UI renderizando corretamente com os novos DTOs restritos.
**Labels Sugeridas:** `backend`, `lgpd`
**Ordem de Execução:** Paralelizada (a partir de 1)

---

## Issue 7: [S13.06] Itens condicionados à Comissão LGPD
**Objetivo:** Implementar adequações finais baseadas no parecer da comissão LGPD.
**Contexto:** Requisitos formais da lei de privacidade de dados.
**Escopo:** Frontend / Backend conforme definido.
**Fora de Escopo:** Não presumir consentimento, painel de exclusão, expurgo ou anonimização até a base legal estar sacramentada.
**Requisitos:** Aguardar definição de finalidade, base legal, retenção, transparência e direitos do titular.
**Critérios de Aceite:** Fluxos implementados de acordo com os requisitos jurídicos aprovados.
**Testes:** Teste de Regressão.
**Dependências:** **BLOQUEADO.** Depende de recebimento dos textos finais pela comissão LGPD do PMO.
**Riscos:** Atraso da comissão bloquear o fechamento integral da S13.
**DoD:** UI/Módulo mesclado com textos finais e testado.
**Labels Sugeridas:** `frontend`, `lgpd`, `blocked`
**Ordem de Execução:** Fim da fila (Aguardando Terceiros)

---

## Issue 8: [S13.07] Hardening e Fechamento (Regressão Final)
**Objetivo:** Garantir a coesão geral e estabilidade pós-alterações sensíveis na segurança e sessão.
**Contexto:** Todas as Issues de 1 a 6 trazem impacto global no ecossistema (autenticação).
**Escopo:** CI/CD, Testes E2E.
**Requisitos:** Validação que `S01` a `S12` continuam hígidas.
**Ordem de Execução:** Última etapa da Sprint (Issue Fechadora).
