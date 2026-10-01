# Auditoria de segurança — resultado

Auditoria estática do código, configurações e workflows. Não foram encontrados segredos reais versionados nem vulnerabilidades críticas de alta confiança. Foram identificados estes pontos de atenção:

## Prioridade alta

### 1. Token de sessão armazenado em `localStorage`

- **Evidência:** `apps/web/src/api/apiClient.ts:15-20,97-106`
- **Impacto:** qualquer XSS pode extrair o token e assumir a sessão.
- **Sugestão:** migrar para cookie `HttpOnly`, `Secure`, `SameSite=Strict/Lax`, com proteção CSRF. Enquanto isso, restringir CSP e revisar rigorosamente qualquer conteúdo HTML dinâmico.

### 2. Endpoint de bootstrap do primeiro Master exposto publicamente

- **Evidência:** `apps/worker/src/routes/bootstrap/master.ts:32-47`
- **Impacto:** comprometimento do `MASTER_BOOTSTRAP_SECRET` permite criar ou recuperar acesso administrativo global.
- **Sugestão:** restringir por IP/VPN ou Cloudflare Access, aplicar rate limit específico, usar janela de bootstrap única e alertas para qualquer tentativa.

## Prioridade média

### 3. CSP excessivamente permissiva para conexões

- **Evidência:** `apps/web/public/_headers:2`
- `connect-src https://*.workers.dev` permite conexão com qualquer Worker nesse domínio.
- **Sugestão:** substituir pelo domínio exato da API, evitando wildcard.

### 4. Credenciais de portaria transmitidas na URL

- **Evidência:** `apps/worker/src/routes/portaria-publica.ts:48`, `apps/worker/src/routes/portaria-operador-publica.ts:364-370`
- **Impacto:** tokens podem aparecer em histórico, logs, analytics, screenshots ou cabeçalho `Referer`.
- **Sugestão:** usar fragmento (`#token`), troca inicial por sessão curta via POST, `Referrer-Policy: no-referrer` e rotação/revogação imediata.

### 5. Cadastro público de convidados sem limitação de abuso

- **Evidência:** `apps/worker/src/routes/portaria-publica.ts:76-158`
- **Impacto:** spam, crescimento artificial do banco e inserção abusiva de dados pessoais.
- **Sugestão:** rate limit por IP e por credencial/evento, CAPTCHA ou desafio equivalente, limite diário e idempotência.

### 6. Recuperação de PIN depende apenas de `CF-Connecting-IP`

- **Evidência:** `apps/worker/src/routes/auth/recuperacao-pin.ts:12-16`
- **Impacto:** proteção insuficiente em cenários de acesso direto, proxy mal configurado ou abuso distribuído.
- **Sugestão:** combinar IP, identificador normalizado, fingerprint limitado e limites globais; garantir que a API só seja acessível via Cloudflare.

### 7. Ausência de tratamento de JSON inválido em autenticação

- **Evidência:** `apps/worker/src/routes/auth/login.ts:111-113`; `apps/worker/src/routes/auth/ativacao.ts:13-15`
- **Impacto:** requisições malformadas geram erro 500 e podem aumentar custo/ruído operacional.
- **Sugestão:** capturar erro de parsing, retornar 400 e impor limite de tamanho do corpo.

### 8. Workflows e dependências sem controles explícitos de supply chain

- **Evidência:** `.github/workflows/ci.yml:23-31`; `package.json`; `pnpm-lock.yaml`
- **Impacto:** dependência comprometida ou ação GitHub alterada pode afetar CI/CD.
- **Sugestão:** fixar Actions por SHA, habilitar Dependabot/Renovate, executar auditoria de dependências e adicionar CodeQL/secret scanning.

## Controles positivos observados

- Tokens persistidos no backend somente como hash.
- Sessões possuem expiração absoluta, inatividade e revogação.
- PIN utiliza salt, pepper e PBKDF2.
- Rate limiting progressivo no login.
- Autorização por escopo e middleware aplicado às rotas protegidas.
- Headers de segurança e `Cache-Control: no-store` para a API.
- Não foram encontrados tokens, senhas ou chaves reais nos arquivos analisados.

## Recomendação principal

Priorizar a migração do token de `localStorage`, o isolamento do bootstrap Master e o endurecimento das credenciais públicas de portaria.
