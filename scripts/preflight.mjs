#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

const baseRef = process.env.GITHUB_BASE_REF || process.env.PREFLIGHT_BASE || 'develop'
const headRef = process.env.GITHUB_HEAD_REF || process.env.PREFLIGHT_HEAD || git('branch', '--show-current')
const expectedSha = process.env.GITHUB_SHA || git('rev-parse', 'HEAD')
const actualSha = git('rev-parse', 'HEAD')

const errors = []

if (expectedSha !== actualSha) errors.push(`SHA inesperado: checkout=${actualSha}, esperado=${expectedSha}`)

// Exceção de release seletivo, válida SOMENTE para a PR #430.
// A PR deve nascer de main, manter o nome aprovado e alterar apenas os três
// caminhos explicitamente permitidos. A identificação vem do evento do GitHub,
// não de dados informados pelo autor no corpo da PR.
let release430 = false
try {
  const event = process.env.GITHUB_EVENT_PATH
    ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
    : null
  release430 = (
    process.env.GITHUB_EVENT_NAME === 'pull_request' &&
    event?.number === 430 &&
    event?.pull_request?.base?.ref === 'main' &&
    event?.pull_request?.head?.ref === 'release/pr429-pontos-filtros-main-20261030' &&
    baseRef === 'main' &&
    headRef === 'release/pr429-pontos-filtros-main-20261030'
  )
} catch {
  // Falha fechada quando o evento não puder ser validado.
}
if (baseRef === 'main' && headRef !== 'develop' && !release430) {
  errors.push(`PR para main deve partir de develop; head atual: ${headRef}`)
}
if (!['main', 'develop'].includes(baseRef)) {
  errors.push(`Base não suportada pelo fluxo canônico: ${baseRef}`)
}

let changed = []
let diffAvailable = true
try {
  git('fetch', 'origin', baseRef, '--depth=50')
  changed = git('diff', '--name-only', `origin/${baseRef}...HEAD`).split('\n').filter(Boolean)
} catch {
  diffAvailable = false
  errors.push('Não foi possível calcular o diff remoto; o preflight falha fechado para não omitir impacto de deploy ou migration.')
}

if (release430) {
  const permitidos = new Set([
    'apps/web/src/components/pontos-atendimento/PontosAtendimentoView.tsx',
    'scripts/preflight.mjs',
    'docs/00-governanca/preflight-cross-audit.md',
  ])
  if (!diffAvailable || changed.length !== permitidos.size || changed.some(p => !permitidos.has(p))) {
    errors.push('PR #430: escopo fora dos três arquivos autorizados para release seletivo.')
  }
}

const workerChanged = !diffAvailable || changed.some(p => p.startsWith('apps/worker/') || p.startsWith('packages/shared/'))
const webChanged = !diffAvailable || changed.some(p => p.startsWith('apps/web/') || p.startsWith('packages/shared/'))
const migrationChanged = !diffAvailable || changed.some(p => p.startsWith('apps/worker/drizzle/'))

const requiredDeclarations = [
  ['.github/workflows/deploy-worker-production.yml', 'CLOUDFLARE_D1_DATABASE_ID'],
  ['.github/workflows/deploy-worker-production.yml', 'CLOUDFLARE_ACCOUNT_ID'],
  ['.github/workflows/deploy-worker-production.yml', 'CLOUDFLARE_API_TOKEN'],
  ['.github/workflows/deploy-worker-production.yml', 'PIN_PEPPER'],
  ['.github/workflows/deploy-worker-production.yml', 'MASTER_BOOTSTRAP_SECRET'],
  ['.github/workflows/deploy-pages-production.yml', 'PROD_API_URL'],
  ['.github/workflows/deploy-pages-production.yml', 'RELEASE_SHA'],
]
for (const [path, token] of requiredDeclarations) {
  if (!existsSync(path) || !readFileSync(path, 'utf8').includes(token)) {
    errors.push(`Declaração crítica ausente: ${token} em ${path}`)
  }
}

console.log('=== Preflight local ===')
console.log(`Base: ${baseRef}`)
console.log(`Head: ${headRef}`)
console.log(`SHA: ${actualSha}`)
console.log(`Arquivos alterados: ${changed.length}`)
console.log(`Worker requer deploy: ${workerChanged ? 'SIM' : 'não'}`)
console.log(`Web requer deploy: ${webChanged ? 'SIM' : 'não'}`)
console.log(`Migration alterada: ${migrationChanged ? 'SIM' : 'não'}`)

if (process.env.GITHUB_OUTPUT) {
  const fs = await import('node:fs')
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `worker_changed=${workerChanged}\nweb_changed=${webChanged}\nmigration_changed=${migrationChanged}\n`)
}

if (errors.length) {
  console.error('\nBloqueios:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}
