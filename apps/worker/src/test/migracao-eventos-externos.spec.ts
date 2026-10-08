import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'

describe('migration 0043 — eventos externos', () => {
  it('preserva eventos/convocações e converte legado para TERRITORIAL', () => {
    const sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')

    sqlite.exec(`
      CREATE TABLE regionais (id text PRIMARY KEY, nome text, ativo integer DEFAULT 1);
      CREATE TABLE administracoes (id text PRIMARY KEY, regional_id text REFERENCES regionais(id));
      CREATE TABLE setores (id text PRIMARY KEY, administracao_id text REFERENCES administracoes(id));
      CREATE TABLE casas (id text PRIMARY KEY, setor_id text REFERENCES setores(id));
      CREATE TABLE grupos_trabalho (id text PRIMARY KEY);
      CREATE TABLE membros (id text PRIMARY KEY);
      CREATE TABLE locais (id text PRIMARY KEY);
      CREATE TABLE espacos_local (id text PRIMARY KEY);
      CREATE TABLE series_recorrencia (id text PRIMARY KEY);

      CREATE TABLE eventos (
        id text PRIMARY KEY NOT NULL,
        pessoal integer DEFAULT 0 NOT NULL CHECK (pessoal IN (0, 1)),
        criador_membro_id text REFERENCES membros(id),
        titulo text NOT NULL,
        descricao text,
        pauta text,
        modalidade text NOT NULL,
        inicio_em text NOT NULL,
        fim_em text NOT NULL,
        agenda_revisao text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        agenda_aviso text,
        local_id text REFERENCES locais(id),
        espaco_id text REFERENCES espacos_local(id),
        url_online text,
        organizador_membro_id text REFERENCES membros(id),
        regional_id text REFERENCES regionais(id),
        administracao_id text REFERENCES administracoes(id),
        setor_id text REFERENCES setores(id),
        casa_id text REFERENCES casas(id),
        grupo_trabalho_id text REFERENCES grupos_trabalho(id),
        observacoes text,
        serie_recorrencia_id text REFERENCES series_recorrencia(id),
        recorrencia_origem_inicio_em text,
        recorrencia_excecao integer DEFAULT 0 NOT NULL,
        possui_manha integer DEFAULT 0 NOT NULL,
        possui_tarde integer DEFAULT 0 NOT NULL,
        possui_noite integer DEFAULT 0 NOT NULL,
        ativo integer DEFAULT 1 NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT check_evento_escopo_unico CHECK (
          (CASE WHEN regional_id IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN administracao_id IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN setor_id IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN casa_id IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN grupo_trabalho_id IS NOT NULL THEN 1 ELSE 0 END) = 1
        )
      );
      CREATE TABLE convocacoes (
        id text PRIMARY KEY NOT NULL,
        evento_id text NOT NULL REFERENCES eventos(id),
        status text NOT NULL,
        ativo integer DEFAULT 1 NOT NULL
      );

      CREATE TRIGGER trg_convocacao_nao_ativar_em_evento_inativo_insert
      BEFORE INSERT ON convocacoes WHEN EXISTS (SELECT 1 FROM eventos WHERE id = NEW.evento_id AND ativo = 0)
      BEGIN SELECT RAISE(ABORT, 'CONVOCACAO_EM_EVENTO_INATIVO'); END;
      CREATE TRIGGER trg_convocacao_nao_ativar_em_evento_inativo_update
      BEFORE UPDATE OF evento_id, ativo, status ON convocacoes
      WHEN EXISTS (SELECT 1 FROM eventos WHERE id = NEW.evento_id AND ativo = 0)
      BEGIN SELECT RAISE(ABORT, 'CONVOCACAO_EM_EVENTO_INATIVO'); END;
      CREATE TRIGGER trg_convocacao_evento_pessoal
      BEFORE INSERT ON convocacoes WHEN EXISTS (SELECT 1 FROM eventos WHERE id = NEW.evento_id AND pessoal = 1)
      BEGIN SELECT RAISE(ABORT, 'EVENTO_PESSOAL_SEM_CONVOCACAO'); END;
      CREATE TRIGGER trg_convocacao_evento_pessoal_update
      BEFORE UPDATE OF evento_id ON convocacoes
      WHEN EXISTS (SELECT 1 FROM eventos WHERE id = NEW.evento_id AND pessoal = 1)
      BEGIN SELECT RAISE(ABORT, 'EVENTO_PESSOAL_SEM_CONVOCACAO'); END;

      INSERT INTO regionais (id, nome) VALUES ('reg-1', 'Regional SP');
      INSERT INTO membros (id) VALUES ('membro-criador'), ('membro-convidado');
      INSERT INTO eventos (
        id, titulo, modalidade, inicio_em, fim_em, regional_id, ativo
      ) VALUES (
        'ev-legado', 'Evento legado', 'ONLINE',
        '2030-01-01T10:00:00Z', '2030-01-01T11:00:00Z', 'reg-1', 1
      );
      INSERT INTO convocacoes (id, evento_id, status, ativo)
      VALUES ('conv-legada', 'ev-legado', 'PUBLICADA', 1);
    `)

    const migration = readFileSync(
      resolve(process.cwd(), 'drizzle/0043_eventos_externos.sql'),
      'utf8'
    )

    sqlite.exec('BEGIN;')
    sqlite.exec(migration)
    sqlite.exec('COMMIT;')

    sqlite.prepare(`
      INSERT INTO eventos (id, titulo, modalidade, inicio_em, fim_em,
        abrangencia, destino_uf, destino_cidade_local, regional_gestao_id, regional_id)
      VALUES ('ev-externo-apos-migracao', 'Atendimento MG', 'PRESENCIAL',
        '2030-02-01T10:00:00Z', '2030-02-01T11:00:00Z',
        'NACIONAL', 'MG', 'Belo Horizonte', 'reg-1', 'reg-1')
    `).run()
    const externo = sqlite.prepare(
      "SELECT regional_id, regional_gestao_id, abrangencia FROM eventos WHERE id = 'ev-externo-apos-migracao'"
    ).get() as any
    expect(externo).toEqual({
      regional_id: 'reg-1', regional_gestao_id: 'reg-1', abrangencia: 'NACIONAL'
    })

    expect(sqlite.prepare(
      "SELECT regional_id, abrangencia, uf, municipio FROM eventos_destinos_externos WHERE evento_id = 'ev-externo-apos-migracao'"
    ).get()).toEqual({ regional_id: 'reg-1', abrangencia: 'NACIONAL', uf: 'MG', municipio: 'Belo Horizonte' })

    sqlite.prepare("UPDATE eventos SET destino_cidade_local = 'Uberlândia' WHERE id = 'ev-externo-apos-migracao'").run()
    expect((sqlite.prepare("SELECT municipio FROM eventos_destinos_externos WHERE evento_id = 'ev-externo-apos-migracao'").get() as any).municipio).toBe('Uberlândia')

    sqlite.prepare(`
      INSERT INTO eventos (id, titulo, modalidade, inicio_em, fim_em,
        abrangencia, destino_pais_codigo, destino_cidade_local, regional_gestao_id, regional_id)
      VALUES ('ev-int', 'Atendimento Portugal', 'PRESENCIAL',
        '2030-02-02T10:00:00Z', '2030-02-02T11:00:00Z',
        'INTERNACIONAL', 'PT', 'Lisboa', 'reg-1', 'reg-1')
    `).run()
    expect((sqlite.prepare("SELECT pais_codigo, cidade FROM eventos_destinos_externos WHERE evento_id = 'ev-int'").get() as any)).toEqual({pais_codigo:'PT', cidade:'Lisboa'})
    expect(() => sqlite.prepare(`
      INSERT INTO eventos (id, titulo, modalidade, inicio_em, fim_em, abrangencia,
        destino_uf, destino_cidade_local, regional_gestao_id)
      VALUES ('invalid', 'Sem regional', 'PRESENCIAL', '2030-02-03T10:00:00Z',
        '2030-02-03T11:00:00Z', 'NACIONAL', 'MG', 'Belo Horizonte', 'reg-1')
    `).run()).toThrow()

    sqlite.prepare(`
      INSERT INTO eventos_participantes_externos(evento_id,membro_id,status,criado_por_membro_id)
      VALUES ('ev-externo-apos-migracao','membro-convidado','CONVIDADO','membro-criador')
    `).run()
    expect((sqlite.prepare(
      "SELECT status FROM eventos_participantes_externos WHERE evento_id='ev-externo-apos-migracao' AND membro_id='membro-convidado'"
    ).get() as any).status).toBe('CONVIDADO')
    expect(() => sqlite.prepare(`
      INSERT INTO eventos_participantes_externos(evento_id,membro_id,status,criado_por_membro_id)
      VALUES ('ev-legado','membro-convidado','CONVIDADO','membro-criador')
    `).run()).toThrow()

    const evento = sqlite.prepare(`
      SELECT abrangencia, regional_gestao_id, regional_id,
             destino_uf, destino_pais_codigo, destino_cidade_local
      FROM eventos WHERE id = 'ev-legado'
    `).get() as any
    const convocacao = sqlite.prepare(
      "SELECT evento_id FROM convocacoes WHERE id = 'conv-legada'"
    ).get() as any
    const fk = sqlite.pragma('foreign_key_check') as any[]

    expect(evento).toEqual({
      abrangencia: 'TERRITORIAL',
      regional_gestao_id: 'reg-1',
      regional_id: 'reg-1',
      destino_uf: null,
      destino_pais_codigo: null,
      destino_cidade_local: null,
    })
    expect(convocacao.evento_id).toBe('ev-legado')
    expect(fk).toEqual([])
  })
})
