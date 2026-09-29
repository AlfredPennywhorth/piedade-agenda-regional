-- Garante no banco a regra de uma única convocação por evento.
-- A migration falha deliberadamente se o ambiente já possuir duplicidades,
-- evitando apagar ou fundir histórico automaticamente.
DROP INDEX IF EXISTS idx_convocacoes_evento_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_convocacoes_evento_unico
  ON convocacoes (evento_id);
