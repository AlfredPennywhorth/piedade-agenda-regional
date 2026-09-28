-- Espaços internos de um Local e vínculo opcional com Eventos/Séries.

CREATE TABLE IF NOT EXISTS espacos_local (
  id text PRIMARY KEY NOT NULL,
  local_id text NOT NULL,
  nome text NOT NULL,
  descricao text,
  capacidade integer,
  ativo integer DEFAULT 1 NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (local_id) REFERENCES locais(id)
);

CREATE INDEX IF NOT EXISTS idx_espacos_local_local
  ON espacos_local(local_id, ativo);

CREATE UNIQUE INDEX IF NOT EXISTS idx_espacos_local_nome_ativo
  ON espacos_local(local_id, nome)
  WHERE ativo = 1;

ALTER TABLE eventos ADD COLUMN espaco_id text REFERENCES espacos_local(id);
ALTER TABLE series_recorrencia ADD COLUMN espaco_id text REFERENCES espacos_local(id);
