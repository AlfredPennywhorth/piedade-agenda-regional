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


## Runbook de produção

- [Liberação, smoke e rollback de produção](./runbook-producao.md)


## Manual de Uso — navegação M2.1–M2.8

> Capítulos documentados na `develop`. Confirmar versão publicada, permissões e telas reais antes de distribuir o manual.

| Capítulo | Assunto | Documento |
|---|---|---|
| M2.1 | Acesso e ativação | [Abrir](manual-uso-acesso-cadastro.md) |
| M2.2 | Minha Agenda e Calendário | [Abrir](manual-uso-minha-agenda-calendario.md) |
| M2.3 | Eventos, Convocações e Séries | [Abrir](manual-uso-gestao-eventos-convocacoes-series.md) |
| M2.4 | Locais e Espaços | [Abrir](manual-uso-locais-espacos-territorio.md) |
| M2.5 | GTs, Membros e Vínculos | [Abrir](manual-uso-gt-membros-funcoes-vinculos.md) |
| M2.6 | Contas e Segurança | [Abrir](manual-uso-contas-acessos-permissoes-seguranca.md) |
| M2.7 | Portaria e Presenças | [Abrir](manual-uso-portaria-recepcao-presencas.md) |
| M2.8 | Relatórios e Auditoria | [Abrir](manual-uso-relatorios-indicadores-auditoria.md) |

**Atenções editoriais:** filtros nominais de relatórios com defeito registrado na [issue #339](https://github.com/AlfredPennywhorth/piedade-agenda-regional/issues/339) (correção proposta na PR #340); relatório agregado requer UUID de escopo fornecido pela administração; capturas e exemplos devem ser anonimizados. Nenhuma publicação em `main` está implícita nesta documentação.
