-- SQLite/D1: reconstrução necessária para substituir CHECK legada de 0004.
-- defer_foreign_keys mantém referências de convocacoes e demais tabelas até a
-- conclusão da transação de migração gerenciada pelo Wrangler/D1.
PRAGMA defer_foreign_keys = ON;
CREATE TABLE eventos_0043_nova (
  id text PRIMARY KEY NOT NULL,
  titulo text NOT NULL,
  descricao text, pauta text,
  modalidade text NOT NULL,
  inicio_em text NOT NULL, fim_em text NOT NULL,
  local_id text REFERENCES locais(id),
  url_online text,
  organizador_membro_id text REFERENCES membros(id),
  regional_id text REFERENCES regionais(id),
  administracao_id text REFERENCES administracoes(id),
  setor_id text REFERENCES setores(id),
  casa_id text REFERENCES casas(id),
  grupo_trabalho_id text REFERENCES grupos_trabalho(id),
  observacoes text,
  ativo integer DEFAULT 1 NOT NULL,
  created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  serie_recorrencia_id text REFERENCES series_recorrencia(id),
  recorrencia_excecao integer DEFAULT 0 NOT NULL,
  recorrencia_origem_inicio_em text,
  possui_manha integer DEFAULT 0 NOT NULL,
  possui_tarde integer DEFAULT 0 NOT NULL,
  possui_noite integer DEFAULT 0 NOT NULL,
  espaco_id text REFERENCES espacos_local(id),
  agenda_revisao text DEFAULT '' NOT NULL,
  agenda_aviso text,
  pessoal integer DEFAULT 0 NOT NULL CHECK (pessoal IN (0, 1)),
  criador_membro_id text REFERENCES membros(id),
  abrangencia text DEFAULT 'TERRITORIAL' NOT NULL,
  destino_uf text,
  destino_pais_codigo text,
  destino_cidade_local text,
  regional_gestao_id text REFERENCES regionais(id),
  CONSTRAINT check_evento_abrangencia_destino CHECK (
    (abrangencia = 'TERRITORIAL' AND
      ((regional_id IS NOT NULL) + (administracao_id IS NOT NULL) +
       (setor_id IS NOT NULL) + (casa_id IS NOT NULL) +
       (grupo_trabalho_id IS NOT NULL)) = 1 AND
      destino_uf IS NULL AND destino_pais_codigo IS NULL AND destino_cidade_local IS NULL)
    OR
    (abrangencia = 'NACIONAL' AND regional_gestao_id IS NOT NULL AND
      regional_id IS NULL AND administracao_id IS NULL AND setor_id IS NULL AND
      casa_id IS NULL AND grupo_trabalho_id IS NULL AND
      destino_uf IS NOT NULL AND destino_pais_codigo IS NULL AND destino_cidade_local IS NOT NULL)
    OR
    (abrangencia = 'INTERNACIONAL' AND regional_gestao_id IS NOT NULL AND
      regional_id IS NULL AND administracao_id IS NULL AND setor_id IS NULL AND
      casa_id IS NULL AND grupo_trabalho_id IS NULL AND
      destino_uf IS NULL AND destino_pais_codigo IS NOT NULL AND destino_cidade_local IS NOT NULL)
  )
);
INSERT INTO eventos_0043_nova (id, titulo, descricao, pauta, modalidade, inicio_em, fim_em, local_id, url_online, organizador_membro_id, regional_id, administracao_id, setor_id, casa_id, grupo_trabalho_id, observacoes, ativo, created_at, updated_at, serie_recorrencia_id, recorrencia_excecao, recorrencia_origem_inicio_em, possui_manha, possui_tarde, possui_noite, espaco_id, agenda_revisao, agenda_aviso, pessoal, criador_membro_id, abrangencia, destino_uf, destino_pais_codigo, destino_cidade_local, regional_gestao_id)
SELECT id, titulo, descricao, pauta, modalidade, inicio_em, fim_em, local_id, url_online, organizador_membro_id, regional_id, administracao_id, setor_id, casa_id, grupo_trabalho_id, observacoes, ativo, created_at, updated_at, serie_recorrencia_id, recorrencia_excecao, recorrencia_origem_inicio_em, possui_manha, possui_tarde, possui_noite, espaco_id, agenda_revisao, agenda_aviso, pessoal, criador_membro_id, 'TERRITORIAL', NULL, NULL, NULL, regional_id FROM eventos;
DROP TABLE eventos;
ALTER TABLE eventos_0043_nova RENAME TO eventos;
CREATE INDEX idx_eventos_inicio_em ON eventos(inicio_em);
CREATE INDEX idx_eventos_ativo ON eventos(ativo);
CREATE INDEX idx_eventos_local_id ON eventos(local_id);
CREATE INDEX idx_eventos_serie_recorrencia_id ON eventos(serie_recorrencia_id);
CREATE INDEX idx_eventos_criador_pessoal ON eventos(criador_membro_id, pessoal, ativo);
CREATE INDEX idx_eventos_abrangencia ON eventos(abrangencia, ativo);
CREATE INDEX idx_eventos_abrangencia_gestao ON eventos(abrangencia, regional_gestao_id, ativo);

CREATE TRIGGER trg_evento_nao_inativar_com_convocacao_ativa
BEFORE UPDATE OF ativo ON eventos
WHEN OLD.ativo = 1 AND NEW.ativo = 0 AND EXISTS (
 SELECT 1 FROM convocacoes WHERE evento_id = OLD.id AND ativo = 1 AND status IN ('RASCUNHO','PUBLICADA')
)
BEGIN SELECT RAISE(ABORT, 'EVENTO_COM_CONVOCACAO_ATIVA'); END;

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
