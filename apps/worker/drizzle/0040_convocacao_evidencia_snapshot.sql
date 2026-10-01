ALTER TABLE convocacao_destinatario_evidencias ADD COLUMN funcao_nome_snapshot TEXT;
ALTER TABLE convocacao_destinatario_evidencias ADD COLUMN escopo_tipo_snapshot TEXT;
ALTER TABLE convocacao_destinatario_evidencias ADD COLUMN escopo_id_snapshot TEXT;

UPDATE convocacao_destinatario_evidencias
SET
  funcao_nome_snapshot = (
    SELECT f.nome
    FROM funcoes f
    WHERE f.id = convocacao_destinatario_evidencias.funcao_id
  ),
  escopo_tipo_snapshot = (
    SELECT CASE
      WHEN vf.regional_id IS NOT NULL THEN 'REGIONAL'
      WHEN vf.grupo_trabalho_id IS NOT NULL THEN 'GRUPO_TRABALHO'
      WHEN vf.administracao_id IS NOT NULL THEN 'ADMINISTRACAO'
      WHEN vf.setor_id IS NOT NULL THEN 'SETOR'
      WHEN vf.casa_id IS NOT NULL THEN 'CASA'
      ELSE NULL
    END
    FROM vinculos_funcionais vf
    WHERE vf.id = convocacao_destinatario_evidencias.vinculo_funcional_id
  ),
  escopo_id_snapshot = (
    SELECT COALESCE(
      vf.regional_id,
      vf.grupo_trabalho_id,
      vf.administracao_id,
      vf.setor_id,
      vf.casa_id
    )
    FROM vinculos_funcionais vf
    WHERE vf.id = convocacao_destinatario_evidencias.vinculo_funcional_id
  );

CREATE TRIGGER IF NOT EXISTS trg_convocacao_evidencia_snapshot_ai
AFTER INSERT ON convocacao_destinatario_evidencias
FOR EACH ROW
WHEN NEW.funcao_nome_snapshot IS NULL
  OR NEW.escopo_tipo_snapshot IS NULL
  OR NEW.escopo_id_snapshot IS NULL
BEGIN
  UPDATE convocacao_destinatario_evidencias
  SET
    funcao_nome_snapshot = COALESCE(
      NEW.funcao_nome_snapshot,
      (SELECT f.nome FROM funcoes f WHERE f.id = NEW.funcao_id)
    ),
    escopo_tipo_snapshot = COALESCE(
      NEW.escopo_tipo_snapshot,
      (
        SELECT CASE
          WHEN vf.regional_id IS NOT NULL THEN 'REGIONAL'
          WHEN vf.grupo_trabalho_id IS NOT NULL THEN 'GRUPO_TRABALHO'
          WHEN vf.administracao_id IS NOT NULL THEN 'ADMINISTRACAO'
          WHEN vf.setor_id IS NOT NULL THEN 'SETOR'
          WHEN vf.casa_id IS NOT NULL THEN 'CASA'
          ELSE NULL
        END
        FROM vinculos_funcionais vf
        WHERE vf.id = NEW.vinculo_funcional_id
      )
    ),
    escopo_id_snapshot = COALESCE(
      NEW.escopo_id_snapshot,
      (
        SELECT COALESCE(
          vf.regional_id,
          vf.grupo_trabalho_id,
          vf.administracao_id,
          vf.setor_id,
          vf.casa_id
        )
        FROM vinculos_funcionais vf
        WHERE vf.id = NEW.vinculo_funcional_id
      )
    )
  WHERE id = NEW.id;
END;
