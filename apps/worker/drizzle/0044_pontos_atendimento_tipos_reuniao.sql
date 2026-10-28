-- P0: estrutura aditiva e retrocompativel.
CREATE TABLE pontos_atendimento (
 id TEXT PRIMARY KEY NOT NULL,
 setor_id TEXT NOT NULL REFERENCES setores(id),
 nome TEXT NOT NULL,
 codigo TEXT,
 ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_pontos_atendimento_setor ON pontos_atendimento(setor_id,ativo);
CREATE UNIQUE INDEX uq_pontos_atendimento_nome_setor ON pontos_atendimento(setor_id,nome);

CREATE TABLE tipos_reuniao (
 id TEXT PRIMARY KEY NOT NULL,
 nome TEXT NOT NULL,
 codigo TEXT NOT NULL UNIQUE,
 ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX uq_tipos_reuniao_nome ON tipos_reuniao(nome);

-- Vinculo opt-in para classificar gradualmente Casas ja existentes.
ALTER TABLE casas ADD COLUMN ponto_atendimento_id TEXT REFERENCES pontos_atendimento(id);
CREATE INDEX idx_casas_ponto_atendimento ON casas(ponto_atendimento_id);

-- Eventos antigos permanecem validos; titulo historico nao e alterado.
ALTER TABLE eventos ADD COLUMN ponto_atendimento_id TEXT REFERENCES pontos_atendimento(id);
ALTER TABLE eventos ADD COLUMN tipo_reuniao_id TEXT REFERENCES tipos_reuniao(id);
CREATE INDEX idx_eventos_ponto_atendimento ON eventos(ponto_atendimento_id,inicio_em);
CREATE INDEX idx_eventos_tipo_reuniao ON eventos(tipo_reuniao_id,inicio_em);

-- Garante que o Ponto e a Casa estejam no Setor declarado.
CREATE TRIGGER trg_casas_ponto_setor_insert BEFORE INSERT ON casas
WHEN NEW.ponto_atendimento_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM pontos_atendimento p WHERE p.id=NEW.ponto_atendimento_id AND p.setor_id=NEW.setor_id
)
BEGIN SELECT RAISE(ABORT,'CASA_PONTO_SETOR_DIVERGENTE'); END;
CREATE TRIGGER trg_casas_ponto_setor_update BEFORE UPDATE OF setor_id,ponto_atendimento_id ON casas
WHEN NEW.ponto_atendimento_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM pontos_atendimento p WHERE p.id=NEW.ponto_atendimento_id AND p.setor_id=NEW.setor_id
)
BEGIN SELECT RAISE(ABORT,'CASA_PONTO_SETOR_DIVERGENTE'); END;

CREATE TRIGGER trg_pontos_setor_update BEFORE UPDATE OF setor_id ON pontos_atendimento
WHEN NEW.setor_id<>OLD.setor_id AND EXISTS(SELECT 1 FROM casas WHERE ponto_atendimento_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'PONTO_COM_CASAS_VINCULADAS'); END;

CREATE TRIGGER trg_eventos_ponto_setor_insert BEFORE INSERT ON eventos
WHEN NEW.ponto_atendimento_id IS NOT NULL AND (
 NEW.abrangencia <> 'TERRITORIAL' OR NEW.setor_id IS NULL OR
 NOT EXISTS (SELECT 1 FROM pontos_atendimento p WHERE p.id=NEW.ponto_atendimento_id AND p.setor_id=NEW.setor_id)
)
BEGIN SELECT RAISE(ABORT,'EVENTO_PONTO_SETOR_DIVERGENTE'); END;
CREATE TRIGGER trg_eventos_ponto_setor_update BEFORE UPDATE OF ponto_atendimento_id,setor_id,abrangencia ON eventos
WHEN NEW.ponto_atendimento_id IS NOT NULL AND (
 NEW.abrangencia <> 'TERRITORIAL' OR NEW.setor_id IS NULL OR
 NOT EXISTS (SELECT 1 FROM pontos_atendimento p WHERE p.id=NEW.ponto_atendimento_id AND p.setor_id=NEW.setor_id)
)
BEGIN SELECT RAISE(ABORT,'EVENTO_PONTO_SETOR_DIVERGENTE'); END;
