-- Preserva o arquivo emitido e seus dados institucionais para a ata.
-- Sem FK para fechamento_id: reabertura pode remover o fechamento antigo;
-- mantém o PDF anterior como registro histórico (e bloqueia reemissão divergente).
CREATE TABLE lista_presenca_pdf_atas (
  evento_id TEXT PRIMARY KEY NOT NULL REFERENCES eventos(id),
  fechamento_id TEXT NOT NULL,
  documento_pdf TEXT NOT NULL,
  emitido_em TEXT NOT NULL,
  emitido_por_membro_id TEXT REFERENCES membros(id)
);
