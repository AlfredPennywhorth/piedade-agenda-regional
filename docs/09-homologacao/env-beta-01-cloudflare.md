# ENV-BETA-01 — Ambiente de homologação Cloudflare

## Objetivo

Disponibilizar o Agenda Regional São Paulo para testes visuais e funcionais pelo navegador, sem depender de Node.js instalado na máquina do usuário e sem usar a cota do GitHub Codespaces.

O ambiente Beta deve ser independente de produção:

- Frontend Beta: Cloudflare Pages preview;
- API Beta: Cloudflare Worker em `env.beta`;
- Banco Beta: D1 exclusivo `piedade-agenda-db-beta`;
- segredos Beta separados dos segredos de produção.

Nenhum recurso de produção deve ser reutilizado para dados de homologação.

## Endereços

Frontend estável de homologação:

`https://beta.piedade-agenda-regional.pages.dev`

O Cloudflare Pages mantém um alias por branch para o último preview publicado.

API Beta:

a URL `workers.dev` obtida após o primeiro deploy do Worker `piedade-agenda-worker-beta`, acrescida de `/api/v1`.

Essa URL deve ser salva no GitHub Environment `beta` como variável:

`BETA_API_URL=https://<worker-beta>.<subdominio>.workers.dev/api/v1`

## Configuração necessária uma única vez

### Cloudflare

Criar um banco D1 separado:

`piedade-agenda-db-beta`

Não reutilizar `piedade-agenda-db-prod`.

Registrar o ID do novo banco no GitHub Environment `beta`:

Secret:
- `CLOUDFLARE_D1_BETA_DATABASE_ID`

### GitHub Environment `beta`

Variáveis:
- `CLOUDFLARE_ACCOUNT_ID`
- `BETA_API_URL` (preencher depois do primeiro deploy do Worker Beta)

Secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_D1_BETA_DATABASE_ID`
- `PIN_PEPPER_BETA`
- `MASTER_BOOTSTRAP_SECRET_BETA`

Os valores Beta não devem copiar segredos de produção.

## Primeiro bootstrap

### 1. Criar o D1 Beta

Criar `piedade-agenda-db-beta` no painel Cloudflare e registrar seu ID no secret correspondente.

### 2. Deploy inicial do Worker Beta

Executar manualmente:

`Deploy Worker — Beta`

Na primeira execução, marcar:

`apply_migrations = true`

Isso aplica as migrations somente em `piedade-agenda-db-beta` e publica:

`piedade-agenda-worker-beta`

O workflow também configura:
- `PIN_PEPPER`;
- `MASTER_BOOTSTRAP_SECRET`;

somente no ambiente Beta.

### 3. Registrar a URL da API

Depois do primeiro deploy, copiar a URL HTTPS do Worker Beta e configurar:

`BETA_API_URL=https://<url-worker-beta>/api/v1`

### 4. Publicar o frontend Beta

Executar manualmente:

`Deploy Pages — Beta`

O build recebe `VITE_API_URL=BETA_API_URL` e é publicado na branch Pages `beta`.

Endereço esperado:

`https://beta.piedade-agenda-regional.pages.dev`

## Uso diário

Após o bootstrap, o ambiente pode ser atualizado sem Node.js local:

1. alterações são mergeadas em `develop`;
2. CI deve estar verde;
3. executar `Deploy Worker — Beta` quando houver mudança de backend;
4. marcar migrations somente se houver migration nova;
5. executar `Deploy Pages — Beta` quando houver mudança de frontend ou URL/API;
6. abrir o endereço Beta em qualquer navegador autorizado.

## Testes possíveis pelo navegador da empresa

Com Worker, Pages e D1 Beta disponíveis, é possível homologar:

- layout e responsividade;
- login e logout;
- ativação de conta;
- PIN e recuperação;
- bloqueio/desbloqueio;
- cadastro/finalização de membro;
- gestão institucional;
- criação e edição de eventos;
- séries recorrentes;
- convocações;
- RSVP;
- Portaria;
- convidados;
- relatórios;
- auditoria;
- instalação PWA;
- service worker;
- notificações Push quando configuradas.

## Dados

O D1 Beta deve usar somente:

- dados sintéticos; ou
- carga controlada explicitamente autorizada para homologação.

A base real de produção não deve ser conectada ao Worker Beta.

## CORS

O Worker Beta aceita o frontend:

`https://beta.piedade-agenda-regional.pages.dev`

`localhost:5173` fica permitido apenas no ambiente `development`.

## Segurança operacional

Os workflows Beta são exclusivamente `workflow_dispatch`.

Portanto:
- commits e merges não publicam Beta automaticamente;
- nenhuma migration remota ocorre automaticamente;
- cada deploy é uma ação explícita;
- produção permanece separada.

## Próxima evolução possível

Quando o Beta estiver estável, podemos automatizar o deploy de Pages em cada merge de `develop`, mantendo migrations e deploy de Worker sob controle manual.
