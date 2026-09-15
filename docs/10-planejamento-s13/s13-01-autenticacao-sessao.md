# S13.01 - Autenticacao e Sessao

## Status

- S13: EM EXECUCAO.
- S13.01: EM EXECUCAO, pendente de PR, revisao tecnica e homologacao do PO.
- S13.02 a S13.07: PLANEJADAS / NAO INICIADAS.

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

Os testes de autenticacao cobrem sessao valida, inexistente, revogada, inatividade, idade absoluta, logout isolado, reset administrativo e bloqueio por identificador inexistente sem persistencia em claro. A matriz manual do PO deve validar:

1. Fazer cinco logins invalidos e conferir 429 e `Retry-After` de aproximadamente 30 segundos; repetir apos cada vencimento ate a faixa de 15 minutos.
2. Durante bloqueio, enviar novamente e conferir que o tempo restante diminui sem aumentar o contador.
3. Fazer login valido apos o vencimento e confirmar que uma nova falha reinicia na primeira faixa.
4. Simular sessao com mais de 12 horas sem atividade e outra com mais de 30 dias, confirmando 401 em ambas.
5. Abrir duas sessoes, encerrar uma e confirmar que apenas seu Bearer deixa de acessar; em seguida, executar reset administrativo e confirmar que ambas sao revogadas.
