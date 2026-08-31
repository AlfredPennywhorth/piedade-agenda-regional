# Operação

Este diretório contém a documentação operacional do projeto **Agenda Regional São Paulo**.

## Infraestrutura

| Componente | Serviço | Plano | Custo |
|---|---|---|---|
| Worker | Cloudflare Workers | Free | R$ 0 |
| Banco de dados | Cloudflare D1 | Free (5 GB, 5M leituras/dia) | R$ 0 |
| Frontend (CDN) | Cloudflare Pages | Free | R$ 0 |
| CI/CD | GitHub Actions | Free (2.000 min/mês) | R$ 0 |

## Limites do plano gratuito a monitorar

| Recurso | Limite Free |
|---|---|
| Worker requests | 100.000/dia |
| Worker CPU time | 10ms/request |
| D1 leituras | 5.000.000/dia |
| D1 escritas | 100.000/dia |
| D1 armazenamento | 5 GB |

## Deploy

```bash
# Deploy do Worker
pnpm --filter @piedade/worker deploy

# Deploy do Frontend (Cloudflare Pages)
# Configurar via painel Cloudflare Pages conectado ao GitHub
```

## Variáveis de ambiente (produção)

| Variável | Configuração | Contém secret? |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | CI Secret | Não (ID público) |
| `CLOUDFLARE_API_TOKEN` | CI Secret | **SIM — jamais expor** |

## Monitoramento

- Cloudflare Workers Analytics (gratuito)
- Logs em tempo real: `wrangler tail`

> **Status:** Configuração operacional básica definida. Runbooks a criar na Sprint S01+.
