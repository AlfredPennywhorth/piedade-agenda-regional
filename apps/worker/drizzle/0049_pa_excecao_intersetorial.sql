-- Exceção operacional explícita: Casa mantém seu Setor institucional.
-- Apenas uma autorização de atendimento intersetorial por Casa.
CREATE TABLE casas_pontos_excecoes (
 casa_id TEXT PRIMARY KEY NOT NULL REFERENCES casas(id),
 ponto_atendimento_id TEXT NOT NULL REFERENCES pontos_atendimento(id),
 motivo TEXT NOT NULL CHECK (length(trim(motivo)) >= 5),
 autorizado_por_membro_id TEXT REFERENCES membros(id),
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_excecoes_ponto ON casas_pontos_excecoes(ponto_atendimento_id);
DROP TRIGGER trg_casas_ponto_setor_insert;
DROP TRIGGER trg_casas_ponto_setor_update;
CREATE TRIGGER trg_casas_ponto_setor_insert BEFORE INSERT ON casas
WHEN NEW.ponto_atendimento_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM pontos_atendimento p WHERE p.id=NEW.ponto_atendimento_id AND p.setor_id=NEW.setor_id
) AND NOT EXISTS (
 SELECT 1 FROM casas_pontos_excecoes x WHERE x.casa_id=NEW.id AND x.ponto_atendimento_id=NEW.ponto_atendimento_id
)
BEGIN SELECT RAISE(ABORT,'CASA_PONTO_SETOR_DIVERGENTE'); END;
CREATE TRIGGER trg_casas_ponto_setor_update BEFORE UPDATE OF setor_id,ponto_atendimento_id ON casas
WHEN NEW.ponto_atendimento_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM pontos_atendimento p WHERE p.id=NEW.ponto_atendimento_id AND p.setor_id=NEW.setor_id
) AND NOT EXISTS (
 SELECT 1 FROM casas_pontos_excecoes x WHERE x.casa_id=NEW.id AND x.ponto_atendimento_id=NEW.ponto_atendimento_id
)
BEGIN SELECT RAISE(ABORT,'CASA_PONTO_SETOR_DIVERGENTE'); END;
-- Uma autorização não pode ser apagada enquanto for usada por vínculo intersetorial.
CREATE TRIGGER trg_excecao_delete_guard BEFORE DELETE ON casas_pontos_excecoes
WHEN EXISTS (SELECT 1 FROM casas c JOIN pontos_atendimento p ON p.id=c.ponto_atendimento_id
 WHERE c.id=OLD.casa_id AND c.ponto_atendimento_id=OLD.ponto_atendimento_id AND c.setor_id<>p.setor_id)
BEGIN SELECT RAISE(ABORT,'EXCECAO_EM_USO'); END;
