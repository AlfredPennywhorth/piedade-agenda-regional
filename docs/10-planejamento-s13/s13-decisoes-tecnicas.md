# Dossiê de Decisões Técnicas S13 [B]

Este documento apresenta uma análise arquitetural comparativa para as decisões de categoria **[B] (Alternativas Técnicas)**, sem efetuar implementações ou comprometer o estado atual.

---

## 1. Armazenamento de Sessão/Token (Auth Storage)

### Alternativas Consideradas:
1. **LocalStorage (Atual):** O token viaja em payload JSON e o frontend o guarda no `window.localStorage`.
2. **Cookie HttpOnly (Server-set):** O backend (Hono) responde ao login com um header `Set-Cookie: session_token=...; HttpOnly; Secure; SameSite=Strict`.
3. **Memória + Refresh Token:** O Access Token (vida curtíssima, 5 min) fica em memória (variável React), e um Refresh Token (HttpOnly) é usado para renová-lo em background.

### Comparativo:
| Fator | LocalStorage | Cookie HttpOnly | Memória + Refresh Token |
| :--- | :--- | :--- | :--- |
| **XSS (Roubo de token)** | Altíssimo (Crítico) | Imune (JS não acessa) | Moderado (XSS pode usar a API, mas não extrai o Refresh) |
| **CSRF** | Imune | Requer mitigação (`SameSite=Strict` ou tokens Anti-CSRF) | Imune / Requer mitigação no endpoint de refresh |
| **CORS / API Separada** | Simples | Complexo (requer `credentials: 'include'` no Fetch e CORS estrito no Hono) | Complexo |
| **PWA / Offline** | Muito simples | Funcional se PWA rodar na mesma origem da API | Complexo (não guarda sessão ao fechar a aba) |
| **Expiração Local** | Requer código manual | O navegador apaga automaticamente | Navegador gerencia o Refresh |

*   **Riscos & Impacto:** Mudar para Cookie altera o cliente HTTP do frontend e exige configuração milimétrica no Cloudflare Workers (headers CORS). Se o backend estiver em `api.dominio.com` e o front em `app.dominio.com`, SameSite Cookie vira um problema.
*   **Recomendação Técnica:** Cookie HttpOnly com `SameSite=Lax` (se os domínios forem o mesmo TLD) ou `SameSite=None; Secure` acompanhado de header CSRF explícito.
*   **Decisão PMO/PO Pendente:** Aceitar o risco de maior esforço/complexidade (S13) no desenvolvimento de CORS e PWA em troca da mitigação definitiva de roubo por XSS.

---

## 2. Persistência do Rate Limiting (Força Bruta)

### Alternativas Consideradas:
1. **Cloudflare D1 (SQLite):** Criar uma tabela temporal `rate_limits` ou gravar logs falhos ativamente na tabela `tentativas_acesso`.
2. **Cloudflare Workers KV:** Um registro chave-valor com expiração nativa (TTL). Ex: chave `fail:ID_MEMBRO:IP`, valor `6` (erros).
3. **Cloudflare Rate Limiting (Nativo / WAF):** Regra no painel do Cloudflare para bloquear IPs que abusem da rota `/api/login`.

### Comparativo:
| Fator | CF D1 (SQLite) | CF Workers KV | WAF / Rate Limiting Nativo |
| :--- | :--- | :--- | :--- |
| **Custo / Plano Free** | Cobrado por operação de escrita (risco em DoS) | Muito barato, absorve alto volume (100k writes/dia free) | Limitado no Free Tier se houver payload inspection |
| **Consistência** | Forte (Globalmente consistente) | Eventual (pode levar até 60s para replicar pelo globo) | Imediata na Edge regional |
| **Critério (Identidade)**| Lê o body (identidade do membro) facilmente | Lê identidade antes de bater no DB pesado | Difícil limitar por "conta" no free tier, geralmente só por IP |

*   **Riscos & Impacto:** A API rate-limit nativa da CF geralmente bloqueia o IP. Como o PMO proibiu bloqueio punitivo exclusivo por IP (risco em redes WiFi compartilhadas), precisamos ler o CPF/Celular na requisição.
*   **Recomendação Técnica:** **Workers KV**. Apesar da consistência eventual (o atacante pode conseguir dar 12 ou 13 chutes em datacenters diferentes antes do mundo inteiro enxergar que ele bateu o limite de 10), o KV protege o D1 (banco principal) da sobrecarga de writes em caso de ataque volumétrico, sem custo excessivo e permite usar TTL automático para liberar a suspensão após 15 minutos sem crons.
*   **Decisão PMO/PO Pendente:** Avalizar se a consistência eventual do KV (pequena chance de vazar 2-3 tentativas a mais antes do bloqueio global) é um trade-off aceitável para baratear custos e proteger o D1.

---

## 3. Tratamento de Sessão Expirada

### Alternativas:
1. Ejeção abrupta imediata via 401 sem aviso.
2. Interceptor HTTP no Axios/Fetch que pausa as chamadas, abre modal avisando e força redirect amigável.
*   **Recomendação Técnica:** Interceptor de frontend unificado que captura HTTP 401, remove variáveis de contexto e mostra "Sua sessão expirou por segurança" antes do redirecionamento. Evita vazamento UX onde a tela fica quebrada.

---

## 4. Revogação de Todas as Sessões (Esqueci meu PIN / Alteração Crítica)

### Alternativas:
1. **Hard Delete:** O comando no banco é `DELETE FROM sessoes WHERE membro_id = X`.
2. **Soft Delete:** Comando é `UPDATE sessoes SET revogado_em = NOW() WHERE membro_id = X`.
*   **Recomendação Técnica:** **Soft Delete**. Manter o token morto gravado é crucial para auditoria caso a conta tenha sido invadida. Um CRON ou job assíncrono expurga sessões definitivamente revogadas após 6 meses.
*   **Decisão PMO/PO Pendente:** Validar a política de retenção prolongada das sessões inativas/revogadas frente à LGPD.

---

## 5. Arquitetura Compatível com WebAuthn (Passkeys)

### Contexto de Evolução Futura:
Para suportar WebAuthn na S14+, o banco precisará armazenar credenciais FIDO2 (PublicKeyCredential).
*   **Impacto no S13:** As validações anti-enumeração e os bloqueios de rate limit que desenhamos no S13 não devem assumir que a única credencial é uma "string" (PIN). As rotas de login no backend devem ser abstraídas (ex: ao invés de `validarPin(celular, pin)`, o método deve ser `verificarCredencial(membro, tipoFator, payload)`).
*   **Recomendação:** A S13 não fará tabela de credenciais FIDO2, mas a mecânica de `tentativas_acesso` e o Rate Limiting devem focar em `membro_id` genérico, e não hardcoded no PIN, preservando a arquitetura base sólida.
