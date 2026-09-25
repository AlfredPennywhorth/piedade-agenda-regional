# Agenda Regional São Paulo

Sistema de gestão de reuniões e convocações regionais.

[![CI](https://github.com/SEU_ORG/piedade-agenda-regional/actions/workflows/ci.yml/badge.svg)](https://github.com/SEU_ORG/piedade-agenda-regional/actions/workflows/ci.yml)

## Ambientes e responsabilidades

Este projeto possui separação obrigatória entre ambiente de edição
e ambiente de execução.

### Antigravity — Lead Developer

Responsável por:

- edição de código;
- criação e alteração de arquivos;
- inspeção estática;
- git;
- commits;
- push de branches.

No ambiente local do Antigravity é PROIBIDO executar ou instalar:

- node
- npm
- npx
- pnpm
- tsc
- eslint
- vitest
- wrangler via Node
- qualquer dependência do ecossistema Node.js

Não instalar Node.js ou pnpm para contornar essa restrição.

Comandos permitidos localmente incluem apenas operações sem runtime
da aplicação, como:

- git status
- git diff
- git diff --check
- git log
- git branch
- git fetch
- git rebase
- git commit
- git push

### GitHub Codespaces — ambiente executável de homologação

É o ambiente autorizado para:

- pnpm install;
- testes;
- typecheck;
- lint;
- build;
- Wrangler;
- D1 local;
- aplicação de migrations;
- validações executáveis.

### GitHub Actions

Responsável pela validação automatizada em CI.

### Regra de precedência

Se qualquer seção abaixo mencionar "desenvolvimento local",
"pré-requisitos" ou comandos Node/pnpm, essas instruções se aplicam
ao Codespaces ou a ambientes explicitamente autorizados para execução.

Elas NÃO autorizam o Antigravity a instalar ou executar Node.js,
npm, npx ou pnpm localmente.

> **Sprints Consolidadas** — Fundação técnica, modelo institucional, membros, convocações, RSVP, notificações, portaria/check-in e relatórios/auditoria já estabelecidos (S00 a S12).

---

## Status das Sprints

### S12 — Relatórios e Auditoria: **CONCLUÍDA**

- Objetivo entregue: relatórios (consolidado, nominal e agregados) e auditoria com controle de acesso por escopo e função.
- PR [#16](https://github.com/AlfredPennywhorth/piedade-agenda-regional/pull/16) — **MERGED** em `develop`.
- Merge commit: `1f611b6e85f7bc02f71ac4d805aec6b1c4677027`.
- CI (Run #89 — `CI — Agenda Regional São Paulo`): **SUCCESS**.
- Cenários de homologação C1–C10 (incluindo C10-A e C10-B): **PASS**.
- Correção final encontrada durante o C10: autenticação obrigatória no router de Convocações.
- Normalização dos tipos de recurso da Auditoria.
- Fechamento com 317/317 testes passando.
- Nenhum merge realizado em `main`.

Ver detalhes em [docs/09-homologacao/s12-checkpoint-homologacao.md](./docs/09-homologacao/s12-checkpoint-homologacao.md) e [docs/09-homologacao/s12-checklist-encerramento.md](./docs/09-homologacao/s12-checklist-encerramento.md).

### Checkpoint de preparação da Beta — 2026-09-21

- Portaria e Recepção concluídas no escopo do ciclo atual.
- Relatórios de Presença concluídos no escopo do ciclo atual.
- ACC-05 sincronizada e com CI verde.
- Único blocker operacional do ciclo: homologação integrada e merge da PR #54.
- Critérios de GO/NO-GO e smoke test: [docs/09-homologacao/beta-readiness-2026-09-21.md](./docs/09-homologacao/beta-readiness-2026-09-21.md).

### Dívida técnica conhecida

- Wrangler `3.114.17` → `4.x`: atualização controlada, planejada para execução futura.

### S13 — Acessibilidade / LGPD / Segurança: **PLANEJADA / NÃO INICIADA**

Sub-sprints planejadas (ver [docs/10-planejamento-s13/s13-plano-execucao.md](./docs/10-planejamento-s13/s13-plano-execucao.md)):

- S13.01 — Autenticação e Sessão
- S13.02 — Segurança HTTP/App
- S13.03 — Acessibilidade estrutural
- S13.04 — Acessibilidade dos fluxos críticos
- S13.05 — Minimização de dados
- S13.06 — LGPD / Comissão, condicionada às decisões institucionais
- S13.07 — Hardening

---

## Pré-requisitos do ambiente executável

| Ferramenta   | Versão mínima                     |
| ------------ | --------------------------------- |
| Node.js      | 20.x                              |
| pnpm         | 9.x                               |
| Wrangler CLI | 3.x (incluído como devDependency) |

```bash
# Instalar pnpm (caso não tenha)
npm install -g pnpm@9

# Verificar versões
node --version   # >= v20.0.0
pnpm --version   # >= 9.0.0
```

---

## Setup inicial

```bash
# 1. Clonar o repositório
git clone https://github.com/SEU_ORG/piedade-agenda-regional.git
cd piedade-agenda-regional

# 2. Instalar todas as dependências (monorepo)
pnpm install

# 3. Verificar integridade
pnpm typecheck
pnpm test
```

---

## Execução em ambiente autorizado

### Frontend (React + Vite)

```bash
pnpm --filter @piedade/web dev
# ou pelo atalho raiz:
pnpm dev:web

# Acesse: http://localhost:5173
```

### Backend (Cloudflare Worker + Hono)

```bash
pnpm --filter @piedade/worker dev
# ou pelo atalho raiz:
pnpm dev:worker

# Acesse: http://localhost:8787
# Health: http://localhost:8787/health
```

### Variáveis de ambiente local

Crie o arquivo `apps/worker/.dev.vars` (não commitado):

```ini
# .dev.vars — variáveis locais do Wrangler (NÃO commitar)
# Adicione aqui apenas variáveis de desenvolvimento não-secretas
# Secrets reais: wrangler secret put <NOME>
APP_ENV=development

# Web Push (Notificações S10) - CHAVES DE DESENVOLVIMENTO
VAPID_PUBLIC_KEY=sua-chave-publica
VAPID_PRIVATE_KEY=sua-chave-privada
VAPID_SUBJECT=mailto:admin@localhost
```

No ambiente frontend (`apps/web/.env.local`), configure:

```ini
VITE_VAPID_PUBLIC_KEY=sua-chave-publica
```

> **Aviso de Segurança (Web Push):** `VAPID_PRIVATE_KEY` é segredo; nunca deve ser commitada; nunca deve ir para o frontend; apenas a chave pública pode ser exposta ao client.

---

## Comandos disponíveis

### Raiz do monorepo

```bash
pnpm install        # Instalar dependências de todos os workspaces
pnpm lint           # Lint em todos os workspaces
pnpm lint:fix       # Lint com correção automática
pnpm format         # Formatar código com Prettier
pnpm format:check   # Verificar formatação
pnpm typecheck      # TypeScript check em todos os workspaces
pnpm test           # Testes em todos os workspaces
pnpm build          # Build de todos os workspaces (ordem topológica)
```

### Por workspace

```bash
# Web
pnpm --filter @piedade/web dev
pnpm --filter @piedade/web build
pnpm --filter @piedade/web test

# Worker
pnpm --filter @piedade/worker dev
pnpm --filter @piedade/worker test
pnpm --filter @piedade/worker typecheck

# Shared
pnpm --filter @piedade/shared test
pnpm --filter @piedade/shared build
```

---

## Estrutura do projeto

```
piedade-agenda-regional/
├── apps/
│   ├── web/                    # React + Vite + Tailwind + PWA
│   │   ├── src/
│   │   │   ├── main.tsx        # Entry point React
│   │   │   ├── App.tsx         # Componente raiz
│   │   │   ├── index.css       # Tailwind + estilos globais
│   │   │   └── test/           # Testes Vitest + Testing Library
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── tailwind.config.ts
│   └── worker/                 # Cloudflare Worker + Hono
│       ├── src/
│       │   ├── index.ts        # Entry point Hono
│       │   ├── db/
│       │   │   └── schema.ts   # Schema Drizzle ORM
│       │   └── test/           # Testes Vitest
│       ├── wrangler.toml       # Configuração Cloudflare
│       └── vitest.config.ts
├── packages/
│   └── shared/                 # Tipos e schemas Zod compartilhados
│       └── src/
│           └── index.ts
├── docs/
│   ├── 00-governanca/
│   ├── 01-requisitos/
│   ├── 02-arquitetura/
│   ├── 03-modelo-dados/
│   ├── 04-seguranca-lgpd/
│   ├── 05-api/
│   ├── 06-ux/
│   ├── 07-testes/
│   ├── 08-operacao/
│   └── 09-decisoes-adr/        # ADRs (Architecture Decision Records)
├── .github/
│   └── workflows/
│       └── ci.yml              # Pipeline CI
├── eslint.config.js
├── .prettierrc
└── pnpm-workspace.yaml
```

---

## Cloudflare D1 — Setup

```bash
# 1. Login no Cloudflare
pnpm --filter @piedade/worker exec wrangler login

# 2. Criar o banco D1
pnpm --filter @piedade/worker exec wrangler d1 create piedade-agenda-db

# 3. Copiar o database_id gerado e configurar em apps/worker/wrangler.toml
#    (descomentar a seção [[d1_databases]])

# 4. Aplicar migrações localmente
pnpm --filter @piedade/worker db:migrate:local
```

> ⚠️ **Nunca commitar o `database_id` de produção diretamente no `wrangler.toml`.**
> Use variáveis de ambiente no CI/CD.

---

## Segurança — Regras obrigatórias

**Nunca inserir no Git:**

- Senhas ou tokens de qualquer natureza
- Secrets de API (Cloudflare, GitHub, etc.)
- Dados reais de membros
- CPF real
- Telefone real

Use apenas **dados sintéticos** para desenvolvimento e testes.

---

## CI/CD

O pipeline roda automaticamente em push e pull_request para `main` e `develop`:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm build`

---

## Documentação

| Pasta                                                         | Conteúdo                               |
| ------------------------------------------------------------- | -------------------------------------- |
| [/docs/00-governanca](./docs/00-governanca/README.md)         | Governança e processos                 |
| [/docs/01-requisitos](./docs/01-requisitos/README.md)         | Requisitos funcionais e não-funcionais |
| [/docs/02-arquitetura](./docs/02-arquitetura/README.md)       | Arquitetura e decisões técnicas        |
| [/docs/03-modelo-dados](./docs/03-modelo-dados/README.md)     | Schema e modelo de dados               |
| [/docs/04-seguranca-lgpd](./docs/04-seguranca-lgpd/README.md) | Segurança e conformidade LGPD          |
| [/docs/05-api](./docs/05-api/README.md)                       | Documentação da API                    |
| [/docs/06-ux](./docs/06-ux/README.md)                         | UX e design                            |
| [/docs/07-testes](./docs/07-testes/README.md)                 | Estratégia de testes                   |
| [/docs/08-operacao](./docs/08-operacao/README.md)             | Operação e deploy                      |
| [/docs/09-decisoes-adr](./docs/09-decisoes-adr/README.md)     | Architecture Decision Records          |

---

## Decisões arquiteturais registradas

| ADR                                                                      | Status             |
| ------------------------------------------------------------------------ | ------------------ |
| [ADR-001 — Autenticação](./docs/09-decisoes-adr/ADR-001-autenticacao.md) | DECIDIDO (PMO-001) |

---

## Governança

Este projeto opera sob governança do PMO. Não altere requisitos de negócio, arquitetura funcional ou escopo sem registro formal e aprovação do PMO.

Consulte [/docs/00-governanca](./docs/00-governanca/README.md) para o processo completo.
