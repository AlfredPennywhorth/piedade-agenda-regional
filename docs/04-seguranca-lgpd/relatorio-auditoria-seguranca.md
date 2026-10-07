# Auditoria de segurança — resultado atualizado

Auditoria estática refeita sobre a branch `develop` após o MVP e as correções pós-MVP. O objetivo foi validar novamente os achados anteriores e separar vulnerabilidades confirmadas, riscos residuais e recomendações de hardening.

## Resumo executivo

Não foram identificadas vulnerabilidades críticas de alta confiança nem segredos reais versionados nos arquivos revisados. O projeto possui controles positivos relevantes de autenticação, autorização, auditoria, rate limiting e gates de deploy.

Os principais riscos residuais confirmados são:

1. token de sessão mantido em `localStorage`;
2. tokens temporários de portaria/cadastro presentes em URL;
3. autocadastro público de convidados sem rate limiting próprio;
4. CSP de `connect-src` ainda ampla para `*.workers.dev`;
5. endpoints de login/ativação ainda dependem de parsing JSON sem tratamento local de erro;
6. workflows usam Actions por tag major (`@v4`) e não por SHA imutável.

O bootstrap do primeiro Master e a recuperação de PIN foram significativamente endurecidos desde a auditoria anterior.

## Prioridade alta

### 1. Token de sessão armazenado em localStorage

- **Status:** confirmado.
- **Evidência atual:** `apps/web/src/api/apiClient.ts` lê e grava `session_token` em `localStorage` e envia o valor em `Authorization: Bearer`.
- **Impacto:** qualquer XSS executado no mesmo origin pode ler o token e assumir a sessão até expiração/revogação.
- **Controles existentes:** CSP restritiva para scripts externos, tokens persistidos no backend apenas como hash, expiração e revogação de sessões.
- **Recomendação:** avaliar migração futura para cookie `HttpOnly`, `Secure`, `SameSite` com estratégia CSRF adequada. Enquanto isso, manter CSP estrita e evitar qualquer inserção dinâmica de HTML não confiável.

## Prioridade média

### 2. Tokens temporários de Portaria e cadastro permanecem na URL

- **Status:** confirmado.
- **Evidência atual:** `apps/web/src/App.tsx` aceita token de operador em `/o/:token` ou query `op`, e token de cadastro em query `p`/`portaria`; `CadastroConvidadoView` usa o token também no caminho da API.
- **Impacto:** exposição possível em histórico do navegador, screenshots, cópia acidental de links e logs de infraestrutura.
- **Controles existentes:** tokens armazenados no banco como hash, expiração, revogação, validação de evento/portaria e uso de Bearer nas chamadas do operador após a abertura.
- **Recomendação:** no médio prazo, trocar o token de URL por uma sessão temporária curta após primeira validação e limpar a URL imediatamente; considerar `Referrer-Policy: no-referrer` para fluxos públicos.

### 3. Autocadastro público de convidados sem rate limit dedicado

- **Status:** confirmado.
- **Evidência atual:** `apps/worker/src/routes/portaria-publica.ts` valida credencial, campos e estado da Portaria, mas não aplica throttle por IP/token/evento antes de inserir convidados.
- **Impacto:** uma credencial válida pode ser usada para spam e crescimento artificial da tabela durante a janela de validade.
- **Controles existentes:** token com expiração/revogação, validação de tamanho dos campos e necessidade de validação posterior pelo porteiro.
- **Recomendação:** aplicar rate limit por combinação de IP + credencial/evento, com limite por janela e idempotência onde aplicável.

### 4. CSP permite conexão com qualquer subdomínio workers.dev

- **Status:** confirmado.
- **Evidência atual:** `apps/web/public/_headers` contém `connect-src 'self' https://*.workers.dev https://viacep.com.br`.
- **Impacto:** em caso de XSS ou abuso de código já permitido no origin, amplia a superfície de exfiltração por `fetch` para Workers arbitrários.
- **Recomendação:** substituir o wildcard pelos hosts exatos de Beta/Produção usados pelo projeto, mantendo apenas integrações necessárias.

### 5. Parsing JSON de login e ativação sem tratamento local

- **Status:** confirmado como robustez/hardening; impacto depende do handler global do Hono.
- **Evidência atual:** `apps/worker/src/routes/auth/login.ts` e `apps/worker/src/routes/auth/ativacao.ts` chamam `await c.req.json()` diretamente. Em contraste, bootstrap, recuperação de PIN e portaria pública já tratam parsing inválido.
- **Impacto:** payload JSON malformado pode cair no tratamento global e produzir 500/ruído operacional em vez de 400 controlado.
- **Recomendação:** envolver o parsing em `try/catch` e retornar 400 genérico; considerar limite explícito de tamanho do corpo para endpoints públicos.

### 6. Supply chain: Actions não fixadas por SHA

- **Status:** recomendação de hardening.
- **Evidência atual:** workflows usam `actions/checkout@v4`, `actions/setup-node@v4` e `pnpm/action-setup@v4`.
- **Impacto:** tags major são mutáveis e aumentam risco de cadeia de suprimentos comparadas a SHAs imutáveis.
- **Controles existentes:** lockfile congelado, CI com lint/typecheck/test/build, deploy manual, preflight compartilhado e ambientes GitHub.
- **Recomendação:** pin das Actions por SHA e processo periódico de atualização controlada; manter Dependabot/alertas de dependências quando disponíveis.

## Prioridade baixa / hardening

### 7. Bootstrap Master continua exposto como endpoint público protegido por segredo

- **Status:** risco residual, fortemente mitigado.
- **Evidência atual:** `apps/worker/src/routes/bootstrap/master.ts` exige `MASTER_BOOTSTRAP_SECRET` com no mínimo 32 caracteres, comparação de hash, confirmação literal, identidade elegível, bloqueia bootstrap repetido e registra auditoria.
- **Evolução desde a auditoria anterior:** o fluxo agora é explicitamente one-shot e auditado, com recuperação limitada ao primeiro Master ainda pendente.
- **Recomendação:** se operacionalmente viável, manter o segredo fora de rotinas comuns, rotacioná-lo após uso e considerar Cloudflare Access/restrição adicional para reduzir ainda mais a exposição.

## Achados anteriores resolvidos ou reduzidos

### Recuperação de PIN

O achado anterior de proteção insuficiente foi reduzido de forma material:

- `apps/worker/src/routes/auth/recuperacao-pin.ts` aplica throttle persistido por `CF-Connecting-IP`;
- usa janela de 15 minutos e retorna `429` com `Retry-After`;
- respostas para celular inexistente/inválido são indistinguíveis, reduzindo enumeração;
- a solicitação é auditada para contas elegíveis.

Risco residual: abuso distribuído continua possível, mas não há evidência atual de falha direta de autorização.

### Bootstrap do primeiro Master

O risco anterior foi reduzido:

- segredo mínimo de 32 caracteres;
- comparação sem string direta;
- confirmação explícita `CRIAR PRIMEIRO MASTER`;
- bloqueio após bootstrap concluído;
- link de ativação com hash, expiração e revogação;
- eventos de auditoria para criação e regeneração do link.

### Preflight e deploy

Foi adicionada a camada `Preflight — Merge e Deploy`:

- valida base/SHA e impacto em Worker/Pages/migrations;
- falha fechado se não consegue calcular o diff;
- bloqueia issues P0;
- checa declarações críticas dos workflows;
- mantém deploy manual e separação Worker → Pages em produção.

## Controles positivos observados

- Tokens sensíveis persistidos no backend como hash.
- Sessões com expiração, revogação e rastreio de último acesso.
- PIN com salt, pepper e derivação de hash.
- Rate limiting progressivo no login.
- Recuperação de PIN com throttle e resposta anti-enumeração.
- Autorizações por capability/escopo e testes específicos de segurança.
- Bootstrap Master one-shot, auditado e protegido por segredo forte.
- Credenciais temporárias de Portaria com expiração/revogação.
- Headers de segurança, HSTS, X-Frame-Options e CSP.
- CI executa lint, typecheck, testes e build.
- Deploy de produção exige confirmações explícitas e mesmo SHA entre Worker e Pages.
- Preflight compartilhado para gates operacionais.

## Ações priorizadas

1. Planejar migração do token de sessão para cookie HttpOnly ou registrar formalmente a aceitação temporária do risco de `localStorage`.
2. Implementar rate limit no autocadastro público de convidados.
3. Reduzir `connect-src` aos hosts exatos da API.
4. Tratar JSON inválido em login/ativação com 400 controlado.
5. Evoluir tokens de Portaria em URL para troca por sessão temporária e limpeza imediata da URL.
6. Fixar GitHub Actions por SHA.

## Riscos residuais

- XSS continua sendo o maior risco sistêmico enquanto o token de sessão estiver acessível ao JavaScript.
- Links públicos/temporários continuam sendo credenciais bearer enquanto estiverem válidos.
- Rate limits baseados em IP não eliminam abuso distribuído.
- Esta auditoria é estática; não substitui teste dinâmico, pentest ou revisão de configuração efetiva do Cloudflare/GitHub.

## Conclusão

O projeto está em condição operacional compatível com produção para o estágio atual, sem bloqueador crítico identificado nesta revisão estática. Os riscos acima devem permanecer no backlog de segurança, com prioridade especial para sessão em `localStorage`, abuso de endpoints públicos e redução da exposição de tokens em URL.
