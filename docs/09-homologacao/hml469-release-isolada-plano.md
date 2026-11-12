# Homologação isolada da release seletiva #469 — plano de execução

> **Estado: PREPARAÇÃO.** Não executar criação ou deploy sem verificar capacidade/consumo da conta Cloudflare. A autorização do PMO está condicionada a **custo incremental US$ 0**, sem upgrade ou cobrança. Não executar merge em `main`, deploy em produção, nem alterar Beta compartilhado. O material deste documento não substitui aprovação de cada gate.


## 0. Alternativa prioritária sem uso da conta Cloudflare — integração efêmera no GitHub Actions

A conta Cloudflare foi informada pelo PMO como **no limite de utilização**. Por isso, a primeira opção é a homologação automatizada no **runner temporário do GitHub Actions**, sem criar Worker, D1 ou Pages na Cloudflare e sem consumir as respectivas cotas. **Não** iniciar a topologia da seção 3 sem inventário financeiro aprovado. Desligar recursos após o uso não garante liberação das cotas de quantidade/armazenamento; após homologação em Cloudflare, planejar exclusão nominal e confirmada dos recursos exclusivamente HML, não somente inativação.

Workflow proposto: `.github/workflows/hml469-integracao-local.yml`, inicialmente disparado na própria PR draft #471. O workflow:

1. Exige o número exato da PR de planejamento (#471), sem usar tokens de deploy ou credenciais Cloudflare.
2. Faz checkout **fixado no SHA** da PR #469 (`49eedc3e40133dee9bdc4e6295a4e2acc619c2fa`); aborta se esse SHA deixar de ser o HEAD da PR #469, evitando resultados obsoletos.
3. Executa os testes de integração existentes de membros/PA, agenda, eventos e Portaria, incluindo os casos automatizados de #468, #463, #459, #465 e #467.
4. Executa testes gerais da aplicação, verificação de tipos e builds locais do Worker (Wrangler `--dry-run`) e Web. Não executa `wrangler deploy`, migrations `--remote`, nem comandos de criação de recursos.
5. Produz um resumo verificável e o SHA efetivo do código. O runner será descartado ao final; os testes existentes usam dados sintéticos e banco local em memória.

**Limites:** esse workflow demonstra integração automatizada no SHA de release, mas não representa um smoke completo no runtime da Cloudflare, não comprova CORS real nem permissões/credenciais reais, e não substitui os cenários manuais HML469-01 a 12. Para a publicação em produção permanecerá obrigatório um plano explícito de backup/reversão e smoke pós-deploy, com gates separados. O uso do GitHub Actions também consome a franquia de minutos da plataforma; se não houver saldo gratuito, interromper e informar antes de execução faturável.

## 1. Referências fixadas

- Release: [PR #469](https://github.com/AlfredPennywhorth/piedade-agenda-regional/pull/469), branch `release/selective-fixes-pa-portaria-20261104`.
- Commit de referência em 04/11/2026: `49eedc3e40133dee9bdc4e6295a4e2acc619c2fa`. **Revalidar HEAD/CI/Preflight/Codex e registrar SHA final antes de construir.**
- Não usar `develop` como fonte do build do candidato; ela contém alterações fora da release, inclusive LGPD em Beta.
- Código da PR #469: patches #468, #459, #463, #465, #467, #454, Preflight estrito e testes; sem migrations ou arquivos da LGPD na diferença da PR.

## 2. Inventário financeiro obrigatório — SOMENTE LEITURA

Antes de criar recursos, consultar Cloudflare > account **Workers & Pages / Overview / Usage**, **D1 / Databases / Usage** e a página **Billing / Subscriptions**. Confirmar e registrar:

| Campo | Obrigatório |
|---|---|
| Account ID e tipo de plano Workers (sem registrar token/segredos) | Pendente |
| Quantidade de Workers e Pages projects já existentes | Pendente |
| Quantidade de bancos D1 e armazenamento total ocupado | Pendente |
| Requests Workers e leituras/gravações D1 no dia | Pendente |
| Builds Pages realizados no mês / limite remanescente | Pendente |
| Custo adicional projetado para 1 Worker + 1 D1 + 1 Pages | **US$ 0, confirmação pendente** |
| Aprovação para avançar sem cobranças | Somente após inventário aprovado |

Fontes: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

**Se o serviço não for gratuito dentro do plano/cota disponível, PARAR** e obter nova aprovação antes de criar. As cotas Free são compartilhadas com os projetos existentes: mesmo custo financeiro zero pode consumir limites operacionais importantes. Não considerar as cotas suficientes por suposição.

## 3. Topologia — separação por nomes e credenciais

| Papel | Nome exclusivamente de HML #469 |
|---|---|
| Worker | `piedade-agenda-worker-hml469` |
| D1 | `piedade-agenda-db-hml469` |
| Pages projeto | `piedade-agenda-hml469` |
| `APP_ENV` | `beta` (somente para compatibilidade; **não** usa D1/CORS/URL Beta existentes) |
| `CORS_ORIGIN` | `https://piedade-agenda-hml469.pages.dev` |
| `VITE_API_URL` | `https://piedade-agenda-worker-hml469.<subdominio-da-conta>.workers.dev/api/v1` |
| `VITE_BUILD_SHA` | SHA do candidato da PR #469 |
| PIN_PEPPER / MASTER_BOOTSTRAP_SECRET | Valores gerados exclusivamente para HML; **não copiar de Beta nem produção** |

A URL exata `workers.dev` depende da conta; não presumir `aws311274` na configuração. Usar banco D1 **vazio + schema + fixtures sintéticas**. Não copiar snapshots dos bancos real, Beta ou produção, nem importar celulares/carteirinhas/RSVP/check-ins de membros reais. Sem disparos de WhatsApp para telefones reais; para fluxos de PIN usar dados de teste e controlar/evitar os provedores de envio.

### Atenção: workflows existentes não são seguros para esta tarefa

Os workflows `deploy-worker-beta.yml` e `deploy-pages-beta.yml` sobrescrevem **Worker Beta**, **D1 Beta** e **Pages Beta** compartilhados e **não podem ser usados** com a branch #469. Os de produção exigem `main`, e permanecem proibidos.

O novo procedimento deve usar configuração Wrangler separada, apontando exclusivamente para o ID do D1 temporário. Antes de aplicar uma migration remota, conferir a configuração/materialização e o **ID exato do recurso**. A automação de migrações no workflow Beta não pode ser reaproveitada.

## 4. Gates para publicação do candidato no ambiente isolado

1. **Gate FIN:** confirmar inventário acima, custo incremental zero e capacidade; registrar autorização do PMO no histórico da PR #469. Caso contrário, parar.
2. **Gate SHA:** confirmar PR #469 aberta, HEAD esperado, checks verdes e diff fechado sem LGPD/migrations inesperadas; salvar SHA em registro da homologação.
3. **Gate CONFIG:** revisar a configuração nova do Wrangler: nomes, `database_id`, `database_name`, `APP_ENV`, `CORS_ORIGIN`. Não aceitar `piedade-agenda-db-prod`, `piedade-agenda-db-beta`, `piedade-agenda-worker` ou `piedade-agenda-worker-beta` no alvo de operação.
4. **Gate DADOS:** criar **apenas** o D1 `piedade-agenda-db-hml469` vazio, aplicar apenas migrations disponíveis no código do candidato para o banco temporário e confirmar schema/versões; não usar D1 real. Fixtures com nomes e dados fictícios.
5. **Gate WORKER:** publicar **apenas** `piedade-agenda-worker-hml469`, com secrets exclusivos e CORS da URL hml469. Confirmar saúde e proibir acesso a qualquer banco real.
6. **Gate PAGES:** criar projeto `piedade-agenda-hml469`; build Web do **mesmo SHA**, variáveis apontadas somente para o Worker hml469. Testar que o navegador nunca chama APIs beta/produção.
7. **Gate FUNCIONAL:** homologar checklist abaixo e anexar resultados; não usar participantes reais para Portaria/RSVP.
8. **Gate LIMPEZA:** após testes e registros, despublicar/remover Worker, Pages e D1 temporários **somente por nomes e IDs confirmados**, após aprovação para exclusão. Nunca deletar recursos permanentes.
9. **Gate PRODUÇÃO (separado):** pedir autorização explícita para merge em `main`, depois Worker produção e somente depois Pages produção, com backup D1 e smokes separados. A autorização desta homologação **não** cobre produção.

## 5. Casos de homologação

| Caso | Procedimento e resultado esperado |
|---|---|
| HML469-01 — identidade | UI, API e registros do mesmo SHA; URLs somente do ambiente isolado |
| HML469-02 — novo DCO | Depois de publicar reuniões VP/BR/JP/VM fictícias, criar DCO na Casa/PA VP; Minha Agenda mostra apenas VP e eventos territoriais legítimos |
| HML469-03 — exceção intersetorial | Casa Brás → PA Bom Retiro (Setor Centro) recebe reunião correta, sem outros PAs |
| HML469-04 — RSVP negativo | Membro de um PA não consegue RSVP para reunião alheia por acesso direto |
| HML469-05 — agenda | Eventos presenciais sequenciais no mesmo local sem falso conflito; sobreposição real continua conflitando |
| HML469-06 — editar PA | PA com convocação publicada retorna 409 amigável, sem alterar dados |
| HML469-07 — Portaria identificação | Reuniões homônimas mostram código, endereço, horário e PA corretos e participantes segregados |
| HML469-08 — revogação | 401/403/410/credencial encerrada param polling; respostas concorrentes atrasadas não reabrem sessão |
| HML469-09 — falha parcial | Falha transiente em `/sessao` não impede atualizar participantes/convidados válidos |
| HML469-10 — relatório | Check-in fictício de um PA não aparece como presença em outro PA |
| HML469-11 — mobile | Tela 320/375px sem rolagem horizontal nem corte do botão; seletor sem zoom indevido |
| HML469-12 — regressão | Login/PIN sintético, Meu Cadastro, convocações e permissões fundamentais sem regressões |

## 6. Critérios de rejeição e reversibilidade

- Qualquer URL/ID de Worker, Pages ou D1 permanentes presente no target da implantação: **abortar antes de executar**.
- Cobrança prevista, upgrade solicitado ou cota Free insuficiente: **abortar e solicitar novo aceite**.
- Falha de CI, Preflight, credencial, CORS, segregação de D1 ou casos funcionais essenciais: **NO-GO**; manter release PR #469 aberta sem merge.
- Reversão em homologação: remover apenas recursos hml469 após registro das evidências e conferência nominal dos IDs. Não executar comandos de limpeza genéricos.
- LGPD #452 segue bloqueada em Beta e **não** deve ser promovida a produção.

## 7. Comprovantes esperados

Registrar plano/cotas confirmados (sem tokens), SHA imutável, nomes/IDs dos recursos temporários, screenshots sanitizados, resultados HML469-01 a 12, checklist de limpeza e autorização PMO por gate. Não anexar dados pessoais reais, tokens de acesso ou URLs temporárias com segredos.
