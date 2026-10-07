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
const notes = []

if (expectedSha !== actualSha) errors.push(`SHA inesperado: checkout=${actualSha}, esperado=${expectedSha}`)

if (baseRef === 'main' && headRef !== 'develop') {
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
