import { and, eq, gt, sql } from 'drizzle-orm'
import {
  convocacoes, convocacaoFuncoes, convocacaoDestinatarios,
  convocacaoDestinatarioEvidencias, eventos, funcoes, membros, vinculosFuncionais,
} from '../db/schema'

// UUID v4 gerado por linha pelo SQLite, sem materializar destinatários antes do batch.
const uuidSql = sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) ||
  '-4' || substr(lower(hex(randomblob(2))), 2) || '-a' ||
  substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))))`

export function queriesSincronizacaoDcoAtual(
  qdb: any,
  agoraIso: string,
  filtro: { membroId?: string; convocacaoId?: string }
) {
  const condicoes = and(
    eq(funcoes.codigo, 'DCO'),
    eq(funcoes.ativo, true),
    eq(vinculosFuncionais.origem, 'MEMBRO_AUTOMATICO'),
    eq(vinculosFuncionais.ativo, true),
    eq(membros.ativo, true),
    eq(vinculosFuncionais.casaId, membros.casaId),
    eq(convocacoes.status, 'PUBLICADA'),
    eq(convocacoes.ativo, true),
    eq(eventos.ativo, true),
    gt(eventos.fimEm, agoraIso),
    filtro.membroId ? eq(membros.id, filtro.membroId) : undefined,
    filtro.convocacaoId ? eq(convocacoes.id, filtro.convocacaoId) : undefined,
  )
  const elegiveis = (selecao: any) => qdb.select(selecao)
    .from(vinculosFuncionais)
    .innerJoin(membros, eq(membros.id, vinculosFuncionais.membroId))
    .innerJoin(funcoes, eq(funcoes.id, vinculosFuncionais.funcaoId))
    .innerJoin(convocacaoFuncoes, eq(convocacaoFuncoes.funcaoId, funcoes.id))
    .innerJoin(convocacoes, eq(convocacoes.id, convocacaoFuncoes.convocacaoId))
    .innerJoin(eventos, and(
      eq(eventos.id, convocacoes.eventoId),
      eq(eventos.casaId, vinculosFuncionais.casaId),
    ))

  return [
    qdb.insert(convocacaoDestinatarios).select(
      elegiveis({
        id: uuidSql,
        convocacaoId: convocacoes.id,
        membroId: membros.id,
        createdAt: sql`${agoraIso}`,
      }).where(condicoes).groupBy(convocacoes.id, membros.id)
    ).onConflictDoNothing(),
    qdb.insert(convocacaoDestinatarioEvidencias).select(
      elegiveis({
        id: uuidSql,
        convocacaoDestinatarioId: convocacaoDestinatarios.id,
        funcaoId: funcoes.id,
        vinculoFuncionalId: vinculosFuncionais.id,
        funcaoNomeSnapshot: funcoes.nome,
        escopoTipoSnapshot: sql<string>`CASE
          WHEN ${vinculosFuncionais.regionalId} IS NOT NULL THEN 'REGIONAL'
          WHEN ${vinculosFuncionais.grupoTrabalhoId} IS NOT NULL THEN 'GRUPO_TRABALHO'
          WHEN ${vinculosFuncionais.administracaoId} IS NOT NULL THEN 'ADMINISTRACAO'
          WHEN ${vinculosFuncionais.setorId} IS NOT NULL THEN 'SETOR'
          WHEN ${vinculosFuncionais.casaId} IS NOT NULL THEN 'CASA'
          ELSE NULL
        END`,
        escopoIdSnapshot: sql<string>`COALESCE(
          ${vinculosFuncionais.regionalId},
          ${vinculosFuncionais.grupoTrabalhoId},
          ${vinculosFuncionais.administracaoId},
          ${vinculosFuncionais.setorId},
          ${vinculosFuncionais.casaId}
        )`,
        createdAt: sql`${agoraIso}`,
      }).innerJoin(convocacaoDestinatarios, and(
        eq(convocacaoDestinatarios.convocacaoId, convocacoes.id),
        eq(convocacaoDestinatarios.membroId, membros.id),
      )).where(condicoes)
    ).onConflictDoNothing(),
  ]
}
