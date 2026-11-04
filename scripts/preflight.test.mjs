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

function scenario({ base = 'develop', head = 'feature/x', actualSha = sha, expectedSha = sha, changes = [], fetchFails = false, diffFails = false, omitDeclaration, output = false, githubEvent = null, repository = null } = {}) {
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
    'else if (args[0] === "diff") {',
    '  if (process.env.MOCK_DIFF_FAIL === "true") process.exit(1)',
    '  if (args.length !== 3 || args[1] !== "--name-only" || args[2] !== "origin/" + process.env.MOCK_BASE + "...HEAD") process.exit(3)',
    '  process.stdout.write(process.env.MOCK_CHANGED)',
    '}',
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
  const eventPath = join(dir, 'github-event.json')
  if (githubEvent) writeFileSync(eventPath, JSON.stringify(githubEvent))
  try {
    const env = {
      ...process.env,
      PATH: bin + ':' + process.env.PATH,
      GITHUB_BASE_REF: base,
      GITHUB_HEAD_REF: head,
      GITHUB_SHA: expectedSha,
      MOCK_ACTUAL_SHA: actualSha,
      MOCK_FETCH_FAIL: String(fetchFails),
      MOCK_DIFF_FAIL: String(diffFails),
      MOCK_BASE: base,
      MOCK_CHANGED: changes.join('\n'),
      MOCK_HEAD: head,
    }
    if (githubEvent) {
      env.GITHUB_EVENT_PATH = eventPath
      env.GITHUB_EVENT_NAME = 'pull_request'
    } else {
      delete env.GITHUB_EVENT_PATH
      delete env.GITHUB_EVENT_NAME
    }
    if (repository) env.GITHUB_REPOSITORY = repository
    else delete env.GITHUB_REPOSITORY
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
test('remote diff errors fail closed after successful fetch', () => {
  const r = scenario({ diffFails: true, output: true })
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


const release469Paths = [
  'apps/web/src/components/convocacoes/ConvocacaoFuncoesModal.tsx',
  'apps/web/src/components/eventos/EventosView.tsx',
  'apps/web/src/components/portaria/PortariaOperadorTemporarioView.tsx',
  'apps/worker/src/routes/agenda.ts',
  'apps/worker/src/routes/eventos.ts',
  'apps/worker/src/routes/portaria-operador-publica.ts',
  'apps/worker/src/routes/vinculos_funcionais.ts',
  'apps/worker/src/test/agenda.spec.ts',
  'apps/worker/src/test/eventos.spec.ts',
  'apps/worker/src/test/membros.spec.ts',
  'apps/worker/src/test/portaria-operador-temporario.spec.ts',
  'scripts/preflight.mjs',
  'scripts/preflight.test.mjs',
]
const release469Repo = 'AlfredPennywhorth/piedade-agenda-regional'
const release469Head = 'release/selective-fixes-pa-portaria-20261104'
function release469Event(overrides = {}) {
  return {
    number: 469,
    pull_request: {
      number: 469,
      base: { ref: 'main', repo: { full_name: release469Repo } },
      head: { ref: release469Head, repo: { full_name: release469Repo } },
    },
    ...overrides,
  }
}
function release469Scenario(overrides = {}) {
  return scenario({
    base: 'main',
    head: release469Head,
    changes: release469Paths,
    githubEvent: release469Event(),
    repository: release469Repo,
    ...overrides,
  })
}
test('release #469: somente PR, repositório, branch e arquivos aprovados passam', () => {
  const r = release469Scenario({ output: true })
  assert.equal(r.status, 0, r.log)
  assert.match(r.outputs, /worker_changed=true/)
  assert.match(r.outputs, /web_changed=true/)
  assert.match(r.outputs, /migration_changed=false/)
})
test('release #469: qualquer arquivo extra ou substituição é bloqueado', () => {
  for (const changes of [
    [...release469Paths, 'apps/worker/drizzle/0053_lgpd.sql'],
    [...release469Paths, 'apps/web/src/components/lgpd/LgpdPrimeiroAcessoGate.tsx'],
    [...release469Paths.slice(1), 'apps/web/src/App.tsx'],
    release469Paths.slice(1),
  ]) {
    const r = release469Scenario({ changes })
    assert.equal(r.status, 1, r.log)
    assert.match(r.log, /PR #469: escopo divergente/)
  }
})
test('release #469: origem, identidade e metadados falsos falham fechados', () => {
  const cases = [
    { repository: 'outro/ambiente' },
    { githubEvent: release469Event({ number: 470 }) },
    { githubEvent: release469Event({ pull_request: { ...release469Event().pull_request, number: 470 } }) },
    { githubEvent: release469Event({ pull_request: { ...release469Event().pull_request, head: { ref: 'develop', repo: { full_name: release469Repo } } } }) },
    { githubEvent: release469Event({ pull_request: { ...release469Event().pull_request, head: { ref: release469Head, repo: { full_name: 'outra/conta' } } } }) },
    { githubEvent: null },
    { head: 'release/falsa-469' },
    { base: 'other' },
  ]
  for (const options of cases) {
    const r = release469Scenario(options)
    assert.equal(r.status, 1, JSON.stringify(options) + '\n' + r.log)
  }
})
test('release #469: falha em SHA, diff ou declaração essencial continua bloqueando', () => {
  for (const options of [
    { expectedSha: 'b'.repeat(40) },
    { diffFails: true },
    { fetchFails: true },
    { omitDeclaration: 'PIN_PEPPER' },
  ]) {
    const r = release469Scenario(options)
    assert.equal(r.status, 1, JSON.stringify(options) + '\n' + r.log)
  }
})
