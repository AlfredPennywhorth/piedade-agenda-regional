// Helper genérico para execução agrupada (batch)
// Compatível com Cloudflare D1 (nativamente via db.batch)
// e com better-sqlite3 (fallback para execução sequencial segura nos testes)
export async function executeBatch(db: any, queries: any[]): Promise<any[]> {
  if (db && 'batch' in db && typeof db.batch === 'function') {
    return db.batch(queries)
  }

  // Fallback sequencial (usado primariamente nos testes com better-sqlite3)
  const results = []
  for (const query of queries) {
    results.push(await query)
  }
  return results
}
