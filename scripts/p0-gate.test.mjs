import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avaliarGateP0, validarResultadoBuscaP0 } from './p0-gate.mjs'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repo = 'AlfredPennywhorth/piedade-agenda-regional'
const paths = [
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
const files = paths.map(filename => ({
  filename,
  status: filename === 'scripts/p0-gate.mjs' || filename === 'scripts/p0-gate.test.mjs' ? 'added' : 'modified',
  previous_filename: null,
}))
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
  assert.equal(run({ files: [...files, { filename: 'apps/worker/drizzle/9999.sql', status: 'added', previous_filename: null }] }).allowed, false)
  assert.equal(run({ files: files.slice(1) }).allowed, false)
  assert.equal(run({ files: [...files.slice(1), files[1]] }).allowed, false)
})
test('rejeita dados ausentes e repository diferente', () => {
  assert.equal(run({ files: null }).allowed, false)
  assert.equal(run({ issues: null }).allowed, false)
  assert.equal(run({ repository: 'attacker/other' }).allowed, false)
  assert.equal(run({ event: null }).allowed, false)
})

test('rejeita renomeação de fora do escopo para destino permitido, mesmo com nove arquivos', () => {
  const renomeados = files.map(file => file.filename === 'scripts/p0-gate.test.mjs'
    ? { filename: file.filename, status: 'renamed', previous_filename: 'docs/00-governanca/preflight-cross-audit.md' }
    : file)
  assert.equal(run({ files: renomeados }).allowed, false)
  assert.equal(run({ files: files.map(file => ({ ...file, status: 'copied' })) }).allowed, false)
})

test('rejeita resposta incompleta da busca de P0 mesmo quando contagem bate', () => {
  assert.throws(() => validarResultadoBuscaP0({
    total_count: 0, incomplete_results: true, items: []
  }), /Busca de issues P0 incompleta/)
  assert.deepEqual(validarResultadoBuscaP0({
    total_count: 0, incomplete_results: false, items: []
  }), [])
})

test('ponto de entrada bloqueia busca P0 incompleta sem consultar arquivos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agenda-p0-gate-'))
  try {
    const ghPath = join(dir, 'gh')
    writeFileSync(ghPath, '#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({ total_count: 0, incomplete_results: true, items: [] }))\n')
    chmodSync(ghPath, 0o755)
    const result = spawnSync(process.execPath, [resolve('scripts/p0-gate.mjs')], {
      env: { ...process.env, PATH: dir + ':' + process.env.PATH, GITHUB_REPOSITORY: repo },
      encoding: 'utf8',
    })
    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.match(result.stderr, /Busca de issues P0 incompleta/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
