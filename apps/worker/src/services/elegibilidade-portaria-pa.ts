import { sql } from 'drizzle-orm'

/**
 * Regra do PA para check-in por convocação existente.
 * Sem PA no evento: mantém a regra anterior. Casa vinculada ao próprio PA
 * (inclusive por exceção territorial autorizada) permanece elegível.
 *
 * Não altera destinatários materializados, check-ins antigos ou convidados.
 */
export function destinatarioElegivelNoPonto(destinatarioId: string, eventoId: string) {
  return sql`EXISTS (
    SELECT 1
    FROM convocacao_destinatarios cd
    JOIN convocacoes cv ON cv.id = cd.convocacao_id
    JOIN eventos ev ON ev.id = cv.evento_id
    JOIN membros m ON m.id = cd.membro_id
    JOIN casas ca ON ca.id = m.casa_id
    WHERE cd.id = ${destinatarioId}
      AND ev.id = ${eventoId}
      AND cv.status = 'PUBLICADA' AND cv.ativo = 1 AND ev.ativo = 1
      AND (ev.ponto_atendimento_id IS NULL
           OR ca.ponto_atendimento_id = ev.ponto_atendimento_id)
  )`
}

/**
 * Defesa TOCTOU: o CHECK check_checkin_forma invalida a operação inteira
 * (check-in e auditoria) se a Casa mudar de PA entre a leitura e a escrita.
 */
export function formaCheckinComGuardaPa(
  destinatarioId: string,
  eventoId: string,
  forma: 'QR' | 'MANUAL'
) {
  return sql`CASE WHEN ${destinatarioElegivelNoPonto(destinatarioId, eventoId)}
    THEN ${forma} ELSE 'PA_DIVERGENTE' END`
}

/**
 * Filtro somente de apresentação: preservar pessoas que já têm check-in
 * ativo, para não ocultar ocorrências históricas da Portaria.
 */
export function filtroParticipantePortariaPorPa(eventoId: string) {
  return sql`(
    EXISTS (
      SELECT 1
      FROM eventos ev
      WHERE ev.id = ${eventoId}
      AND (ev.ponto_atendimento_id IS NULL
        OR ev.ponto_atendimento_id = casas.ponto_atendimento_id)
    )
    OR checkins.id IS NOT NULL
  )`
}
