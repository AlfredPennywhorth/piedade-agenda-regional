# Gate A1 / #414 — Auditoria somente-leitura de destinatários legados por Ponto

**Data:** 06/11/2026. **Ambiente de análise inicial:** Beta. **Natureza:** roteiro e SQL `SELECT` apenas. **Proibido executar escrita ou saneamento automático.**

## Contexto e evidência existente

A PR #468 corrigiu a inclusão de **novos** Diáconos em convocações de outros Pontos e o PMO aprovou o caso 414-03R no Beta. A sincronização DCO de `apps/worker/src/routes/convocacoes.ts` é **aditiva/idempotente**: não remove destinatários históricos. A consulta de Minha Agenda em `apps/worker/src/routes/agenda.ts` lê diretamente `convocacao_destinatarios` de convocações PUBLICADAS, sem recalcular elegibilidade geográfica a cada consulta. Consequentemente, destinatários gerados antes da correção podem continuar vendo reuniões do outro PA. A existência do registro de convocação **não significa** RSVP ou check-in, e não autoriza exclusão.

**Atenção temporal:** o PA atual da Casa não demonstra, sozinho, a elegibilidade **na data da publicação**. Uma transferência legítima posterior, uma exceção intersetorial autorizada (#418) ou mudanças de cadastro podem gerar falso positivo. Tratar o resultado como **suspeita a investigar**, nunca prova conclusiva de destinatário indevido.

## Premissas de segurança

- Executar **somente consulta SQL** por operador autorizado, preferencialmente em Beta, em ferramenta de consultas D1. Não colar nomes, celulares, carteirinhas, justificativas RSVP nem IDs de membros/destinatários em issues, logs ou mensagens.
- Não usar `DELETE`, `UPDATE`, `INSERT`, `REPLACE`, `DROP`, `ALTER`, `PRAGMA writable_schema`, nem endpoints que sincronizam ou republicam convocações.
- Não copiar banco de produção ou relatórios nominais para repositório, CI ou ambiente local. Qualquer leitura de D1 produção exige autorização específica do PMO e princípio de mínimo privilégio.
- Antes de eventual correção futura, documentar **backup/restauração, janela operacional, autorização, reversibilidade e preservação de check-in, RSVPs, auditoria, portaria e PDFs de ata**.

## Consulta A — triagem por reunião, sem PII

SQL validado quanto à sintaxe com tabelas sintéticas SQLite; **não executado contra D1 Beta/Produção**. Retorna somente IDs técnicos do **evento/PA** e contagens. Agrupa eventos com pelo menos um destinatário cuja Casa atualmente não está no PA do evento.

```sql
WITH base AS (
  SELECT
    e.id AS evento_id,
    e.inicio_em AS inicio_em,
    e.ponto_atendimento_id AS ponto_evento_id,
    cd.id AS destinatario_id,
    ca.ponto_atendimento_id AS ponto_casa_atual_id,
    CASE WHEN ca.ponto_atendimento_id = e.ponto_atendimento_id THEN 0 ELSE 1 END AS divergencia_atual,
    CASE WHEN ca.ponto_atendimento_id IS NULL THEN 1 ELSE 0 END AS casa_sem_ponto,
    CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END AS possui_rsvp,
    CASE WHEN ci.id IS NOT NULL THEN 1 ELSE 0 END AS possui_checkin_ativo,
    CASE WHEN cf.id IS NOT NULL THEN 1 ELSE 0 END AS fechamento_definitivo,
    COALESCE(pe.status, 'SEM_REGISTRO') AS status_portaria
  FROM convocacoes cv
  JOIN eventos e ON e.id = cv.evento_id
  JOIN convocacao_destinatarios cd ON cd.convocacao_id = cv.id
  JOIN membros m ON m.id = cd.membro_id
  JOIN casas ca ON ca.id = m.casa_id
  LEFT JOIN rsvp r ON r.convocacao_destinatario_id = cd.id
  LEFT JOIN checkins ci ON ci.convocacao_destinatario_id = cd.id AND ci.status = 'ATIVO'
  LEFT JOIN portarias_evento pe ON pe.evento_id = e.id
  LEFT JOIN portaria_fechamentos cf ON cf.evento_id = e.id
  WHERE cv.status = 'PUBLICADA'
    AND e.ponto_atendimento_id IS NOT NULL
)
SELECT
  evento_id,
  inicio_em,
  ponto_evento_id,
  status_portaria,
  COUNT(*) AS total_destinatarios,
  SUM(divergencia_atual) AS suspeitas_por_vinculo_atual,
  SUM(CASE WHEN divergencia_atual = 1 AND casa_sem_ponto = 1 THEN 1 ELSE 0 END) AS suspeitas_casa_sem_ponto,
  SUM(CASE WHEN divergencia_atual = 1 AND possui_rsvp = 1 THEN 1 ELSE 0 END) AS suspeitas_com_rsvp,
  SUM(CASE WHEN divergencia_atual = 1 AND possui_checkin_ativo = 1 THEN 1 ELSE 0 END) AS suspeitas_com_checkin_ativo,
  SUM(CASE WHEN divergencia_atual = 1 AND fechamento_definitivo = 1 THEN 1 ELSE 0 END) AS suspeitas_com_fechamento_definitivo
FROM base
GROUP BY evento_id, inicio_em, ponto_evento_id, status_portaria
HAVING SUM(divergencia_atual) > 0
ORDER BY inicio_em DESC, evento_id;
```

**Interpretação:**

- `suspeitas_por_vinculo_atual` é divergência de PA **atual**; a consulta não estabelece o PA no instante da publicação nem se o membro possuía outra função/convocação legítima.
- `suspeitas_com_rsvp`, `suspeitas_com_checkin_ativo`, `suspeitas_com_fechamento_definitivo` marcam registros de alto risco: **não remover**. A contagem de RSVPs inclui “Não sei” e “Não participarei”.
- `status_portaria` é uma pista operacional, não autorização para reabrir/fechar; o snapshot em `portaria_fechamentos` pode ser histórico e deve ser preservado.
- O filtro alcança convocações `PUBLICADA` com PA; não inclui convocações `CANCELADA` nem eventos sem PA. Caso haja eventos inativos, tratá-los separadamente antes de qualquer conclusão.

## Matriz de decisão, sem escrita

| Cenário | Classificação | Tratamento permitido neste gate |
|---|---|---|
| Casa no PA do evento | Compatível com vínculo atual | Confirmar apenas pela amostra de testes |
| Casa em outro PA, sem RSVP/check-in | Suspeita de legado | Verificar histórico de vínculo e data da publicação |
| Casa em outro PA, com RSVP ou check-in | Alto risco de integridade | Preservar dados; revisar manualmente autorização e histórico |
| Evento com Portaria fechada ou snapshot de ata | Histórico protegido | Não excluir/recalcular; escalar ao PMO |
| Exceção Brás→Bom Retiro (#418) | Possivelmente legítimo | Conferir autorização Master e unicidade por Casa |
| Casa transferida após publicação | Possível falso positivo | Conferir auditoria de transferência e vínculo no momento relevante |

## Testes faltantes (Beta, dados sintéticos)

1. Membro do PA A recebe reunião de A, não recebe de B; acesso direto a RSVP de B é negado com código adequado.
2. Check-in QR e manual em B não são concedidos a membro não elegível de A, respeitando regras explícitas para convidado autorizado.
3. Relatórios de A e B não misturam presenças; check-in é contabilizado pelo evento correto.
4. Exceção institucional de #418 inclui apenas a Casa autorizada, sem expor outros Pontos.
5. Um destinatário legado com RSVP/check-in ou Portaria fechada não sofre mutação indireta durante sincronizações aditivas.
6. Identificar se qualquer mitigação proposta afetaria um PDF definitivo/ata já emitido; preservar snapshots.

## Gate para etapa seguinte

Preencher apenas **quantidades e classificação**, identificar a hipótese histórica, documentar diferenças Beta/Produção e decidir necessidade de PR de testes. Para saneamento histórico, apresentar proposta específica com dry run, transação, backup, plano de reversão e autorização PMO. **Nenhuma alteração de D1 ou produção está autorizada por este documento.** LGPD #452 bloqueada.
