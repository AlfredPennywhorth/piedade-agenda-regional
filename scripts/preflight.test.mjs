import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const script = resolve('scripts/preflight.mjs')
const required = {
  '.github/workflows/deploy-worker-production.yml': [
    'CLOUDFLARE_D1_DATABASE_ID', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN',
    'PIN_PEPPER', 'MASTER_BOOTSTRAP_SECRET',
  ],
  '.github/workflows/deploy-pages-production.yml': ['PROD_API_URL', 'RELEASE_SHA'],
}
const sha = 'a'.repeat(40)

function scenario({ base = 'develop', head = 'feature/x', actualSha = sha, expectedSha = sha, changes = [], fetchFails = false, omitDeclaration, output = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'agenda-preflight-'))
  const bin = join(dir, 'bin')
  mkdirSync(bin)
  // Stub only the external git process; the production preflight script runs unchanged.
  const stub = join(bin, 'git')
  writeFileSync(stub, [
    '#!/usr/bin/env node',
    'const args = process.argv.slice(2)',
    'if (args[0] === "rev-parse") process.stdout.write(process.env.MOCK_ACTUAL_SHA)',
    'else if (args[0] === "fetch") process.exit(process.env.MOCK_FETCH_FAIL === "true" ? 1 : 0)',
    'else if (args[0] === "diff") process.stdout.write(process.env.MOCK_CHANGED)',
    'else if (args[0] === "branch") process.stdout.write(process.env.MOCK_HEAD)',
    'else process.exit(2)',
  ].join('\n') + '\n')
  chmodSync(stub, 0o755)
  for (const [name, declarations] of Object.entries(required)) {
    const path = join(dir, name)
    mkdirSync(resolve(path, '..'), { recursive: true })
    writeFileSync(path, declarations.filter(x => x !== omitDeclaration).join('\n'))
  }
  const outputPath = join(dir, 'github-output')
  try {
    const env = {
      ...process.env,
      PATH: bin + ':' + process.env.PATH,
      GITHUB_BASE_REF: base,
      GITHUB_HEAD_REF: head,
      GITHUB_SHA: expectedSha,
      MOCK_ACTUAL_SHA: actualSha,
      MOCK_FETCH_FAIL: String(fetchFails),
      MOCK_CHANGED: changes.join('\n'),
      MOCK_HEAD: head,
    }
    delete env.PREFLIGHT_BASE
    delete env.PREFLIGHT_HEAD
    delete env.GITHUB_OUTPUT
    if (output) env.GITHUB_OUTPUT = outputPath
    const result = spawnSync(process.execPath, [script], { cwd: dir, env, encoding: 'utf8' })
    return {
      status: result.status,
      log: (result.stdout || '') + (result.stderr || ''),
      outputs: output ? readFileSync(outputPath, 'utf8') : '',
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('develop -> main is allowed by branch policy', () => {
  const r = scenario({ base: 'main', head: 'develop' })
  assert.equal(r.status, 0, r.log)
})
test('temporary release branch -> main is blocked', () => {
  const r = scenario({ base: 'main', head: 'release/reconcile' })
  assert.equal(r.status, 1)
  assert.match(r.log, /PR para main deve partir de develop/)
})
test('feature branch -> develop is allowed', () => {
  const r = scenario()
  assert.equal(r.status, 0, r.log)
})
test('unsupported base is blocked', () => {
  const r = scenario({ base: 'other' })
  assert.equal(r.status, 1)
  assert.match(r.log, /Base não suportada/)
})
test('checkout SHA differs from expected SHA', () => {
  const r = scenario({ expectedSha: 'b'.repeat(40) })
  assert.equal(r.status, 1)
  assert.match(r.log, /SHA inesperado/)
})
test('remote diff errors fail closed', () => {
  const r = scenario({ fetchFails: true, output: true })
  assert.equal(r.status, 1)
  assert.match(r.log, /Não foi possível calcular o diff remoto/)
  assert.match(r.outputs, /worker_changed=true/)
  assert.match(r.outputs, /web_changed=true/)
  assert.match(r.outputs, /migration_changed=true/)
})
test('missing critical declaration blocks promotion', () => {
  const r = scenario({ omitDeclaration: 'PIN_PEPPER' })
  assert.equal(r.status, 1)
  assert.match(r.log, /Declaração crítica ausente: PIN_PEPPER/)
})
test('frontend, worker, shared and migration impact is accurate', () => {
  for (const [changes, expected] of [
    [['docs/README.md'], 'worker_changed=false\nweb_changed=false\nmigration_changed=false'],
    [['apps/web/src/App.tsx'], 'worker_changed=false\nweb_changed=true\nmigration_changed=false'],
    [['apps/worker/src/index.ts'], 'worker_changed=true\nweb_changed=false\nmigration_changed=false'],
    [['packages/shared/src/index.ts'], 'worker_changed=true\nweb_changed=true\nmigration_changed=false'],
    [['apps/worker/drizzle/0001.sql'], 'worker_changed=true\nweb_changed=false\nmigration_changed=true'],
  ]) {
    const r = scenario({ changes, output: true })
    assert.equal(r.status, 0, r.log)
    assert.equal(r.outputs.trim(), expected, r.outputs)
  }
})
