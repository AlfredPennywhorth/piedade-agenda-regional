/**
 * Helper para operações atômicas seguras em ambas as arquiteturas.
 * Em Cloudflare D1, utiliza db.batch().
 * Em better-sqlite3 (testes), utiliza db.transaction().
 */
export async function executeAtomic<T = any>(
  db: any,
  buildQueries: (dbOrTx: any) => any[]
): Promise<T[]> {
  if (db && 'batch' in db && typeof db.batch === 'function') {
    const queries = buildQueries(db)
    return db.batch(queries)
  } else if (db && 'transaction' in db && typeof db.transaction === 'function') {
    return db.transaction(async (tx: any) => {
      const queries = buildQueries(tx)
      const results = []
      for (const query of queries) {
        results.push(await query)
      }
      return results
    })
  }
  
  throw new Error('Nenhum mecanismo atômico (batch ou transação) suportado pela instância de banco de dados.')
}
