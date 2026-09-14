import * as schema from '../db/schema'
import { executeAtomic } from '../db/batch'

export interface AuditLogData {
  acao: string
  atorMembroId?: string | null
  recursoTipo: string
  recursoId: string
  escopoTipo?: string | null
  escopoId?: string | null
  contexto?: Record<string, unknown> | null
}

export function extrairEscopoDoEvento(evento: any): { escopoTipo: string | null; escopoId: string | null } {
  if (!evento) return { escopoTipo: null, escopoId: null }
  if (evento.regionalId) return { escopoTipo: 'REGIONAL', escopoId: evento.regionalId }
  if (evento.administracaoId) return { escopoTipo: 'ADMINISTRACAO', escopoId: evento.administracaoId }
  if (evento.setorId) return { escopoTipo: 'SETOR', escopoId: evento.setorId }
  if (evento.casaId) return { escopoTipo: 'CASA', escopoId: evento.casaId }
  if (evento.grupoTrabalhoId) return { escopoTipo: 'GRUPO_TRABALHO', escopoId: evento.grupoTrabalhoId }
  return { escopoTipo: null, escopoId: null }
}

/**
 * Retorna uma query para inserção de log de auditoria.
 */
export function criarAuditQuery(dbOrTx: any, data: AuditLogData) {
  return dbOrTx.insert(schema.auditoriaLogs).values({
    id: crypto.randomUUID(),
    acao: data.acao,
    atorMembroId: data.atorMembroId ?? null,
    recursoTipo: data.recursoTipo,
    recursoId: data.recursoId,
    escopoTipo: data.escopoTipo || null,
    escopoId: data.escopoId || null,
    contexto: data.contexto || null,
  })
}

/**
 * Executa de forma atômica e fail-closed as queries de negócio + a query de auditoria.
 */
export async function executarOperacaoComAudit(
  db: any,
  buildQueries: (dbOrTx: any) => any[],
  auditData: AuditLogData
) {
  return executeAtomic(db, (qdb) => {
    const businessQueries = buildQueries(qdb)
    const auditQuery = criarAuditQuery(qdb, auditData)
    return [...businessQueries, auditQuery]
  })
}
