-- Migração aditiva: NÃO reconstruir eventos (preserva FKs, índices e triggers existentes).
-- regional_id representa a Regional responsável por eventos externos.
ALTER TABLE eventos ADD COLUMN abrangencia text NOT NULL DEFAULT 'TERRITORIAL';
ALTER TABLE eventos ADD COLUMN destino_uf text;
ALTER TABLE eventos ADD COLUMN destino_pais_codigo text;
ALTER TABLE eventos ADD COLUMN destino_cidade_local text;
ALTER TABLE eventos ADD COLUMN regional_gestao_id text REFERENCES regionais(id);
UPDATE eventos SET regional_gestao_id = regional_id WHERE regional_id IS NOT NULL;
CREATE INDEX idx_eventos_abrangencia ON eventos(abrangencia, ativo);
CREATE INDEX idx_eventos_abrangencia_gestao ON eventos(abrangencia, regional_gestao_id, ativo);

-- Ambiente externo desacoplado, com destino geográfico e Regional responsável.
CREATE TABLE eventos_destinos_externos (
  evento_id text PRIMARY KEY NOT NULL REFERENCES eventos(id),
  regional_id text NOT NULL REFERENCES regionais(id),
  abrangencia text NOT NULL CHECK (abrangencia IN ('NACIONAL','INTERNACIONAL')),
  uf text,
  municipio text,
  pais_codigo text,
  cidade text,
  CHECK ((abrangencia = 'NACIONAL' AND uf IS NOT NULL AND municipio IS NOT NULL AND pais_codigo IS NULL AND cidade IS NULL)
      OR (abrangencia = 'INTERNACIONAL' AND uf IS NULL AND municipio IS NULL AND pais_codigo IS NOT NULL AND cidade IS NOT NULL))
);
CREATE INDEX idx_eventos_destinos_externos_regional ON eventos_destinos_externos(regional_id, abrangencia);

CREATE TRIGGER trg_eventos_externos_validar_insert BEFORE INSERT ON eventos
WHEN NEW.abrangencia NOT IN ('TERRITORIAL','NACIONAL','INTERNACIONAL')
  OR (NEW.abrangencia = 'TERRITORIAL' AND (NEW.destino_uf IS NOT NULL OR NEW.destino_pais_codigo IS NOT NULL OR NEW.destino_cidade_local IS NOT NULL))
  OR (NEW.abrangencia IN ('NACIONAL','INTERNACIONAL') AND (
    NEW.regional_id IS NULL OR NEW.regional_gestao_id IS NULL OR NEW.regional_id <> NEW.regional_gestao_id
    OR NEW.administracao_id IS NOT NULL OR NEW.setor_id IS NOT NULL OR NEW.casa_id IS NOT NULL OR NEW.grupo_trabalho_id IS NOT NULL
    OR NEW.destino_cidade_local IS NULL OR length(trim(NEW.destino_cidade_local)) < 2
    OR (NEW.abrangencia = 'NACIONAL' AND (NEW.destino_uf IS NULL OR NEW.destino_uf NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') OR NEW.destino_pais_codigo IS NOT NULL))
    OR (NEW.abrangencia = 'INTERNACIONAL' AND (NEW.destino_uf IS NOT NULL OR NEW.destino_pais_codigo IS NULL OR NEW.destino_pais_codigo NOT GLOB '[A-Z][A-Z]'))
  ))
BEGIN SELECT RAISE(ABORT, 'EVENTO_ABRANGENCIA_DESTINO_INVALIDO'); END;

CREATE TRIGGER trg_eventos_externos_validar_update BEFORE UPDATE ON eventos
WHEN NEW.abrangencia NOT IN ('TERRITORIAL','NACIONAL','INTERNACIONAL')
  OR (NEW.abrangencia = 'TERRITORIAL' AND (NEW.destino_uf IS NOT NULL OR NEW.destino_pais_codigo IS NOT NULL OR NEW.destino_cidade_local IS NOT NULL))
  OR (NEW.abrangencia IN ('NACIONAL','INTERNACIONAL') AND (
    NEW.regional_id IS NULL OR NEW.regional_gestao_id IS NULL OR NEW.regional_id <> NEW.regional_gestao_id
    OR NEW.administracao_id IS NOT NULL OR NEW.setor_id IS NOT NULL OR NEW.casa_id IS NOT NULL OR NEW.grupo_trabalho_id IS NOT NULL
    OR NEW.destino_cidade_local IS NULL OR length(trim(NEW.destino_cidade_local)) < 2
    OR (NEW.abrangencia = 'NACIONAL' AND (NEW.destino_uf IS NULL OR NEW.destino_uf NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') OR NEW.destino_pais_codigo IS NOT NULL))
    OR (NEW.abrangencia = 'INTERNACIONAL' AND (NEW.destino_uf IS NOT NULL OR NEW.destino_pais_codigo IS NULL OR NEW.destino_pais_codigo NOT GLOB '[A-Z][A-Z]'))
  ))
BEGIN SELECT RAISE(ABORT, 'EVENTO_ABRANGENCIA_DESTINO_INVALIDO'); END;

CREATE TRIGGER trg_eventos_externos_sync_insert AFTER INSERT ON eventos
WHEN NEW.abrangencia IN ('NACIONAL','INTERNACIONAL')
BEGIN
 INSERT INTO eventos_destinos_externos(evento_id,regional_id,abrangencia,uf,municipio,pais_codigo,cidade)
 VALUES(NEW.id,NEW.regional_gestao_id,NEW.abrangencia,
 CASE WHEN NEW.abrangencia='NACIONAL' THEN NEW.destino_uf END,
 CASE WHEN NEW.abrangencia='NACIONAL' THEN NEW.destino_cidade_local END,
 CASE WHEN NEW.abrangencia='INTERNACIONAL' THEN NEW.destino_pais_codigo END,
 CASE WHEN NEW.abrangencia='INTERNACIONAL' THEN NEW.destino_cidade_local END);
END;
CREATE TRIGGER trg_eventos_externos_sync_update AFTER UPDATE ON eventos
BEGIN
 DELETE FROM eventos_destinos_externos WHERE evento_id = NEW.id;
 INSERT INTO eventos_destinos_externos(evento_id,regional_id,abrangencia,uf,municipio,pais_codigo,cidade)
 SELECT NEW.id,NEW.regional_gestao_id,NEW.abrangencia,
 CASE WHEN NEW.abrangencia='NACIONAL' THEN NEW.destino_uf END,
 CASE WHEN NEW.abrangencia='NACIONAL' THEN NEW.destino_cidade_local END,
 CASE WHEN NEW.abrangencia='INTERNACIONAL' THEN NEW.destino_pais_codigo END,
 CASE WHEN NEW.abrangencia='INTERNACIONAL' THEN NEW.destino_cidade_local END
 WHERE NEW.abrangencia IN ('NACIONAL','INTERNACIONAL');
END;
CREATE TRIGGER trg_eventos_externos_sync_delete AFTER DELETE ON eventos
BEGIN DELETE FROM eventos_destinos_externos WHERE evento_id=OLD.id; END;

-- Evento Próprio externo dispensa Casa, mas segue exclusivo do criador.
DROP TRIGGER IF EXISTS trg_evento_pessoal_insert;
DROP TRIGGER IF EXISTS trg_evento_pessoal_update;
CREATE TRIGGER trg_evento_pessoal_insert BEFORE INSERT ON eventos
WHEN NEW.pessoal=1 AND (NEW.criador_membro_id IS NULL OR NEW.serie_recorrencia_id IS NOT NULL OR (NEW.abrangencia='TERRITORIAL' AND NEW.casa_id IS NULL))
BEGIN SELECT RAISE(ABORT,'EVENTO_PESSOAL_INVALIDO'); END;
CREATE TRIGGER trg_evento_pessoal_update BEFORE UPDATE ON eventos
WHEN NEW.pessoal=1 AND (NEW.criador_membro_id IS NULL OR NEW.serie_recorrencia_id IS NOT NULL OR (NEW.abrangencia='TERRITORIAL' AND NEW.casa_id IS NULL))
BEGIN SELECT RAISE(ABORT,'EVENTO_PESSOAL_INVALIDO'); END;
