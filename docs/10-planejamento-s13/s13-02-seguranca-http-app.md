# S13.02 - Seguranca HTTP/App

## Status

- S13: EM EXECUCAO.
- S13.01: CONCLUIDA.
- S13.02: EM HOMOLOGACAO, pendente de revisao tecnica e homologacao do PO.
- S13.03 a S13.07: PLANEJADAS / NAO INICIADAS.

## Inventario inicial

| Controle | Estado inicial                                                                  | Risco                                                           | Acao aplicada                                          |
| -------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| CORS     | `localhost:5173` e configuracao opcional; origem nao permitida recebia fallback | Politica ambigua e preflight incompleto                         | Allowlist explicita, sem reflexao de origem arbitraria |
| Headers  | Ausentes no Worker                                                              | Clickjacking, MIME sniffing e politicas de navegador sem defesa | Middleware global de headers                           |
| Erros    | Sem manipulador global                                                          | Exposicao de detalhes por excecoes nao tratadas                 | Resposta 500 sanitizada                                |
| Health   | Retornava ambiente                                                              | Exposicao de configuracao operacional                           | Mantidos apenas indicador de saude e timestamp         |
| Cache    | Sem controle especifico                                                         | Respostas sensiveis em caches intermediarios                    | `no-store` nas rotas sensiveis                         |

## Controles implementados

O Worker envia `Content-Security-Policy: default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`, `Permissions-Policy`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff` e `X-Frame-Options: DENY` em todas as respostas.

O CSP e aplicavel ao Worker porque ele expõe API JSON, nao recursos do frontend. A politica do frontend/Vite e uma decisao separada para quando a aplicacao web for servida em producao com seus dominios e recursos definidos.

Erros nao tratados retornam somente `Erro interno do servidor` e o codigo `INTERNAL_ERROR`; detalhes de stack, SQL, caminhos e segredos nao sao devolvidos ao cliente. O health nao expoe mais o ambiente nem bindings.

## CORS e ambientes

- Desenvolvimento: permite explicitamente `http://localhost:5173` e as origens adicionais configuradas em `CORS_ORIGIN`, incluindo Codespaces quando necessario.
- Producao: nao permite localhost; requer `CORS_ORIGIN` com lista explicita de origens de producao antes do deploy.
- A origem recebida somente e devolvida quando pertence a allowlist. Preflight permite `GET`, `POST`, `PATCH`, `PUT`, `DELETE` e `OPTIONS` para preservar as rotas existentes.

As origens definitivas de producao continuam como configuracao operacional pendente de deploy, nao como fallback de codigo.

## Cache

As rotas de autenticacao, membros, convocacoes, check-in, portaria, relatorios e auditoria recebem `Cache-Control: no-store` e `Pragma: no-cache`. Endpoints de infraestrutura e demais recursos publicos nao receberam `no-store` indiscriminadamente.

## Testes e homologacao

Os testes automatizados cobrem origem permitida, origem arbitraria, preflight, ambiente de producao sem allowlist, headers, cache de autenticacao, health sem ambiente e erro 500 sanitizado. A regressao de autenticacao continua coberta na suite do Worker.

Roteiro manual: confirmar que uma origem configurada conclui preflight e que uma origem nao configurada nao recebe `Access-Control-Allow-Origin`; inspecionar respostas de API autenticada para `Cache-Control: no-store`; confirmar os headers de seguranca em `/health`; e provocar uma falha controlada de ambiente de homologacao verificando que a resposta ao cliente nao expoe stack ou SQL.

## Decisoes adiadas

- Lista definitiva de dominios de producao em `CORS_ORIGIN` deve ser definida na configuracao de deploy.
- CSP do frontend, que depende de dominios e recursos efetivamente servidos, permanece para o trabalho de frontend/UX apropriado.
- Wrangler permanece em `3.114.17`; a atualizacao para 4.x nao faz parte desta sub-sprint.
