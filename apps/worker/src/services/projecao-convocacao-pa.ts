import { sql } from 'drizzle-orm'
import { convocacaoDestinatarios, eventos, membros } from '../db/schema'

/**
 * Elegibilidade territorial vigente para projeções operacionais de uma convocação.
 *
 * Trata evento sem PA como anteriormente (sem filtro de PA).
 * Casa sem vínculo com PA não é elegível para reunião com PA; as exceções
 * intersetoriais são respeitadas pelo vínculo efetivo da Casa.
 *
 * Não altera destinatários, evidências, RSVP ou check-ins históricos.
 */
export function condicaoMembroNoPaDoEvento(
  eventoId: string | typeof eventos.id,
  membroId: typeof membros.id | typeof convocacaoDestinatarios.membroId,
) {
  return sql`EXISTS (
    SELECT 1 FROM eventos pa_ev
    LEFT JOIN membros pa_m ON pa_m.id = ${membroId}
    LEFT JOIN casas pa_ca ON pa_ca.id = pa_m.casa_id
    WHERE pa_ev.id = ${eventoId}
      AND (pa_ev.ponto_atendimento_id IS NULL
        OR pa_ca.ponto_atendimento_id = pa_ev.ponto_atendimento_id)
  )`
}
