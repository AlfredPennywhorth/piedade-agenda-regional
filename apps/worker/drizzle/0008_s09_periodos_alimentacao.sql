-- Migration S09: Períodos e Alimentação

-- 1. Adicionar controle de turnos na tabela eventos
ALTER TABLE eventos ADD COLUMN possui_manha INTEGER NOT NULL DEFAULT 0;
ALTER TABLE eventos ADD COLUMN possui_tarde INTEGER NOT NULL DEFAULT 0;

-- 2. Adicionar período de participação no RSVP com CHECK
ALTER TABLE rsvp ADD COLUMN periodo_participacao TEXT
  CHECK (
    periodo_participacao IS NULL OR
    periodo_participacao IN ('MANHA','TARDE','INTEGRAL')
  );

-- 3. Tabela de Refeições do Evento (configurada pelo organizador)
CREATE TABLE evento_refeicoes (
  id TEXT PRIMARY KEY NOT NULL,
  evento_id TEXT NOT NULL REFERENCES eventos(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('CAFE_MANHA','ALMOCO','LANCHE_TARDE')),
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX idx_evento_refeicoes_unico ON evento_refeicoes(evento_id, tipo);

-- 4. Tabela de Seleções de Refeição do Participante (via RSVP)
CREATE TABLE rsvp_refeicoes (
  id TEXT PRIMARY KEY NOT NULL,
  rsvp_id TEXT NOT NULL REFERENCES rsvp(id),
  evento_refeicao_id TEXT NOT NULL REFERENCES evento_refeicoes(id),
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX idx_rsvp_refeicoes_unico ON rsvp_refeicoes(rsvp_id, evento_refeicao_id);
