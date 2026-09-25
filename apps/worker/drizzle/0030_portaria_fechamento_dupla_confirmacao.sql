CREATE TABLE IF NOT EXISTS portaria_solicitacoes_fechamento (
  evento_id text PRIMARY KEY NOT NULL,
  solicitado_por_membro_id text,
  solicitado_por_credencial_id text,
  solicitado_em text NOT NULL,
  confirmado_por_membro_id text,
  confirmado_em text,
  created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (evento_id) REFERENCES eventos(id),
  FOREIGN KEY (solicitado_por_membro_id) REFERENCES membros(id),
  FOREIGN KEY (solicitado_por_credencial_id) REFERENCES credenciais_operador_portaria_evento(id),
  FOREIGN KEY (confirmado_por_membro_id) REFERENCES membros(id)
);
