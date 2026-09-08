-- Migration S09: Períodos e Alimentação

-- 1. Adicionar controle de turnos na tabela eventos
ALTER TABLE eventos ADD COLUMN possui_manha INTEGER NOT NULL DEFAULT 0;
ALTER TABLE eventos ADD COLUMN possui_tarde INTEGER NOT NULL DEFAULT 0;
ALTER TABLE eventos ADD COLUMN possui_noite INTEGER NOT NULL DEFAULT 0;

-- 2. Adicionar periodos_participacao no RSVP (Array JSON)
ALTER TABLE rsvp ADD COLUMN periodos_participacao TEXT;

-- 3. Tabela de Refeições do Evento (configurada pelo organizador)
CREATE TABLE evento_refeicoes (
  id TEXT PRIMARY KEY NOT NULL,
  evento_id TEXT NOT NULL REFERENCES eventos(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('CAFE_MANHA','ALMOCO','LANCHE','JANTAR')),
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX idx_evento_refeicoes_unico ON evento_refeicoes(evento_id, tipo);


