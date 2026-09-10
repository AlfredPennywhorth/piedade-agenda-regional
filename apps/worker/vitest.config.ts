import { defineConfig } from 'vitest/config'
import path from 'path'

// Nota de arquitetura (ressalva PMO):
// Este config usa ambiente Node para testes unitários de rotas Hono.
// Código que depende de runtime Cloudflare (D1, KV, etc.) deve ser
// testado separadamente com @cloudflare/vitest-pool-workers (Sprint S01+).

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    alias: {
      'better-sqlite3': path.resolve(__dirname, './src/test/better-sqlite3-shim.ts')
    }
  },
})

