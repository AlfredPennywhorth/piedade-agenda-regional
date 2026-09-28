-- Mantém a relação entre eventos e convocações consistente sob concorrência.
-- Sem estes gatilhos, uma convocação poderia ser criada entre a leitura de
-- dependências e a inativação/regeração de uma ocorrência recorrente.

CREATE TRIGGER IF NOT EXISTS trg_evento_nao_inativar_com_convocacao_ativa
BEFORE UPDATE OF ativo ON eventos
WHEN OLD.ativo = 1
  AND NEW.ativo = 0
  AND EXISTS (
    SELECT 1
    FROM convocacoes
    WHERE evento_id = OLD.id
      AND ativo = 1
      AND status IN ('RASCUNHO', 'PUBLICADA')
  )
BEGIN
  SELECT RAISE(ABORT, 'EVENTO_COM_CONVOCACAO_ATIVA');
END;

CREATE TRIGGER IF NOT EXISTS trg_convocacao_nao_ativar_em_evento_inativo_insert
BEFORE INSERT ON convocacoes
WHEN NEW.ativo = 1
  AND NEW.status IN ('RASCUNHO', 'PUBLICADA')
  AND EXISTS (
    SELECT 1 FROM eventos WHERE id = NEW.evento_id AND ativo = 0
  )
BEGIN
  SELECT RAISE(ABORT, 'CONVOCACAO_EM_EVENTO_INATIVO');
END;

CREATE TRIGGER IF NOT EXISTS trg_convocacao_nao_ativar_em_evento_inativo_update
BEFORE UPDATE OF evento_id, ativo, status ON convocacoes
WHEN NEW.ativo = 1
  AND NEW.status IN ('RASCUNHO', 'PUBLICADA')
  AND EXISTS (
    SELECT 1 FROM eventos WHERE id = NEW.evento_id AND ativo = 0
  )
BEGIN
  SELECT RAISE(ABORT, 'CONVOCACAO_EM_EVENTO_INATIVO');
END;
