-- Vinculação institucional explícita sem presumir jurisdição de locais legados.
-- Locais legados ficam com escopo NULL e permanecem sob administração Master.
ALTER TABLE locais ADD COLUMN escopo_tipo text
  CHECK (escopo_tipo IS NULL OR escopo_tipo IN ('REGIONAL','ADMINISTRACAO','SETOR','CASA','GRUPO_TRABALHO'));
ALTER TABLE locais ADD COLUMN escopo_id text;
CREATE INDEX idx_locais_escopo_institucional ON locais (escopo_tipo, escopo_id, ativo);
CREATE TRIGGER trg_locais_escopo_insert
BEFORE INSERT ON locais
WHEN (NEW.proprietario_membro_id IS NOT NULL AND (NEW.escopo_tipo IS NOT NULL OR NEW.escopo_id IS NOT NULL))
  OR ((NEW.escopo_tipo IS NULL) <> (NEW.escopo_id IS NULL))
BEGIN SELECT RAISE(ABORT, 'LOCAL_ESCOPO_INVALIDO'); END;
CREATE TRIGGER trg_locais_escopo_update
BEFORE UPDATE ON locais
WHEN (NEW.proprietario_membro_id IS NOT NULL AND (NEW.escopo_tipo IS NOT NULL OR NEW.escopo_id IS NOT NULL))
  OR ((NEW.escopo_tipo IS NULL) <> (NEW.escopo_id IS NULL))
BEGIN SELECT RAISE(ABORT, 'LOCAL_ESCOPO_INVALIDO'); END;
