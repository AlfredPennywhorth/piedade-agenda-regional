import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { setupDb } from './setup'

const migracao = readFileSync(decodeURIComponent(new URL('../../drizzle/0046_portaria_escopo_integridade.sql', import.meta.url).pathname)).toString('utf8')

function banco() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  setupDb(sqlite)
  sqlite.exec(migracao)
  sqlite.exec(`
    INSERT INTO regionais (id, nome) VALUES ('r', 'Regional');
    INSERT INTO administracoes (id, regional_id, nome) VALUES ('a','r','Administração');
    INSERT INTO setores (id, administracao_id, nome) VALUES ('s','a','Setor');
    INSERT INTO eventos (id, titulo, modalidade, inicio_em, fim_em, setor_id, ativo)
      VALUES ('e','Evento','PRESENCIAL','2099-01-01T10:00:00Z','2099-01-01T12:00:00Z','s',1);
  `)
  return sqlite
}

describe('0046 — integridade Portaria e abrangência', () => {
  it('impede portaria em evento externo', () => {
    const db = banco()
    db.prepare("UPDATE eventos SET abrangencia='NACIONAL' WHERE id='e'").run()
    expect(() => db.prepare("INSERT INTO portarias_evento (evento_id) VALUES ('e')").run())
      .toThrow(/PORTARIA_EVENTO_INCOMPATIVEL/)
    db.close()
  })

  it('impede converter escopo depois de criar estado de Portaria', () => {
    const db = banco()
    db.prepare("INSERT INTO portarias_evento (evento_id) VALUES ('e')").run()
    expect(() => db.prepare("UPDATE eventos SET abrangencia='NACIONAL' WHERE id='e'").run())
      .toThrow(/EVENTO_COM_PORTARIA_NAO_PODE_MUDAR_ESCOPO/)
    db.close()
  })

  it('preserva portaria territorial', () => {
    const db = banco()
    db.prepare("INSERT INTO portarias_evento (evento_id) VALUES ('e')").run()
    db.prepare("UPDATE portarias_evento SET status='FECHADA' WHERE evento_id='e'").run()
    const estado = db.prepare("SELECT status FROM portarias_evento WHERE evento_id='e'").get() as { status: string }
    expect(estado.status).toBe('FECHADA')
    db.close()
  })
})
