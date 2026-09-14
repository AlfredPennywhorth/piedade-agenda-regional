# Plano de Execução por Sub-sprint — S13 (Acessibilidade / LGPD / Segurança)

## 1. Visão Geral
Este documento traduz o backlog da S13 em um plano técnico de execução sequencial e paralelizável, garantindo que as diretrizes de segurança, minimização de dados e acessibilidade sejam implementadas com rastreabilidade, testes e critérios de aceite definidos.

## 2. Ordem Recomendada e Paralelização

**Caminho Crítico (Sequencial):**
1. **S13.01** — Autenticação e Sessão
2. **S13.02** — Segurança HTTP e Aplicação *(Depende da decisão técnica de armazenamento de token de S13.01 para fechar CORS/CSRF)*
3. **S13.03** — Acessibilidade Estrutural
4. **S13.04** — Acessibilidade dos Fluxos Críticos *(Depende das definições estruturais de S13.03)*
5. **S13.07** — Hardening Operacional e Checklist Pré-produção *(Ocorre no final de toda a esteira)*

**Execução Paralela (Segura):**
* **S13.05** — Minimização de Dados *(Pode ocorrer em paralelo com S13.01 e S13.03, pois não afeta mecânicas de sessão ou interface estrutural)*
* **S13.06** — Itens Condicionados à Comissão LGPD *(Tarefas assíncronas aguardando comissão, implementadas pontualmente à medida que decisões chegam)*

---

## 3. Sub-sprints e Detalhamento Técnico

### S13.01 — Autenticação e Sessão [P0]
* **Objetivo:** Reforçar defesas do fluxo de login e gerenciar ciclo de vida da sessão.
* **Escopo:**
  - Inatividade (12h) e limite absoluto (30d).
  - Logout rigoroso e revogação em redefinição de PIN.
  - Anti-enumeração e roteamento unificado de erro 401.
  - Rate limiting contra Brute Force (5 falhas = 429 progressivo; 10 = 15m), baseado em Identidade + Janela Temporal (IP auxiliar), sem `sleep` ativo (usando KV/D1/Rate Limit nativo).
  - Recuperação de acesso baseada no fluxo de ativação (se seguro).
* **Arquivos Prováveis:** `auth.ts`, `login.ts`, `middleware/auth.ts`, `apiClient.ts`.
* **Testes:** Unitários de middleware, automação E2E testando bloqueio (HTTP 429) e anti-enumeração de respostas.
* **Evidência:** Retorno neutro no login; header `Retry-After`; sessão expirada após 12h simuladas; DB refletindo revogação.
* **Riscos:** Limites mal calibrados bloquearem IPs legados; complexidade na migração de localStorage para HttpOnly.
* **Rollback:** Reverter middleware de auth para a versão S12; remover tabelas/KV de rate limiting (sem dependência estrutural forte).

### S13.02 — Segurança HTTP e Aplicação [P1]
* **Objetivo:** Mitigação de vulnerabilidades sistêmicas web.
* **Escopo:** Injeção de CSP, HSTS, X-Content-Type-Options, Referrer-Policy e Frame-Ancestors. CORS fechado para produção. Sanitização estrita de erros sem vazamento.
* **Arquivos Prováveis:** `index.ts` (Backend/Hono router), `vite.config.ts`, manipulador global de erros.
* **Testes:** Scripts iterando endpoints verificando headers de segurança obrigatórios. Validação estática de console vazando dados.
* **Evidência:** Relatório do "Mozilla Observatory" ou testes curl confirmando HSTS/CSP.
* **Riscos:** CSP rigoroso quebrar recursos de frontend gerados dinamicamente (Vite inlines).
* **Rollback:** Remoção seletiva de políticas CSP/CORS; deploy sem dependência de banco.

### S13.03 — Acessibilidade Estrutural [P1]
* **Objetivo:** Preparar a base visual e de marcação semântica da aplicação.
* **Escopo:** Headings `<h1>` a `<h6>` corretos; Landmarks (`<nav>`, `<main>`); Skip links; adequação do tamanho de alvos interativos e contraste base WCAG AA; zoom de 200%.
* **Arquivos Prováveis:** `MainLayout.tsx`, tokens CSS, componentes base de tipografia/botões.
* **Testes:** Lighthouse/axe-core automatizado limitando-se ao DOM estático. Zoom nativo do navegador manual.
* **Evidência:** Score de Acessibilidade elevado no CI (ferramentas estáticas); print com 200% zoom.
* **Riscos:** Quebra de layout antigo em dispositivos móveis muito pequenos ao aumentar botões.
* **Rollback:** Reversão CSS.

### S13.04 — Acessibilidade dos Fluxos Críticos [P1]
* **Objetivo:** Garantir a autonomia completa de usuários que dependem de tecnologias assistivas.
* **Escopo:** Navegação integral por teclado; focus trap em modais (QR, confirmações); uso de `aria-live` para retornos assíncronos e formulários com erro visível via leitores de tela.
* **Arquivos Prováveis:** Telas de Relatórios, Calendário, Modais, Minha Agenda, Check-in.
* **Testes:** Teste manual rigoroso desligando mouse; VoiceOver/NVDA para ouvir os forms.
* **Evidência:** Vídeo de navegação de RSVP e leitura do check-in via leitor de tela.
* **Riscos:** Refatoração profunda de componentes open-source (ex: um componente de tabela não nativo) que não dão suporte a `aria`.
* **Rollback:** `git revert` nos fluxos críticos.

### S13.05 — Minimização de Dados [P1]
* **Objetivo:** Garantir privacidade (by design/default) omitindo celular onde não é operacionalmente essencial.
* **Escopo:** Remover celular dos Relatórios Nominais e Auditoria. O payload de API só retorna Nome, Casa, RSVP, Presença e Forma de Check-in (quando aplicável).
* **Arquivos Prováveis:** DTOs no backend, rotas `/relatorios` e `/auditoria`, interfaces Typescript no frontend.
* **Testes:** Inspeção de payload de rede (`DevTools Network`).
* **Evidência:** Print do payload JSON de `/relatorios/nominal` não contendo atributo de celular.
* **Riscos:** Componentes que esperavam o atributo falharem renderização por `undefined`. Necessita checagem de type (TypeScript estrito).
* **Rollback:** Reversão da query SQL/DTO (seguro, não afeta inserções).

### S13.06 — Itens Condicionados à LGPD [P2/P3]
* **Objetivo:** Adequar a aplicação à conformidade legal assim que diretrizes chegarem.
* **Escopo:** Expurgos automáticos, base legal (consentimento ou legítimo interesse), direitos de auto-remoção de presenças, painel de privacidade.
* **Arquivos Prováveis:** *A definir* (novas rotas, migrations de termo de aceite).
* **Riscos:** Decisões tardias bloquearem deploy de features acopladas.
* **Rollback:** Feature flags ou scripts de exclusão reversa.

### S13.07 — Hardening Operacional e Checklist Pré-Produção [P0]
* **Objetivo:** Vistoria final para go-live do S13.
* **Escopo:** Lint/Typecheck sem bypass; testes todos PASS; PII mascarado/ausente nos logs, migração pronta.
* **Arquivos Prováveis:** CI/CD YAML, configurações do Cloudflare.

---

## 4. Definition of Done (DoD) - Padrão S13
Cada Sub-sprint (`S13.0X`) só é considerada **DONE** quando:
1. O código atende a 100% dos critérios do escopo descritos acima.
2. Nenhuma quebra funcional de regressão (S00-S12 afetadas) verificada por automação.
3. Tipagem estrita (`tsc`) e regras (`eslint`) sem alertas.
4. Sem segredos, IPs, ou chaves reais injetados no código (validado via `.env` mock).
5. Cenários de homologação PO e critérios PASS verificados e executados manualmente com sucesso.
6. Aprovação final em Code Review do PMO.
7. Merge da Branch na develop apenas após todas as luzes verdes.

---

## 5. Matriz de Homologação (Cenários Práticos Manuais)

| Sub-Sprint | Cenário | Perfil | Ação do PO | Resultado Esperado (PASS) | Condição de Falha (FAIL) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **S13.01** | Bloqueio de Força Bruta | Operador | Executa 10 logins incorretos seguidos rapidamente | Recebe HTTP 429 após X tentativas; é bloqueado por 15m. | Login aceita 15+ envios diretos ou bloqueia conta pra sempre. |
| **S13.01** | Sessão 12h Inativa | Titular | Faz login, pausa DB mockando `+13h` de última atividade | Clica em atualizar a página, é ejetado pro login com aviso. | Aplicação continua consumindo a API normalmente. |
| **S13.02** | CSP Restrito | QA | Tenta injetar script via `javascript:alert()` ou Network | Navegador bloqueia execução. HSTS ativo. | Script injetado executa (XSS). |
| **S13.03** | Foco de Teclado | Qualquer | Aperta TAB seguidamente desde a Home até Check-in | Foco visual claro; botões lógicos alcançáveis. | Elementos perdem o foco ou ordem vira caótica. |
| **S13.04** | Modal ARIA (QR) | Operador | Ativa Leitor de Telas, abre modal de leitura | Foco preso dentro da modal. Sistema lê "Câmera iniciada". | Modal não anuncia, ou foco escapa para o fundo escuro. |
| **S13.05** | Relatório Minimizado | Gestor | Pede relatório nominal da reunião | Visualiza os irmãos (Nome, RSVP), mas **sem** o celular exposto. | Celular vindo no JSON de rede ou visível na tela. |
| **S13.06** | Aceite LGPD | *Aguardando* | *Aguardando* | *Aguardando Decisão Legal* | *N/A* |
