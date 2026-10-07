PRAGMA defer_foreign_keys = ON;

CREATE TABLE eventos_novo (
  id text PRIMARY KEY NOT NULL,
  pessoal integer DEFAULT 0 NOT NULL CHECK (pessoal IN (0, 1)),
  criador_membro_id text REFERENCES membros(id),
  titulo text NOT NULL,
  descricao text,
  pauta text,
  modalidade text NOT NULL,
  inicio_em text NOT NULL,
  fim_em text NOT NULL,
  agenda_revisao text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  agenda_aviso text,
  local_id text REFERENCES locais(id),
  espaco_id text REFERENCES espacos_local(id),
  url_online text,
  organizador_membro_id text REFERENCES membros(id),
  abrangencia text DEFAULT 'TERRITORIAL' NOT NULL
    CHECK (abrangencia IN ('TERRITORIAL','NACIONAL','INTERNACIONAL')),
  destino_uf text,
  destino_pais_codigo text,
  destino_cidade_local text,
  regional_id text REFERENCES regionais(id),
  administracao_id text REFERENCES administracoes(id),
  setor_id text REFERENCES setores(id),
  casa_id text REFERENCES casas(id),
  grupo_trabalho_id text REFERENCES grupos_trabalho(id),
  observacoes text,
  serie_recorrencia_id text REFERENCES series_recorrencia(id),
  recorrencia_origem_inicio_em text,
  recorrencia_excecao integer DEFAULT false NOT NULL,
  possui_manha integer DEFAULT false NOT NULL,
  possui_tarde integer DEFAULT false NOT NULL,
  possui_noite integer DEFAULT false NOT NULL,
  ativo integer DEFAULT true NOT NULL,
  created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  CONSTRAINT check_evento_abrangencia_destino CHECK (
    (
      abrangencia = 'TERRITORIAL'
      AND (
        (CASE WHEN regional_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN administracao_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN setor_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN casa_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN grupo_trabalho_id IS NOT NULL THEN 1 ELSE 0 END)
      ) = 1
      AND destino_uf IS NULL
      AND destino_pais_codigo IS NULL
      AND destino_cidade_local IS NULL
    )
    OR
    (
      abrangencia = 'NACIONAL'
      AND regional_id IS NULL AND administracao_id IS NULL
      AND setor_id IS NULL AND casa_id IS NULL AND grupo_trabalho_id IS NULL
      AND destino_uf IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
      AND destino_pais_codigo IS NULL
      AND length(trim(destino_cidade_local)) >= 2
    )
    OR
    (
      abrangencia = 'INTERNACIONAL'
      AND regional_id IS NULL AND administracao_id IS NULL
      AND setor_id IS NULL AND casa_id IS NULL AND grupo_trabalho_id IS NULL
      AND destino_uf IS NULL
      AND length(destino_pais_codigo) = 2
      AND destino_pais_codigo GLOB '[A-Z][A-Z]'
      AND length(trim(destino_cidade_local)) >= 2
    )
  )
);

INSERT INTO eventos_novo (
  id, pessoal, criador_membro_id, titulo, descricao, pauta, modalidade,
  inicio_em, fim_em, agenda_revisao, agenda_aviso, local_id, espaco_id,
  url_online, organizador_membro_id, abrangencia, destino_uf,
  destino_pais_codigo, destino_cidade_local, regional_id, administracao_id,
  setor_id, casa_id, grupo_trabalho_id, observacoes, serie_recorrencia_id,
  recorrencia_origem_inicio_em, recorrencia_excecao, possui_manha,
  possui_tarde, possui_noite, ativo, created_at, updated_at
)
SELECT
  id, pessoal, criador_membro_id, titulo, descricao, pauta, modalidade,
  inicio_em, fim_em, agenda_revisao, agenda_aviso, local_id, espaco_id,
  url_online, organizador_membro_id, 'TERRITORIAL', NULL, NULL, NULL,
  regional_id, administracao_id, setor_id, casa_id, grupo_trabalho_id,
  observacoes, serie_recorrencia_id, recorrencia_origem_inicio_em,
  recorrencia_excecao, possui_manha, possui_tarde, possui_noite, ativo,
  created_at, updated_at
FROM eventos;

DROP TABLE eventos;
ALTER TABLE eventos_novo RENAME TO eventos;

CREATE INDEX idx_eventos_criador_pessoal ON eventos (criador_membro_id, pessoal, ativo);
CREATE INDEX idx_eventos_inicio_em ON eventos (inicio_em);
CREATE INDEX idx_eventos_ativo ON eventos (ativo);
CREATE INDEX idx_eventos_local_id ON eventos (local_id);
CREATE INDEX idx_eventos_serie_recorrencia_id ON eventos (serie_recorrencia_id);
CREATE INDEX idx_eventos_abrangencia ON eventos (abrangencia, ativo);

CREATE TRIGGER trg_evento_nao_inativar_com_convocacao_ativa
BEFORE UPDATE OF ativo ON eventos
WHEN OLD.ativo = 1
  AND NEW.ativo = 0
  AND EXISTS (
    SELECT 1 FROM convocacoes
    WHERE evento_id = OLD.id
      AND ativo = 1
      AND status IN ('RASCUNHO', 'PUBLICADA')
  )
BEGIN
  SELECT RAISE(ABORT, 'EVENTO_COM_CONVOCACAO_ATIVA');
END;

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
