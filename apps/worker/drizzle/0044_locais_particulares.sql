-- Locais existentes permanecem institucionais (proprietario_membro_id NULL).
ALTER TABLE locais ADD COLUMN proprietario_membro_id text REFERENCES membros(id);
CREATE INDEX idx_locais_proprietario ON locais(proprietario_membro_id, ativo);

-- Espaços particulares pertencem necessariamente ao dono de seu local.
-- O dono não pode ser alterado por API de cadastro institucional.
ALTER TABLE espacos_local ADD COLUMN proprietario_membro_id text REFERENCES membros(id);
CREATE INDEX idx_espacos_local_proprietario ON espacos_local(proprietario_membro_id, ativo);
CREATE TRIGGER trg_espaco_particular_proprietario_insert
BEFORE INSERT ON espacos_local
WHEN (SELECT proprietario_membro_id FROM locais WHERE id=NEW.local_id) IS NOT NEW.proprietario_membro_id
BEGIN SELECT RAISE(ABORT,'ESPACO_PRIVACIDADE_INVALIDA'); END;
CREATE TRIGGER trg_espaco_particular_proprietario_update
BEFORE UPDATE ON espacos_local
WHEN (SELECT proprietario_membro_id FROM locais WHERE id=NEW.local_id) IS NOT NEW.proprietario_membro_id
BEGIN SELECT RAISE(ABORT,'ESPACO_PRIVACIDADE_INVALIDA'); END;

-- Local privado não pode ser utilizado em eventos institucionais ou de terceiros.
CREATE TRIGGER trg_evento_local_particular_insert
BEFORE INSERT ON eventos
WHEN NEW.local_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM locais l WHERE l.id=NEW.local_id
  AND l.proprietario_membro_id IS NOT NULL
  AND (NEW.pessoal <> 1 OR NEW.criador_membro_id IS NOT l.proprietario_membro_id)
)
BEGIN SELECT RAISE(ABORT,'LOCAL_PARTICULAR_SEM_AUTORIZACAO'); END;
CREATE TRIGGER trg_evento_local_particular_update
BEFORE UPDATE ON eventos
WHEN NEW.local_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM locais l WHERE l.id=NEW.local_id
  AND l.proprietario_membro_id IS NOT NULL
  AND (NEW.pessoal <> 1 OR NEW.criador_membro_id IS NOT l.proprietario_membro_id)
)
BEGIN SELECT RAISE(ABORT,'LOCAL_PARTICULAR_SEM_AUTORIZACAO'); END;
