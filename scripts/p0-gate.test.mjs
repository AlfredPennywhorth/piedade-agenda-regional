import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avaliarGateP0 } from './p0-gate.mjs'

const repo = 'AlfredPennywhorth/piedade-agenda-regional'
const files = [
  '.github/workflows/ci.yml',
  '.github/workflows/preflight.yml',
  'apps/web/src/components/eventos/EventosView.tsx',
  'apps/web/src/test/eventos.test.tsx',
  'apps/worker/src/routes/eventos.ts',
  'apps/worker/src/test/eventos-pessoais-segregacao.spec.ts',
  'apps/worker/src/test/eventos.spec.ts',
  'scripts/p0-gate.mjs',
  'scripts/p0-gate.test.mjs',
]
const event = {
  number: 438,
  pull_request: {
    number: 438,
    base: { ref: 'develop', repo: { full_name: repo } },
    head: { ref: 'fix/p0-437-reagendamento-cancelamento-stale-20261031', repo: { full_name: repo } },
  },
}
const issues = [{ number: 437, labels: [{ name: 'P0' }] }]
const run = overrides => avaliarGateP0({ issues, event, files, repository: repo, ...overrides })

test('permite merge normal quando não há P0', () => {
  assert.equal(run({ issues: [], event: null, files: [] }).allowed, true)
})
test('permite apenas a PR corretiva #438 com P0 #437 e escopo exato', () => {
  assert.equal(run({}).allowed, true)
})
test('rejeita outros P0 e inconsistências de rótulos', () => {
  assert.equal(run({ issues: [...issues, { number: 123, labels: ['P0'] }] }).allowed, false)
  assert.equal(run({ issues: [{ number: 437, labels: [] }] }).allowed, false)
  assert.equal(run({ issues: [{ number: 439, labels: ['P0'] }] }).allowed, false)
})
test('rejeita PR de release main, outra PR e outros branches', () => {
  assert.equal(run({ event: { ...event, number: 439 } }).allowed, false)
  assert.equal(run({ event: { ...event, pull_request: { ...event.pull_request, base: { ref: 'main', repo: { full_name: repo } } } } }).allowed, false)
  assert.equal(run({ event: { ...event, pull_request: { ...event.pull_request, head: { ref: 'fix/p0-437-alternativo', repo: { full_name: repo } } } } }).allowed, false)
})
test('rejeita alterações extras, migrations, arquivos omitidos ou duplicados', () => {
  assert.equal(run({ files: [...files, 'apps/worker/drizzle/9999.sql'] }).allowed, false)
  assert.equal(run({ files: files.slice(1) }).allowed, false)
  assert.equal(run({ files: [...files.slice(1), files[1]] }).allowed, false)
})
test('rejeita dados ausentes e repository diferente', () => {
  assert.equal(run({ files: null }).allowed, false)
  assert.equal(run({ issues: null }).allowed, false)
  assert.equal(run({ repository: 'attacker/other' }).allowed, false)
  assert.equal(run({ event: null }).allowed, false)
})
