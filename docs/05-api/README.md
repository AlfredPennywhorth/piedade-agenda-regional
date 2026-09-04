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

## Rotas Séries de Recorrência (S05)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/series-recorrencia` | Lista as séries de recorrência. Filtro opcional: `?ativo=true/false` |
| GET | `/api/v1/series-recorrencia/:id` | Retorna os detalhes de uma série |
| POST | `/api/v1/series-recorrencia` | Cria uma nova série e materializa os eventos automaticamente |
| PATCH | `/api/v1/series-recorrencia/:id` | Atualiza a série e gerencia os eventos vinculados de acordo com o `updateMode` |

### Regras Essenciais da S05
- **Materialização no Banco**: A recorrência não é resolvida sob demanda; ao criar uma série, a engine gera *física e independentemente* todos os eventos na tabela `eventos` com o campo `serie_recorrencia_id` associado.
- **Data Final Obrigatória**: A série possui horizonte de materialização delimitado (usualmente 1 ano).
- **Timezone Estrito**: O fuso da série é amarrado a `America/Sao_Paulo`. A materialização dos eventos injeta na base as datas UTC perfeitamente alinhadas (ex: 09:00 BRT -> 12:00 UTC).
- **Modos de Atualização (`updateMode`)**: 
  - `THIS`: Preserva a série, edita o evento único em questão e o marca como `recorrencia_excecao = true`.
  - `THIS_AND_FUTURE`: Encerra a série A no evento escolhido e cria a série B daquele ponto em diante.
  - `ALL`: Edita as especificações da série original. Mantém os eventos do passado intocados, inativa os eventos futuros não excepcionados substituídos e materializa novas ocorrências com base nas novas especificações da série.

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

## Rotas Séries de Recorrência (S05)
(veja acima)

## Rotas de Convocações (S06)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/convocacoes` | Lista as convocações cadastradas. |
| GET | `/api/v1/convocacoes/:id` | Retorna os detalhes de uma convocação. |
| POST | `/api/v1/convocacoes` | Cria uma nova convocação com status inicial RASCUNHO. Requer `eventoId`. |
| PATCH | `/api/v1/convocacoes/:id` | Atualiza propriedades da convocação (ex: `observacoes`). Permitido apenas em RASCUNHO. |
| GET | `/api/v1/convocacoes/:id/funcoes` | Lista as funções vinculadas a esta convocação. |
| POST | `/api/v1/convocacoes/:id/funcoes` | Adiciona uma função requerida à convocação. Apenas em RASCUNHO. |
| DELETE | `/api/v1/convocacoes/:id/funcoes/:funcaoId` | Remove uma função da convocação. Apenas em RASCUNHO. |
| GET | `/api/v1/convocacoes/:id/destinatarios` | Lista os destinatários que foram materializados no snapshot desta convocação. |
| POST | `/api/v1/convocacoes/:id/publicar` | Publica a convocação e gera atomicamente o snapshot de destinatários, bloqueando novas alterações de funções. |
| POST | `/api/v1/convocacoes/:id/cancelar` | Cancela a convocação (muda para inativa e CANCELADA), preservando todo o histórico do snapshot. |

### Regras Essenciais da S06
- **Snapshot Imutável e Deduplicado**: Na publicação, a convocação deriva os membros ativos que possuem vínculos ativos para as funções selecionadas dentro do estrito escopo institucional do evento. O resultado é materializado em um snapshot (`convocacao_destinatarios`) que não será alterado caso o membro mude de casa ou perca a função no futuro.
- **Proteção Otimista (OCC) na Publicação**: O UPDATE da convocação e a inserção dos destinatários e evidências são materializados em lote. Uma mudança concorrente da *própria* convocação é detectada via OCC (`updated_at`), e em caso de conflito, o lote inteiro sofre rollback. **Risco residual assumido (S06):** alterações concorrentes efetuadas em *evento*, *funções*, *vínculos* ou *membros* exatamente entre a leitura para derivação e a execução do batch final *não* são detectadas pelo OCC da convocação. Isso fica registrado como dívida arquitetural para endurecimento futuro.
- **Deduplicação de Membro e Evidências Múltiplas**: Cada pessoa aparece estritamente uma única vez como destinatário lógico. Se ela possuir múltiplos vínculos ou funções elegíveis no escopo, todos são salvos como `evidencias` do mesmo destinatário lógico para auditoria.
- **Escopo Herdado e Rigoroso**: O escopo da convocação é exclusivamente derivado de seu evento. Não há inferência de hierarquia descendente; um evento de Setor convocará estritamente quem tiver um vínculo com a função naquele Setor, ignorando vínculos de Casas sob ele.
- **Limites de Ciclo de Vida**: Convocação PUBLICADA e CANCELADA não permite alterações em suas funções ou regras.

> **Status:** Rotas de suporte (S00) operacionais. Rotas institucionais e de vínculos (S01, S02), autenticação (S03), eventos/locais base (S04), séries de recorrência (S05) e Convocações Snapshot (S06) implementadas.
