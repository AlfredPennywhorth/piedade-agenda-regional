# S13.01 - Autenticacao e Sessao

## Status

- S13: EM EXECUCAO.
- S13.01: HOMOLOGADA.
- S13.02: PLANEJADA / NAO INICIADA.
- S13.03 a S13.07: PLANEJADAS / NAO INICIADAS.

## Decisoes mantidas

- O token de sessao permanece no contrato Bearer existente; cookies, passkeys e mudancas de transporte permanecem fora do escopo.
- O reset continua administrativo e usa o fluxo de ativacao existente, sem SMS, e-mail ou novo fator de identidade.
- O rate limiting usa D1, sem KV, sem servico adicional e sem custo recorrente.

## Sessao

- A sessao deixa de ser valida ao atingir 12 horas desde `ultimo_acesso_em` (com `created_at` como fallback) ou 30 dias desde `created_at`, o que ocorrer primeiro.
- `expira_em` continua validado como limite persistido adicional.
- A atividade e atualizada somente apos cinco minutos desde a ultima gravacao. Isso reduz escritas e jamais prolonga a sessao alem da janela de 12 horas; no pior caso, uma sessao ativa pode expirar ate cinco minutos antes do limite.
- `POST /api/v1/auth/logout` revoga somente a sessao identificada pelo Bearer. Requisicoes posteriores com o mesmo token recebem 401.
- Uma ativacao que define novo PIN revoga, no mesmo batch atomico, todas as sessoes ativas do membro antes de criar a nova sessao.

## Rate limiting D1

Migration: `0012_s13_rate_limit_autenticacao.sql`.

A tabela `rate_limits_autenticacao` persiste `chave_hash`, `falhas_consecutivas`, `bloqueado_ate`, `expira_em`, `created_at` e `updated_at`. A chave e o SHA-256 do identificador de login ja normalizado, portanto celular/identificador nao e armazenado em claro. O estado expira em 24 horas e e removido quando encontrado expirado em uma nova tentativa.

Falhas consecutivas de 1 a 4 retornam 401 neutro. A quinta falha bloqueia por 30 segundos; a sexta por 60 segundos; a setima por 2 minutos; a oitava por 5 minutos; a nona por 10 minutos; a decima e posteriores por 15 minutos. Durante bloqueio, a resposta e 429 com `Retry-After` em segundos e o contador nao muda. Sucesso remove o estado de rate limit e zera o contador legado do membro.

Login, ativacao e respostas de credencial usam mensagens neutras. PIN, data de nascimento, token puro e identificador em claro nao sao gravados na tabela de rate limit nem em auditoria de tentativa.

## Endpoints afetados

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/ativar`
- Rotas protegidas por `authMiddleware`, incluindo `GET /api/v1/auth/me` e `GET /api/v1/auth/me/vinculos`
- `POST /api/v1/auth/logout`

## Testes e homologacao

CI #94: SUCCESS.

Os testes automatizados e a execucao real local H1-H10 foram aprovados: sessao valida, sessao inexistente ou revogada, inatividade, idade absoluta, logout isolado, reset administrativo, nova sessao apos ativacao, rate limiting progressivo, `429`, `Retry-After`, limpeza do estado apos sucesso, identificador inexistente e anti-enumeracao.

A homologacao visual manual nao e aplicavel neste momento. O frontend atual nao possui tela de login, tela de ativacao/reset de PIN, botao ou fluxo visual de logout, nem tratamento visual especifico para HTTP 429. Esses elementos devem entrar em trabalho futuro de frontend/UX e nao representam deficiencia funcional pendente do backend da S13.01.
