CREATE TABLE IF NOT EXISTS agenda_prioridades_conflito (
  id text PRIMARY KEY NOT NULL,
  membro_id text NOT NULL,
  evento_id text NOT NULL,
  priorizado_em text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (membro_id) REFERENCES membros(id),
  FOREIGN KEY (evento_id) REFERENCES eventos(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_prioridade_membro_evento
  ON agenda_prioridades_conflito (membro_id, evento_id);

CREATE INDEX IF NOT EXISTS idx_agenda_prioridade_membro
  ON agenda_prioridades_conflito (membro_id);
