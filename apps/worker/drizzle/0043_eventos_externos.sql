ALTER TABLE eventos ADD COLUMN abrangencia text NOT NULL DEFAULT 'TERRITORIAL';
ALTER TABLE eventos ADD COLUMN destino_uf text;
ALTER TABLE eventos ADD COLUMN destino_pais_codigo text;
ALTER TABLE eventos ADD COLUMN destino_cidade_local text;
ALTER TABLE eventos ADD COLUMN regional_gestao_id text REFERENCES regionais(id);

UPDATE eventos
SET regional_gestao_id = regional_id
WHERE regional_id IS NOT NULL;

CREATE INDEX idx_eventos_abrangencia ON eventos (abrangencia, ativo);
CREATE INDEX idx_eventos_abrangencia_gestao ON eventos (abrangencia, regional_gestao_id, ativo);

CREATE TRIGGER trg_evento_abrangencia_insert
BEFORE INSERT ON eventos
WHEN
  (
    NEW.abrangencia = 'TERRITORIAL'
    AND (
      NEW.destino_uf IS NOT NULL
      OR NEW.destino_pais_codigo IS NOT NULL
      OR NEW.destino_cidade_local IS NOT NULL
    )
  )
  OR
  (
    NEW.abrangencia = 'NACIONAL'
    AND (
      NEW.regional_gestao_id IS NULL
      OR NEW.regional_id IS NOT NULL
      OR NEW.administracao_id IS NOT NULL
      OR NEW.setor_id IS NOT NULL
      OR NEW.casa_id IS NOT NULL
      OR NEW.grupo_trabalho_id IS NOT NULL
      OR NEW.destino_uf NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
      OR NEW.destino_pais_codigo IS NOT NULL
      OR NEW.destino_cidade_local IS NULL
      OR length(trim(NEW.destino_cidade_local)) < 2
    )
  )
  OR
  (
    NEW.abrangencia = 'INTERNACIONAL'
    AND (
      NEW.regional_gestao_id IS NULL
      OR NEW.regional_id IS NOT NULL
      OR NEW.administracao_id IS NOT NULL
      OR NEW.setor_id IS NOT NULL
      OR NEW.casa_id IS NOT NULL
      OR NEW.grupo_trabalho_id IS NOT NULL
      OR NEW.destino_uf IS NOT NULL
      OR NEW.destino_pais_codigo IS NULL
      OR length(NEW.destino_pais_codigo) <> 2
      OR NEW.destino_pais_codigo NOT GLOB '[A-Z][A-Z]'
      OR NEW.destino_cidade_local IS NULL
      OR length(trim(NEW.destino_cidade_local)) < 2
    )
  )
  OR NEW.abrangencia NOT IN ('TERRITORIAL','NACIONAL','INTERNACIONAL')
BEGIN
  SELECT RAISE(ABORT, 'EVENTO_ABRANGENCIA_DESTINO_INVALIDO');
END;

CREATE TRIGGER trg_evento_abrangencia_update
BEFORE UPDATE OF abrangencia, destino_uf, destino_pais_codigo, destino_cidade_local,
  regional_gestao_id, regional_id, administracao_id, setor_id, casa_id, grupo_trabalho_id
ON eventos
WHEN
  (
    NEW.abrangencia = 'TERRITORIAL'
    AND (
      NEW.destino_uf IS NOT NULL
      OR NEW.destino_pais_codigo IS NOT NULL
      OR NEW.destino_cidade_local IS NOT NULL
    )
  )
  OR
  (
    NEW.abrangencia = 'NACIONAL'
    AND (
      NEW.regional_gestao_id IS NULL
      OR NEW.regional_id IS NOT NULL
      OR NEW.administracao_id IS NOT NULL
      OR NEW.setor_id IS NOT NULL
      OR NEW.casa_id IS NOT NULL
      OR NEW.grupo_trabalho_id IS NOT NULL
      OR NEW.destino_uf NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
      OR NEW.destino_pais_codigo IS NOT NULL
      OR NEW.destino_cidade_local IS NULL
      OR length(trim(NEW.destino_cidade_local)) < 2
    )
  )
  OR
  (
    NEW.abrangencia = 'INTERNACIONAL'
    AND (
      NEW.regional_gestao_id IS NULL
      OR NEW.regional_id IS NOT NULL
      OR NEW.administracao_id IS NOT NULL
      OR NEW.setor_id IS NOT NULL
      OR NEW.casa_id IS NOT NULL
      OR NEW.grupo_trabalho_id IS NOT NULL
      OR NEW.destino_uf IS NOT NULL
      OR NEW.destino_pais_codigo IS NULL
      OR length(NEW.destino_pais_codigo) <> 2
      OR NEW.destino_pais_codigo NOT GLOB '[A-Z][A-Z]'
      OR NEW.destino_cidade_local IS NULL
      OR length(trim(NEW.destino_cidade_local)) < 2
    )
  )
  OR NEW.abrangencia NOT IN ('TERRITORIAL','NACIONAL','INTERNACIONAL')
BEGIN
  SELECT RAISE(ABORT, 'EVENTO_ABRANGENCIA_DESTINO_INVALIDO');
END;

DROP TRIGGER IF EXISTS trg_evento_pessoal_insert;
DROP TRIGGER IF EXISTS trg_evento_pessoal_update;

CREATE TRIGGER trg_evento_pessoal_insert BEFORE INSERT ON eventos
WHEN NEW.pessoal = 1 AND (
  NEW.criador_membro_id IS NULL
  OR NEW.serie_recorrencia_id IS NOT NULL
  OR (NEW.abrangencia = 'TERRITORIAL' AND NEW.casa_id IS NULL)
)
BEGIN SELECT RAISE(ABORT, 'EVENTO_PESSOAL_INVALIDO'); END;

CREATE TRIGGER trg_evento_pessoal_update BEFORE UPDATE ON eventos
WHEN NEW.pessoal = 1 AND (
  NEW.criador_membro_id IS NULL
  OR NEW.serie_recorrencia_id IS NOT NULL
  OR (NEW.abrangencia = 'TERRITORIAL' AND NEW.casa_id IS NULL)
)
BEGIN SELECT RAISE(ABORT, 'EVENTO_PESSOAL_INVALIDO'); END;
