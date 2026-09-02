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

## Rotas Locais e Eventos (S04)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/locais` | Lista os locais |
| GET | `/api/v1/locais/:id` | Retorna os detalhes de um local |
| POST | `/api/v1/locais` | Cria um novo local |
| PATCH | `/api/v1/locais/:id` | Atualiza um local existente |
| GET | `/api/v1/eventos` | Lista os eventos. Filtros: `?ativo=true/false` e `?modalidade=...` |
| GET | `/api/v1/eventos/:id` | Retorna os detalhes de um evento |
| POST | `/api/v1/eventos` | Cria um novo evento |
| PATCH | `/api/v1/eventos/:id` | Atualiza um evento existente validando o estado final |

### Regras Essenciais da S04
- **Modalidade e Dependências**: `ONLINE` exige URL (não aceita local); `PRESENCIAL` exige local; `HIBRIDO` exige ambos.
- **Protocolos de URL**: `urlOnline`, `urlMaps` e `urlWaze` aceitam estritamente `http://` ou `https://`.
- **Validação de Data**: O campo `fimEm` deve ser posterior ao `inicioEm`. O evento inteiro (início e fim) deve estar compreendido no mesmo dia, considerando o fuso `America/Sao_Paulo`. As datas são persistidas e retornadas em ISO 8601 / UTC.
- **Escopo Institucional**: Cada evento exige e aceita **exatamente um** escopo institucional (`regionalId`, `administracaoId`, `setorId`, `casaId` ou `grupoTrabalhoId`).

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

## Limites de Evolução (Planejamento Futuro)

- **S05** — recorrência
- **S06** — convocação
- **S07** — agenda/PWA
- **S08** — RSVP
- **S09** — períodos/alimentação
- **S10** — notificações
- **S11** — check-in

> **Status:** Rotas de suporte (S00) operacionais. Rotas institucionais e de vínculos (S01, S02), autenticação (S03) e eventos/locais base (S04) implementadas.
