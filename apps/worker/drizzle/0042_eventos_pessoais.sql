-- Nenhum evento existente é convertido implicitamente em pessoal.
ALTER TABLE eventos ADD COLUMN pessoal integer NOT NULL DEFAULT 0 CHECK (pessoal IN (0, 1));
ALTER TABLE eventos ADD COLUMN criador_membro_id text REFERENCES membros(id);

-- Recupera autoria auditada; organizador é apenas fallback para registros legados.
UPDATE eventos SET criador_membro_id = COALESCE(
  (SELECT ator_membro_id FROM auditoria_logs
   WHERE recurso_tipo = 'EVENTO' AND recurso_id = eventos.id AND acao = 'EVENTO_CRIADO'
     AND ator_membro_id IS NOT NULL ORDER BY criado_em, id LIMIT 1),
  (SELECT ator_membro_id FROM auditoria_logs
   WHERE recurso_tipo = 'SERIE_RECORRENCIA' AND recurso_id = eventos.serie_recorrencia_id
     AND acao = 'SERIE_RECORRENCIA_CRIADA' AND ator_membro_id IS NOT NULL ORDER BY criado_em, id LIMIT 1),
  organizador_membro_id
);
CREATE INDEX idx_eventos_criador_pessoal ON eventos (criador_membro_id, pessoal, ativo);

CREATE TRIGGER trg_evento_pessoal_insert BEFORE INSERT ON eventos
WHEN NEW.pessoal = 1 AND (NEW.casa_id IS NULL OR NEW.criador_membro_id IS NULL OR NEW.serie_recorrencia_id IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'EVENTO_PESSOAL_INVALIDO'); END;
CREATE TRIGGER trg_evento_pessoal_update BEFORE UPDATE ON eventos
WHEN NEW.pessoal = 1 AND (NEW.casa_id IS NULL OR NEW.criador_membro_id IS NULL OR NEW.serie_recorrencia_id IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'EVENTO_PESSOAL_INVALIDO'); END;
CREATE TRIGGER trg_convocacao_evento_pessoal BEFORE INSERT ON convocacoes
WHEN EXISTS (SELECT 1 FROM eventos WHERE id = NEW.evento_id AND pessoal = 1)
BEGIN SELECT RAISE(ABORT, 'EVENTO_PESSOAL_SEM_CONVOCACAO'); END;

CREATE TRIGGER trg_convocacao_evento_pessoal_update BEFORE UPDATE OF evento_id ON convocacoes
WHEN EXISTS (SELECT 1 FROM eventos WHERE id = NEW.evento_id AND pessoal = 1)
BEGIN SELECT RAISE(ABORT, 'EVENTO_PESSOAL_SEM_CONVOCACAO'); END;
