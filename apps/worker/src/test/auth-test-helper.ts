import { hashToken } from '../security/tokens'

export async function criarSessaoAutenticadaTeste(sqlite: any, prefixo = 'auth-test') {
  const regionalId = `${prefixo}-regional`
  const administracaoId = `${prefixo}-administracao`
  const setorId = `${prefixo}-setor`
  const casaId = `${prefixo}-casa`
  const membroId = `${prefixo}-membro`
  const contaId = `${prefixo}-conta`
  const sessaoId = `${prefixo}-sessao`
  const token = `${prefixo}-token-seguro`
  const tokenHash = await hashToken(token)

  sqlite.prepare('INSERT OR IGNORE INTO regionais (id, nome) VALUES (?, ?)').run(regionalId, 'Regional Teste Auth')
  sqlite.prepare('INSERT OR IGNORE INTO administracoes (id, regional_id, nome) VALUES (?, ?, ?)').run(administracaoId, regionalId, 'Administração Teste Auth')
  sqlite.prepare('INSERT OR IGNORE INTO setores (id, administracao_id, nome) VALUES (?, ?, ?)').run(setorId, administracaoId, 'Setor Teste Auth')
  sqlite.prepare('INSERT OR IGNORE INTO casas (id, setor_id, nome) VALUES (?, ?, ?)').run(casaId, setorId, 'Casa Teste Auth')
  sqlite.prepare('INSERT OR IGNORE INTO membros (id, nome, casa_id, ativo) VALUES (?, ?, ?, 1)').run(membroId, 'Usuário Teste Auth', casaId)
  sqlite.prepare("INSERT OR IGNORE INTO contas_acesso (id, membro_id, status, ativado_em) VALUES (?, ?, 'ATIVA', CURRENT_TIMESTAMP)").run(contaId, membroId)
  sqlite.prepare(`
    INSERT OR IGNORE INTO acessos_conta
      (id, conta_acesso_id, perfil_codigo, escopo_tipo, escopo_id)
    VALUES (?, ?, 'MASTER_SISTEMA', 'GLOBAL', NULL)
  `).run(`${prefixo}-acesso-master`, contaId)
  sqlite.prepare(`
    INSERT OR REPLACE INTO sessoes
      (id, conta_acesso_id, membro_id, token_hash, expira_em, revogado_em, ultimo_acesso_em, created_at)
    VALUES (?, ?, ?, ?, '2099-01-01T00:00:00.000Z', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(sessaoId, contaId, membroId, tokenHash)

  return { token, membroId, contaId }
}

export function mesclarAutorizacao(token: string, options?: RequestInit): RequestInit {
  const headers = new Headers(options?.headers)
  headers.set('Authorization', `Bearer ${token}`)

  return {
    ...options,
    headers,
  }
}
