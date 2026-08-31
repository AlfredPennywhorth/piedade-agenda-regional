# API

Este diretório contém a documentação da API do projeto **Agenda Regional São Paulo**.

## Base URL

- **Produção:** `https://piedade-agenda-worker.<seu-subdominio>.workers.dev`
- **Desenvolvimento:** `http://localhost:8787`

## Rotas disponíveis (S00 — scaffolding)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | Metadados da aplicação |
| GET | `/health` | Health check |
| GET | `/api/v1` | Placeholder — aguarda S01 |

## Formato de resposta

### Sucesso
```json
{
  "data": { ... },
  "meta": { "page": 1, "total": 100 }
}
```

### Erro
```json
{
  "error": "Descrição do erro",
  "code": "CODIGO_ERRO",
  "details": {}
}
```

## Autenticação

> Aguarda implementação conforme **ADR-001** (Sprint S01+).
> Mecanismo aprovado pelo PMO: autenticação própria no Worker com sessões seguras.

## Documentos esperados

- `openapi.yaml` — Especificação OpenAPI 3.x
- `exemplos/` — Exemplos de requisição e resposta por endpoint

> **Status:** Rotas de scaffolding disponíveis. API de negócio aguarda Sprint S01.
