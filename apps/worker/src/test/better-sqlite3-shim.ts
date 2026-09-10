import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite')

export class SqliteError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

export default class Database {
  private native: any

  constructor(filename: string = ':memory:', _options?: any) {
    this.native = new DatabaseSync(filename)
  }

  exec(sql: string) {
    return this.native.exec(sql)
  }

  pragma(sql: string) {
    try {
      return this.native.exec(`PRAGMA ${sql}`)
    } catch {
      return []
    }
  }

  prepare(sql: string) {
    let isRaw = false
    const stmt = this.native.prepare(sql)

    function extractParamsAndOptions(params: any[]) {
      let isValuesOnly = false
      let realParams = params

      if (params.length > 0 && typeof params[0] === 'object' && params[0] !== null && !Array.isArray(params[0]) && 'values' in params[0] && params[0].values === true) {
        isValuesOnly = true
        realParams = params.slice(1)
      } else if (params.length === 1 && Array.isArray(params[0])) {
        realParams = params[0]
      }

      const flatParams = realParams.map(v => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v))
      return { isValuesOnly, flatParams }
    }

    const wrapper = {
      raw(val = true) {
        isRaw = val
        return wrapper
      },
      all(...params: any[]) {
        const { isValuesOnly, flatParams } = extractParamsAndOptions(params)
        if (typeof stmt.setReturnArrays === 'function') {
          stmt.setReturnArrays(isRaw || isValuesOnly)
        }
        const rows = stmt.all(...flatParams)
        if ((isRaw || isValuesOnly) && Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
          return rows.map((r: any) => (r && typeof r === 'object' ? Object.values(r) : r))
        }
        return rows
      },
      get(...params: any[]) {
        const { isValuesOnly, flatParams } = extractParamsAndOptions(params)
        if (typeof stmt.setReturnArrays === 'function') {
          stmt.setReturnArrays(isRaw || isValuesOnly)
        }
        const row = stmt.get(...flatParams)
        if ((isRaw || isValuesOnly) && row && typeof row === 'object' && !Array.isArray(row)) {
          return Object.values(row)
        }
        return row
      },
      run(...params: any[]) {
        const { flatParams } = extractParamsAndOptions(params)
        const res = stmt.run(...flatParams)
        return {
          changes: Number(res.changes ?? 0),
          lastInsertRowid: res.lastInsertRowid
        }
      },
      bind() {
        return wrapper
      }
    }
    return wrapper
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T & { deferred: T; immediate: T; exclusive: T } {
    const self = this
    const createTxFn = (mode: string) => {
      return (...args: any[]) => {
        self.exec(`BEGIN ${mode}`)
        try {
          const res = fn(...args)
          self.exec('COMMIT')
          return res
        } catch (err) {
          self.exec('ROLLBACK')
          throw err
        }
      }
    }

    const txFn: any = createTxFn('IMMEDIATE')
    txFn.deferred = createTxFn('DEFERRED')
    txFn.immediate = createTxFn('IMMEDIATE')
    txFn.exclusive = createTxFn('EXCLUSIVE')
    return txFn
  }

  close() {
    if (typeof this.native.close === 'function') {
      this.native.close()
    }
  }
}
