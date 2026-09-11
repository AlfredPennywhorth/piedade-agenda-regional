# Matriz de Testes S13 — Acessibilidade, LGPD e Segurança

Esta matriz define a cobertura total esperada (automatizada e manual) para a Sprint S13.
**Status atual:** Planejado (Aguardando início da S13).

---

## 1. S13.01 — Políticas de Sessão e Rate Limiting (Auth/Sessão)

### A. Expiração e Revogação
**Requisitos Cobertos:** Sessão >12h inativa, Sessão >30 dias, Logout, Troca de PIN, Sessão Expirada (Interceptador UI).

*   **Teste Unitário:** Validar lógica isolada de cálculo de TTL (`isSessaoExpirada(criadaEm, ultimoAcessoEm)`).
*   **Teste de API:** Chamar endpoints protegidos injetando no DB sessões vencidas (>12h inatividade; >30d totais) e capturar status 401.
*   **Teste de Autorização:** Garantir que o authMiddleware rejeite tokens revogados via soft delete.
*   **Teste Negativo:** Enviar um JWT/Hash inválido, expirado ou forjado.
*   **Teste de Regressão:** Validar que `GET /api/me` e `POST /api/checkin` continuam funcionando para sessões perfeitas.
*   **Teste de Segurança:** Assegurar que o logout e a troca de PIN marcam fisicamente as sessões antigas com `revogado_em = NOW()` na base (sem vazamento).
*   **Teste Manual:** Deixar uma aba aberta por 13 horas, clicar na tela e verificar se o sistema exibe amigavelmente "Sessão Expirada" antes de redirecionar pro Login.
*   **Homologação PO:** Fazer login no celular e no PC simultaneamente. Trocar o PIN no PC e atestar que a sessão do celular cai imediatamente (revogação global).
*   **Evidência Esperada:** Log do Vitest e gravação de tela do modal de sessão expirada.

### B. Proteção contra Força Bruta (Brute Force)
**Requisitos Cobertos:** 5 falhas (HTTP 429), 10 falhas (bloqueio 15 min), Retry-After, Anti-enumeração.

*   **Teste Unitário:** Testar incrementador do `tentativas_pin` (mockado).
*   **Teste de API:** Loop de 5 logins errados no mesmo CPF retornando `429 Too Many Requests`. No 10º erro, validar bloqueio estrito e header `Retry-After`.
*   **Teste de Segurança (Anti-Enumeração):** Submeter login para CPF inexistente vs CPF existente com senha errada; ambas as respostas da API devem demorar o mesmo tempo em MS e retornar a mesma mensagem ("Credenciais Inválidas").
*   **Teste Negativo:** Tentar burlar o rate limit mudando o IP e comprovar que o bloqueio rastreia a identidade do membro alvo (celular), além da mitigação de rede.
*   **Teste de Regressão:** Login de sucesso reseta o contador de falhas para zero.
*   **Teste Manual:** Errar a senha de propósito 10 vezes na UI. Acompanhar contador visual (se existir) e a clareza da mensagem de "Conta temporariamente bloqueada por 15 minutos".
*   **Homologação PO:** Tentativa de brute-force real usando Postman, avaliando o custo KV ou D1 no dashboard da CF.
*   **Evidência Esperada:** Print do cabeçalho HTTP com `Retry-After: 900` e mensagem neutra para evitar enumeração.

---

## 2. S13.02 — Segurança HTTP e Bloqueios

**Requisitos Cobertos:** Acesso direto a rota protegida, CORS/CSRF (dependendo da decisão técnica).

*   **Teste de API:** Chamar endpoint privado sem Header `Authorization` -> 401. Chamar sem Role adequada -> 403.
*   **Teste de Segurança:** Se escolhido HttpOnly Cookie: validar ausência de leitura via `document.cookie`. E validar rejeição a CSRF (via tokens ou SameSite).
*   **Homologação PO:** Injetar XSS via devtools e tentar fazer leak da variável de sessão (se usar HttpOnly, XSS não roubará o token).

---

## 3. S13.03 e S13.04 — Acessibilidade Estrutural e de Fluxos (WCAG)

**Requisitos Cobertos:** Teclado, Foco, Leitor de tela, Zoom 200%, Contraste, Modais, Leitor QR Code acessível, Tabelas de relatório.

*   **Teste Unitário (React/RTL):** Testar presença de atributos ARIA essenciais (`aria-expanded`, `aria-hidden`, `role="dialog"`).
*   **Teste de Acessibilidade Automatizável:** Avaliar opção de executar `axe-core` ou ferramenta estática equivalente integrado à pipeline CI para varrer violações estáticas de contraste, hierarquia de tags H1-H6 e formulários sem `label` (não adicionar dependência de Cypress).
*   **Teste Manual (Foco & Teclado):** Navegar por todo o fluxo de "Check-in Manual" e "Publicar Convocação" usando APENAS a tecla `TAB`, `Espaço`, `Enter` e `Esc` (para fechar modais).
*   **Teste Manual (Visual & Zoom):** Aplicar zoom de 200% na aba do Chrome e atestar que tabelas de relatórios não quebram horizontalmente e os modais não perdem os botões "Salvar" fora da tela.
*   **Teste Manual (Leitor de Tela):** Ligar VoiceOver/NVDA e passar pelas tabelas de presença S12 e modal do QR Code.
*   **Teste de Regressão:** O modal do QR code ainda lê a câmera corretamente mesmo com os labels ARIA.
*   **Homologação PO:** Teste prático de navegação cega pelo fluxo primário (Login -> RSVP).
*   **Evidência Esperada:** Relatório zero-violações do `Axe` no CI, vídeo de tabulação por teclado sem travamentos (focus traps) nos modais.

---

## 4. S13.05 e S13.06 — Minimização e Itens condicionados à Comissão LGPD

**Requisitos Cobertos:** Celular ausente de relatórios, Exposição estrita ao necessário. Aguardando definição da comissão para finalidade, retenção, e transparência.

*   **Teste de API:** Inspecionar o payload de `GET /api/relatorios/evento/X/nominal`.
*   **Teste de Segurança (Data Leak):** Garantir que o JSON da API **NÃO POSSUI** o campo `celular` (Minimização Back-end). Não basta esconder no front-end, o dado não pode transitar na rede se for inútil ali.
*   **Teste de Negativo:** Se alguém alterar o React para forçar renderizar o celular na tabela, dará `undefined` pois a API não entrega o dado.
*   **Teste de Regressão:** O celular continua visível APENAS na tela de Perfil Pessoal (`/api/me`) e nos fluxos autorizados de notificação.
*   **Homologação PO:** Acesso logado via GESTOR_RELATORIOS. Validar a tabela da S12 sem celulares e sem campos sensíveis expostos por acaso (como `pin_hash`).
*   **Evidência Esperada:** Payload cru (Raw JSON) demonstrando a filtragem (DTO Limpo).

---

## 5. S13.07 — Hardening Final

*   **Teste de Regressão Global:** Execução end-to-end (Playwright ou Testes API) rodando todas as rotas da S01 a S12 confirmando que as novas regras de expiração e os novos labels de acessibilidade não introduziram regressões ou crashs nos fluxos de negócio.
*   **Evidência:** Status Badge de Passing no GitHub Actions.
