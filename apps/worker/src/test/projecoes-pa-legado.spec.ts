import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq, and } from 'drizzle-orm'
import { setupDb } from './setup'
import { convocacaoDestinatarios } from '../db/schema'
import { condicaoMembroNoPaDoEvento } from '../services/projecao-convocacao-pa'
import { montarSnapshotFechamentoPortaria } from '../services/portaria-fechamento'

describe('PA-414 — projeções operacionais sem destinatários legados indevidos', () => {
  it('filtra PA vigente sem apagar destinatários nem afetar evento sem PA', async () => {
    const sqlite = new Database(':memory:')
    try {
      setupDb(sqlite)
      sqlite.exec(`
        INSERT INTO regionais (id,nome) VALUES ('reg','Regional');
        INSERT INTO administracoes (id,regional_id,nome) VALUES ('adm','reg','Adm');
        INSERT INTO setores (id,administracao_id,nome) VALUES ('set','adm','Setor');
        INSERT INTO pontos_atendimento (id,setor_id,nome) VALUES
          ('pa-a','set','PA A'),('pa-b','set','PA B');
        INSERT INTO casas (id,setor_id,nome,ponto_atendimento_id) VALUES
          ('casa-a','set','Casa A','pa-a'),('casa-b','set','Casa B','pa-b');
        INSERT INTO membros (id,nome,casa_id,ativo) VALUES
          ('m-a','Membro A','casa-a',1),('m-legado','Membro Legado','casa-b',1);
        INSERT INTO eventos (id,titulo,modalidade,inicio_em,fim_em,setor_id,ponto_atendimento_id,ativo)
          VALUES ('ev-a','PA A','PRESENCIAL','2099-01-01T10:00:00Z','2099-01-01T12:00:00Z','set','pa-a',1);
        INSERT INTO eventos (id,titulo,modalidade,inicio_em,fim_em,setor_id,ativo)
          VALUES ('ev-sem-pa','Sem PA','PRESENCIAL','2099-01-02T10:00:00Z','2099-01-02T12:00:00Z','set',1);
        INSERT INTO convocacoes (id,evento_id,status,ativo)
          VALUES ('cv-a','ev-a','PUBLICADA',1),('cv-sem','ev-sem-pa','PUBLICADA',1);
        INSERT INTO convocacao_destinatarios (id,convocacao_id,membro_id)
          VALUES ('dest-a','cv-a','m-a'),('dest-legado','cv-a','m-legado'),
                 ('dest-sem','cv-sem','m-legado');
      `)
      const db = drizzle(sqlite)
      const elegiveis = await db.select({ id: convocacaoDestinatarios.id })
        .from(convocacaoDestinatarios)
        .where(and(
          eq(convocacaoDestinatarios.convocacaoId, 'cv-a'),
          condicaoMembroNoPaDoEvento('ev-a', convocacaoDestinatarios.membroId),
        )).all()
      expect(elegiveis.map(x => x.id)).toEqual(['dest-a'])

      const previa = await montarSnapshotFechamentoPortaria(db, 'ev-a')
      expect(previa.resumo.totalConvocados).toBe(1)
      expect(previa.itens.filter(x => x.tipoPessoa === 'MEMBRO').map(x => x.nome))
        .toEqual(['Membro A'])

      const semPa = await db.select({ id: convocacaoDestinatarios.id })
        .from(convocacaoDestinatarios)
        .where(and(
          eq(convocacaoDestinatarios.convocacaoId, 'cv-sem'),
          condicaoMembroNoPaDoEvento('ev-sem-pa', convocacaoDestinatarios.membroId),
        )).all()
      expect(semPa.map(x => x.id)).toEqual(['dest-sem'])

      // A evidência legada permanece íntegra para auditoria/saneamento futuro.
      expect(sqlite.prepare('SELECT COUNT(*) AS total FROM convocacao_destinatarios')
        .get()).toMatchObject({ total: 3 })
    } finally {
      sqlite.close()
    }
  })
})
