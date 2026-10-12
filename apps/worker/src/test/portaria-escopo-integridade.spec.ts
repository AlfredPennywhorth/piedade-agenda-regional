import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { setupDb } from './setup'

function banco() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  setupDb(sqlite)
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
    db.prepare("UPDATE eventos SET abrangencia='NACIONAL', regional_gestao_id='r', regional_id='r', setor_id=NULL, destino_uf='RJ', destino_cidade_local='Rio de Janeiro' WHERE id='e'").run()
    expect(() => db.prepare("INSERT INTO portarias_evento (evento_id) VALUES ('e')").run())
      .toThrow(/PORTARIA_EVENTO_INCOMPATIVEL/)
    db.close()
  })

  it('impede check-in em evento externo mesmo com destinatário legado', () => {
    const db = banco()
    db.prepare("UPDATE eventos SET abrangencia='NACIONAL', regional_gestao_id='r', regional_id='r', setor_id=NULL, destino_uf='RJ', destino_cidade_local='Rio de Janeiro' WHERE id='e'").run()
    expect(() => db.prepare("INSERT INTO checkins (id, convocacao_destinatario_id, evento_id, membro_id, forma) VALUES ('ci','destinatario-legado','e','membro-legado','MANUAL')").run())
      .toThrow(/PORTARIA_EVENTO_INCOMPATIVEL/)
    db.close()
  })

  it('impede converter escopo depois de criar estado de Portaria', () => {
    const db = banco()
    db.prepare("INSERT INTO portarias_evento (evento_id) VALUES ('e')").run()
    expect(() => db.prepare("UPDATE eventos SET abrangencia='NACIONAL', regional_gestao_id='r', regional_id='r', setor_id=NULL, destino_uf='RJ', destino_cidade_local='Rio de Janeiro' WHERE id='e'").run())
      .toThrow(/EVENTO_COM_PORTARIA_NAO_PODE_MUDAR_ESCOPO/)
    db.close()
  })

  it('impede conversao nacional com RSVP confirmado mesmo apos cancelamento da convocacao', () => {
    const db = banco()
    db.exec(`
      INSERT INTO casas (id, setor_id, nome) VALUES ('casa','s','Casa');
      INSERT INTO membros (id, nome, casa_id) VALUES ('m','Membro','casa');
      INSERT INTO convocacoes (id, evento_id, status, ativo) VALUES ('conv','e','PUBLICADA',1);
      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id) VALUES ('dest','conv','m');
      INSERT INTO rsvp (id, convocacao_destinatario_id, resposta, respondido_em, atualizado_em)
        VALUES ('rsvp','dest','PARTICIPAREI','2099-01-01','2099-01-01');
      UPDATE convocacoes SET status='CANCELADA', ativo=0 WHERE id='conv';
    `)
    expect(() => db.prepare("UPDATE eventos SET abrangencia='NACIONAL', regional_gestao_id='r', regional_id='r', setor_id=NULL, destino_uf='RJ', destino_cidade_local='Rio de Janeiro' WHERE id='e'").run())
      .toThrow(/EVENTO_COM_RSVP_CONFIRMADO_NAO_PODE_MUDAR_ESCOPO/)
    db.close()
  })

  it('permite conversao quando nao existe confirmacao de participacao', () => {
    const db = banco()
    db.exec(`
      INSERT INTO casas (id, setor_id, nome) VALUES ('casa','s','Casa');
      INSERT INTO membros (id, nome, casa_id) VALUES ('m','Membro','casa');
      INSERT INTO convocacoes (id, evento_id, status, ativo) VALUES ('conv','e','CANCELADA',0);
      INSERT INTO convocacao_destinatarios (id, convocacao_id, membro_id) VALUES ('dest','conv','m');
      INSERT INTO rsvp (id, convocacao_destinatario_id, resposta, respondido_em, atualizado_em)
        VALUES ('rsvp','dest','NAO_PARTICIPAREI','2099-01-01','2099-01-01');
    `)
    expect(() => db.prepare("UPDATE eventos SET abrangencia='NACIONAL', regional_gestao_id='r', regional_id='r', setor_id=NULL, destino_uf='RJ', destino_cidade_local='Rio de Janeiro' WHERE id='e'").run())
      .not.toThrow()
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
