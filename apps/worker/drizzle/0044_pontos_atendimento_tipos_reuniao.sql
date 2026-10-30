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
-- Mesmo identificador indica alternativas institucionais, nunca inferidas por horario/titulo.
ALTER TABLE eventos ADD COLUMN grupo_equivalencia_id TEXT;
CREATE INDEX idx_eventos_grupo_equivalencia ON eventos(grupo_equivalencia_id);
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
WHEN NEW.setor_id<>OLD.setor_id AND (
 EXISTS(SELECT 1 FROM casas WHERE ponto_atendimento_id=OLD.id)
 OR EXISTS(SELECT 1 FROM eventos WHERE ponto_atendimento_id=OLD.id)
)
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

-- Evita concorrencia entre confirmacoes de alternativas do mesmo grupo.
-- A validacao ocorre no SQLite, dentro da propria escrita RSVP.
CREATE TRIGGER trg_rsvp_alternativa_insert BEFORE INSERT ON rsvp
WHEN NEW.resposta = 'PARTICIPAREI'
AND EXISTS (
 SELECT 1 FROM convocacao_destinatarios cd
 JOIN convocacoes c ON c.id = cd.convocacao_id
 JOIN eventos e ON e.id = c.evento_id
 JOIN convocacao_destinatarios outro_cd ON outro_cd.membro_id = cd.membro_id AND outro_cd.id <> cd.id
 JOIN convocacoes outro_c ON outro_c.id = outro_cd.convocacao_id AND outro_c.status = 'PUBLICADA' AND outro_c.ativo = 1
 JOIN eventos outro_e ON outro_e.id = outro_c.evento_id AND outro_e.id <> e.id
 JOIN rsvp outro_r ON outro_r.convocacao_destinatario_id = outro_cd.id AND outro_r.resposta = 'PARTICIPAREI'
 WHERE cd.id = NEW.convocacao_destinatario_id
 AND e.grupo_equivalencia_id IS NOT NULL
 AND e.grupo_equivalencia_id = outro_e.grupo_equivalencia_id
 AND e.tipo_reuniao_id = outro_e.tipo_reuniao_id
 AND e.setor_id = outro_e.setor_id
 AND e.ponto_atendimento_id IS NOT NULL AND outro_e.ponto_atendimento_id IS NOT NULL
 AND e.ponto_atendimento_id <> outro_e.ponto_atendimento_id
)
BEGIN SELECT RAISE(ABORT,'RSVP_ALTERNATIVA_JA_CONFIRMADA'); END;

CREATE TRIGGER trg_rsvp_alternativa_update BEFORE UPDATE OF resposta ON rsvp
WHEN NEW.resposta = 'PARTICIPAREI'
AND EXISTS (
 SELECT 1 FROM convocacao_destinatarios cd
 JOIN convocacoes c ON c.id = cd.convocacao_id
 JOIN eventos e ON e.id = c.evento_id
 JOIN convocacao_destinatarios outro_cd ON outro_cd.membro_id = cd.membro_id AND outro_cd.id <> cd.id
 JOIN convocacoes outro_c ON outro_c.id = outro_cd.convocacao_id AND outro_c.status = 'PUBLICADA' AND outro_c.ativo = 1
 JOIN eventos outro_e ON outro_e.id = outro_c.evento_id AND outro_e.id <> e.id
 JOIN rsvp outro_r ON outro_r.convocacao_destinatario_id = outro_cd.id AND outro_r.resposta = 'PARTICIPAREI'
 WHERE cd.id = NEW.convocacao_destinatario_id
 AND e.grupo_equivalencia_id IS NOT NULL
 AND e.grupo_equivalencia_id = outro_e.grupo_equivalencia_id
 AND e.tipo_reuniao_id = outro_e.tipo_reuniao_id
 AND e.setor_id = outro_e.setor_id
 AND e.ponto_atendimento_id IS NOT NULL AND outro_e.ponto_atendimento_id IS NOT NULL
 AND e.ponto_atendimento_id <> outro_e.ponto_atendimento_id
)
BEGIN SELECT RAISE(ABORT,'RSVP_ALTERNATIVA_JA_CONFIRMADA'); END;

-- Bloqueio no próprio banco: destinatários publicados não podem mudar de Ponto.
CREATE TRIGGER trg_eventos_ponto_publicado_update
BEFORE UPDATE OF ponto_atendimento_id ON eventos
WHEN NEW.ponto_atendimento_id IS NOT OLD.ponto_atendimento_id
AND EXISTS (SELECT 1 FROM convocacoes c
  WHERE c.evento_id=OLD.id AND c.status='PUBLICADA')
BEGIN SELECT RAISE(ABORT,'EVENTO_PONTO_COM_CONVOCACAO_PUBLICADA'); END;

-- A reclassificação não pode transformar confirmações existentes em alternativas conflitantes.
CREATE TRIGGER trg_eventos_equivalencia_confirmada_update
BEFORE UPDATE OF grupo_equivalencia_id,tipo_reuniao_id,ponto_atendimento_id,setor_id ON eventos
WHEN NEW.grupo_equivalencia_id IS NOT NULL
AND NEW.ponto_atendimento_id IS NOT NULL
AND NEW.tipo_reuniao_id IS NOT NULL
AND EXISTS (
 SELECT 1 FROM convocacoes c
 JOIN convocacao_destinatarios cd ON cd.convocacao_id=c.id
 JOIN rsvp r ON r.convocacao_destinatario_id=cd.id AND r.resposta='PARTICIPAREI'
 JOIN convocacao_destinatarios outro_cd ON outro_cd.membro_id=cd.membro_id
 JOIN convocacoes outro_c ON outro_c.id=outro_cd.convocacao_id
  AND outro_c.status='PUBLICADA' AND outro_c.ativo=1
 JOIN eventos outro_e ON outro_e.id=outro_c.evento_id AND outro_e.id<>OLD.id
 JOIN rsvp outro_r ON outro_r.convocacao_destinatario_id=outro_cd.id
  AND outro_r.resposta='PARTICIPAREI'
 WHERE c.evento_id=OLD.id AND c.status='PUBLICADA' AND c.ativo=1
 AND outro_e.grupo_equivalencia_id=NEW.grupo_equivalencia_id
 AND outro_e.tipo_reuniao_id=NEW.tipo_reuniao_id
 AND outro_e.setor_id=NEW.setor_id
 AND outro_e.ponto_atendimento_id IS NOT NULL
 AND outro_e.ponto_atendimento_id<>NEW.ponto_atendimento_id
)
BEGIN SELECT RAISE(ABORT,'EVENTO_EQUIVALENCIA_COM_RSVP_DUPLO'); END;
