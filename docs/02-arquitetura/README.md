# Arquitetura

Este diretório contém a documentação de arquitetura do projeto **Agenda Regional São Paulo**.

## Stack aprovada

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS + PWA/Workbox |
| Backend | Cloudflare Workers + TypeScript + Hono |
| Banco de dados | Cloudflare D1 / SQLite + Drizzle ORM |
| Validação | Zod |
| Testes | Vitest + Playwright |
| CI/CD | GitHub + GitHub Actions |

## Estrutura do monorepo

```
piedade-agenda-regional/
├── apps/
│   ├── web/        # React PWA
│   └── worker/     # Cloudflare Worker (Hono)
├── packages/
│   └── shared/     # Tipos e schemas Zod compartilhados
└── docs/           # Documentação
```

## Princípios arquiteturais

- **Edge-first**: lógica de negócio no Cloudflare Worker (edge)
- **Custo zero**: plano gratuito Cloudflare Workers + D1
- **Separação de runtime**: código Node nunca misturado com código Worker
- **Passkeys-ready**: autenticação projetada para suportar WebAuthn no futuro (ADR-001)

## Documentos esperados

- `diagrama-componentes.md`
- `diagrama-sequencia-autenticacao.md`
- `diagrama-sequencia-convocacao.md`
- `decisoes-arquitetura.md` (ver /09-decisoes-adr)

> **Status:** Arquitetura de fundação definida na Sprint S00. Detalhes de negócio aguardam S01.
