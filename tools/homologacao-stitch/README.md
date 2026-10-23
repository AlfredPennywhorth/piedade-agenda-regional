# Homologação visual Stitch — Beta existente

Os **27 protótipos HTML** são copiados sem modificações para um catálogo acessível no Pages Beta, sem criar outro projeto Cloudflare.

## Publicação

O workflow existente `Deploy Pages — Beta` executa:
1. build normal do frontend;
2. `node tools/homologacao-stitch/build.mjs`;
3. deploy da pasta `apps/web/dist` no projeto Pages existente, branch `beta`.

O catálogo fica em **`https://beta.piedade-agenda-regional.pages.dev/homologacao-stitch/`** depois de CI, aprovação do merge e deploy manual no Actions. Antes disso, a URL não deve ser tratada como publicada.

**Apenas o workflow Beta** recebe a etapa adicional; o workflow de produção não é alterado. Nenhum Worker, banco D1, esquema ou endpoint novo.

## Cuidados de isolamento

- Os HTMLs vêm dos originais já versionados e têm JavaScript demonstrativo. O catálogo não integra a interface autenticada e não carrega dados da Agenda.
- O gerador emite `_headers` na raiz do build Pages. A rota `/homologacao-stitch/referencias/*` recebe CSP `sandbox allow-scripts allow-forms allow-popups`, **sem allow-same-origin**, para isolar os scripts dos protótipos dos cookies e storage da aplicação.
- `noindex`, `nosniff` e `no-referrer` reduzem exposição incidental; **não são controle de acesso**. Conteúdo demonstrativo permanece publicamente acessível após o deploy.
- Validar os links e o isolamento no Chrome. Não inserir dados reais ou credenciais nos formulários demonstrativos.
- Se algum protótipo depender de recursos externos bloqueados por CSP/ambiente, registrar a limitação; não relaxar o isolamento para recuperar funcionalidade demonstrativa.

## Homologação

Abrir a rota na Beta, clicar em cada uma das 27 referências, registrar aceite visual por código. A direção visual aprovada **não equivale** ao Gate A global nem autoriza aplicação do HTML Stitch como React. Implementação real permanece em PRs independentes na `develop`, com testes Beta e liberação explícita para produção.
