#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PERMITIDOS_438 = [
  '.github/workflows/ci.yml',
  '.github/workflows/preflight.yml',
  'apps/web/src/components/eventos/EventosView.tsx',
  'apps/web/src/test/eventos.test.tsx',
  'apps/worker/src/routes/eventos.ts',
  'apps/worker/src/test/eventos-pessoais-segregacao.spec.ts',
  'apps/worker/src/test/eventos.spec.ts',
  'scripts/p0-gate.mjs',
  'scripts/p0-gate.test.mjs',
].sort()

export function validarResultadoBuscaP0(resultado) {
  if (resultado?.incomplete_results !== false ||
      !Array.isArray(resultado?.items) ||
      !Number.isSafeInteger(resultado?.total_count) ||
      resultado.total_count !== resultado.items.length) {
    throw new Error('Busca de issues P0 incompleta ou inválida; bloqueando por segurança')
  }
  return resultado.items
}

/** Regras TEMPORÁRIAS e fechadas para correção #438 e release #439 do P0 #437.
 * Qualquer outro P0, PR, branch, base ou arquivo extra continua bloqueado.
 */
export function avaliarGateP0({ issues, event, files, repository }) {
  if (!Array.isArray(issues)) return { allowed: false, reason: 'Lista P0 inválida' }
  if (issues.length === 0) return { allowed: true, reason: 'Nenhuma issue P0 aberta' }
  if (repository !== 'AlfredPennywhorth/piedade-agenda-regional') {
    return { allowed: false, reason: 'Repositório não autorizado para exceção' }
  }
  if (issues.length !== 1 || Number(issues[0]?.number) !== 437 ||
      !issues[0]?.labels?.some(label => (typeof label === 'string' ? label : label?.name) === 'P0')) {
    return { allowed: false, reason: 'Existem P0 não autorizados ou #437 não é P0' }
  }
  const pr = event?.pull_request
  const release438 = Number(event?.number) === 438 && pr?.number === 438 &&
    pr.base?.ref === 'develop' &&
    pr.head?.ref === 'fix/p0-437-reagendamento-cancelamento-stale-20261031'
  const release439 = Number(event?.number) === 439 && pr?.number === 439 &&
    pr.base?.ref === 'main' && pr.head?.ref === 'develop'
  if ((!release438 && !release439) ||
      pr?.base?.repo?.full_name !== repository ||
      pr?.head?.repo?.full_name !== repository) {
    return { allowed: false, reason: 'PR, base, head ou origem fora das exceções #438/#439' }
  }
  // Exigir status e origem: um rename de caminho não autorizado não pode
  // apresentar somente um destino permitido e ocultar a exclusão de origem.
  if (!Array.isArray(files) ||
      files.length !== PERMITIDOS_438.length ||
      files.some(file => !file || typeof file.filename !== 'string' ||
        !['added', 'modified'].includes(file.status) ||
        file.previous_filename != null) ||
      files.map(file => file.filename).sort().some((path, i) => path !== PERMITIDOS_438[i])) {
    return { allowed: false, reason: 'Escopo da PR P0 diverge dos arquivos autorizados' }
  }
  return { allowed: true, reason: `Exceção restrita à PR #${release439 ? 439 : 438} corrigindo P0 #437` }
}

function gh(...args) {
  return execFileSync('gh', ['api', ...args], { encoding: 'utf8' }).trim()
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const repository = process.env.GITHUB_REPOSITORY
    if (!repository) throw new Error('GITHUB_REPOSITORY ausente')
    const resultadoBusca = JSON.parse(gh('--method', 'GET', 'search/issues',
      '-f', `q=repo:${repository} is:issue is:open label:P0`, '-f', 'per_page=100'))
    const issues = validarResultadoBuscaP0(resultadoBusca)
    let event = null
    let files = []
    if (issues.length) {
      if (process.env.GITHUB_EVENT_NAME !== 'pull_request' || !process.env.GITHUB_EVENT_PATH) {
        throw new Error('P0 aberto: exceção exige evento pull_request verificável')
      }
      event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
      // Arquivos são obtidos da API, não de declarações do autor da PR.
      // Um JSON por linha preserva status e origem mesmo quando
      // previous_filename não está presente em arquivos comuns.
      const arquivosJson = gh('--paginate', `repos/${repository}/pulls/${event.number}/files?per_page=100`,
        '--jq', '.[] | {filename, status, previous_filename} | @json')
      files = arquivosJson.split('\n').filter(Boolean).map(linha => {
        const file = JSON.parse(linha)
        if (!file || typeof file.filename !== 'string' || typeof file.status !== 'string') {
          throw new Error('Metadados incompletos na lista de arquivos')
        }
        return file
      })
    }
    const decisao = avaliarGateP0({ issues, event, files, repository })
    console.log(decisao.reason)
    if (!decisao.allowed) process.exitCode = 1
  } catch (error) {
    console.error('Gate P0 bloqueado (falha fechada):', error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
