import Database from 'better-sqlite3'
import { RESPONSABILIDADE_PMO_VERSAO_ATUAL } from '../security/responsabilidade-pmo'

export function registrarCienciaPmo(
  sqlite: Database.Database,
  contaAcessoId: string,
  acessoContaId: string
) {
  sqlite
    .prepare(
      `INSERT INTO ciencias_responsabilidade
        (id, conta_acesso_id, acesso_conta_id, tipo, versao_texto, texto_hash)
       VALUES (?, ?, ?, 'RESPONSAVEL_REGIONAL_PMO', ?, ?)`
    )
    .run(
      `ciencia-${acessoContaId}`,
      contaAcessoId,
      acessoContaId,
      RESPONSABILIDADE_PMO_VERSAO_ATUAL,
      '0'.repeat(64)
    )
}
