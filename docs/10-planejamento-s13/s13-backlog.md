# Preparação do Backlog Executável — S13 (Acessibilidade / LGPD / Segurança)

## 1. Categorização de Itens (Classificação Revisada)

A S13 está dividida em blocos priorizados (P0 a P3). Cada item dentro dos blocos possui uma natureza que guia a sua execução:

*   **[A] Requisito Aprovado:** Pode ser implementado sem necessidade de nova decisão de negócio.
*   **[B] Alternativa Técnica:** Solução de engenharia a ser avaliada durante a sprint antes da decisão final.
*   **[C] Decisão PMO/PO:** Depende de definição de produto/operação.
*   **[D] Decisão Comissão LGPD:** Depende de validação jurídica ou de conformidade.

### Prioridades

*   **P0:** Obrigatório antes de produção.
*   **P1:** Obrigatório na S13.
*   **P2:** Importante, mas pode virar débito controlado.
*   **P3:** Futuro.

---

## 2. Blocos de Trabalho Sugeridos (Backlog)

### S13.01 — Hardening de Autenticação e Sessão [P0]
*   **Política de Sessão (Baseline):** Expiração por inatividade em 12 horas. Validade máxima absoluta de 30 dias (exigindo novo login mesmo com uso recente). Logout explícito revoga a sessão atual de forma definitiva no backend. Troca de PIN revoga todas as sessões anteriores do membro. **[A]**
*   **Dispositivo Compartilhado:** Garantir visibilidade do botão de logout, efetivação da invalidação e controle de cache/histórico (botão voltar) para não vazar dados após logout. **[A]**
*   **Armazenamento de Token:** O armazenamento do token em localStorage aumenta o impacto de uma XSS. A S13 deverá avaliar o risco e as alternativas (ex: Cookie HttpOnly), considerando CORS, CSRF, PWA e complexidade técnica. **[B]**
*   **Proteção contra Força Bruta (Brute Force):** Aplicar atraso progressivo após 5 falhas consecutivas; após 10 falhas curtas, suspender por 15 minutos (baseline ajustável). PIN não pode ser armazenado em claro ou escrito em log. O mecanismo não usará `sleep` ativo (limitação do Cloudflare); deve usar estado de segurança devolvendo imediatamente HTTP 429 com `Retry-After`. A política prioriza a **identidade alvo** e o **histórico temporal**, usando IP/Origem apenas como sinal auxiliar, para evitar o bloqueio de redes compartilhadas. **[A]**
    *   *Alternativa Técnica:* Tecnologia de rate limit/persistência de estado (ex: Cloudflare D1, Workers KV ou Rate Limiting nativo). Deve priorizar consistência, baixo custo (compatibilidade com plano zero), resistência a abusos e simplicidade operacional. **[B]**
*   **Proteção contra Enumeração:** Respostas externas obrigatoriamente neutras nos fluxos de ativação, login e recuperação. Não revelar desnecessariamente se celular, conta ou PIN exato existem ou estão corretos individualmente. **[A]**
*   **Recuperação de Acesso:** Manter o fluxo de solicitação por celular com resposta neutra e tratamento administrativo de redefinição de PIN. A recuperação não utiliza data de nascimento. Etapas obrigatórias: redefinir o PIN somente por fluxo autorizado, revogar sessões antigas e registrar auditoria sem o PIN. Qualquer novo fator adicional (SMS, e-mail, documento civil ou outro dado) depende de decisão expressa do PMO antes de implementação. **[A]**
*   **WebAuthn / Passkeys:** A S13 não requer implementação imediata, mas o desenho do hardening não deve bloquear ou dificultar a adoção futura desta arquitetura. **[B]**

### S13.02 — Segurança HTTP e Aplicação [P1]
*   **Headers de Segurança:** CSP, HSTS, X-Content-Type-Options, Referrer-Policy, proteção contra framing (frame-ancestors). **[A]**
*   **CORS:** Configuração restrita baseada na arquitetura de produção. **[A]**
*   **Ausência de Segredos/Vazamento Interno:** Garantir tratamento de erros sem vazamento de stack traces e dados sensíveis em logs de frontend/backend. **[A]**
*   **Acesso e Segregação:** Validação contínua do acesso direto a rotas protegidas e correta segregação de funções. **[A]**

### S13.03 — Acessibilidade Estrutural [P1]
*   **Semântica e Organização:** Títulos/headings corretos, landmarks ARIA e skip links. **[A]**
*   **Tamanhos e Contraste:** Contraste adequado e alvos interativos suficientemente grandes e espaçados, com critério de conformidade a ser definido segundo o padrão de acessibilidade adotado pelo projeto. **[A]**
*   **Responsividade:** Permitir zoom até 200% sem perda de funcionalidade. **[A]**

### S13.04 — Acessibilidade dos Fluxos Críticos [P1]
*   **Teclado e Foco:** Navegação 100% por teclado, ordem de foco lógica, foco sempre visível, estados de componente visíveis (selecionado/expandido). **[A]**
*   **Leitores de Tela:** Suporte a leitor de tela, labels associados, ícones com nome acessível, e mensagens de erro acessíveis (aria-live quando necessário). **[A]**
*   **Modais:** Focus trap em modais e retorno de foco para a origem. **[A]**
*   **Módulos Específicos:** Acessibilidade garantida nas Tabelas, Formulários, QR/check-in, Relatórios, Auditoria, Minha Agenda, Calendário, Avisos e Meu Cadastro. **[A]**

### S13.05 — LGPD: Minimização e Relatórios [P1]
*   **Decisão Aprovada do PMO (Relatórios):** O celular **NÃO** deve ser exibido por padrão em relatórios nominais, auditoria ou outras superfícies não essenciais. Para relatórios nominais de presença, manter preferencialmente: Nome, Casa, RSVP, Presença, e Forma de check-in. O celular permanece apenas como dado cadastral e operacional para identificação, autenticação e comunicações autorizadas. **[A]**
*   **Inventário Base:** Verificar no código atual todos os lugares em que celular e demais dados são retornados desnecessariamente, ajustando-os conforme a nova decisão aprovada. **[A]**

### S13.06 — LGPD: Transparência, Base Legal e Retenção [P2]
*   **Diretriz Jurídica:** Definir, com a Comissão LGPD, finalidade, base legal, transparência, retenção e direitos aplicáveis a cada categoria de dado. O consentimento só será implementado onde for efetivamente a base legal definida. **[D]**
*   **Registros de Presença:** Preparar tecnicamente opções para anonimização, exclusão de histórico e retenção de presenças/RSVP, aguardando a decisão jurídica de base legal (Consentimento vs Obrigação Legal vs Legítimo Interesse). **[B]** (técnica) / **[D]** (decisão jurídica)

### S13.07 — Checklist Pré-produção (Auditoria Operacional) [P0]
*   **Revisão Final:** Checklist cobrindo a ausência de features de debug e verificação de maturidade dos componentes de S13.01 a S13.06 antes do deploy. **[A]**

---

## 3. Matriz Técnica Inicial - LGPD (Para Análise da Comissão)

| Dado Pessoal | Onde é armazenado | Onde é exibido | Finalidade Técnica Aparente | Quem Acessa | Necessidade de Minimização | Retenção / Base Legal |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Nome | `membros` | Interfaces, Relatórios, Auditoria | Identificação do usuário | Autenticados, Gestores, Operadores, Auditores | Baixa | A validar (Comissão LGPD) |
| Celular | `membros` | Acesso Operacional | Ativação/Contato | Sistema, Fluxos de Comunicação | Alta (Ocultar por padrão via decisão PMO) | A validar (Comissão LGPD) |
| Casa (Escopo) | `membros` | Relatórios, Admin | Segregação institucional | Auditores, Gestores, Operadores | Baixa | A validar (Comissão LGPD) |
| Funções/Vínculos | `vinculos_funcionais` | Backend (Auth/ACL) | Autorização | Usuário logado, Auditores | Baixa | A validar (Comissão LGPD) |
| Presença / RSVP | `checkins`, `rsvp` | Relatórios, Agenda | Gestão do Evento | Gestores, Operadores, Titular | Média | A validar (Comissão LGPD) |
| Justificativa | *A definir* | Relatórios | Ausência | Gestores, Titular | Alta | A validar (Comissão LGPD) |
| Logs Auditoria | `auditoria_logs` | Tela Auditoria | Segurança/Transparência | Auditores Regionais/Adm | Média | A validar (Comissão LGPD) |
| Dados de Sessão | `sessoes` | Backend | Controle de acesso | Não exibido ao cliente | N/A | A validar (Comissão LGPD) |

---

## 4. Estratégia de Testes S13 (Não iniciar ainda)

1.  **Testes Unitários:** Validação de lógicas de acessibilidade (foco) ou middlewares de segurança.
2.  **Testes de API:** Automação validando que as respostas de login (sucesso ou falha) retornem a mesma estrutura (anti-enumeração) e confirmem comportamentos de rate limit.
3.  **Testes de Autorização:** Confirmação de segregação contínua das rotas de admin vs operacionais.
4.  **Testes de Acessibilidade Automatizados:** Ferramentas de lint e testes estáticos para labels, landmarks e contraste (quando aplicável).
5.  **Testes Manuais:** Navegação puramente por teclado; uso de leitores de tela em fluxos como RSVP e Portaria; validação de modais.
6.  **Homologação PO:** Revisão de layout acessível, aprovação de timeouts e regras de negócio de segurança aplicadas.
7.  **Playwright/axe:** Avaliar potencial de uso futuro de e2e com suítes estruturais de a11y.
