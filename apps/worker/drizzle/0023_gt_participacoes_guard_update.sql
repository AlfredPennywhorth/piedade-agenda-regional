-- DATA-05 hardening — impedir alteração de GT que invalide participações existentes.
CREATE TRIGGER IF NOT EXISTS `trg_gt_participacoes_guard_update`
BEFORE UPDATE OF `regional_id`, `administracao_id`, `setor_id`
ON `grupos_trabalho`
WHEN EXISTS (
  SELECT 1
  FROM `participacoes_grupos_trabalho` p
  WHERE p.grupo_trabalho_id = OLD.id
    AND p.ativo = 1
)
BEGIN
  SELECT (CASE
    WHEN NEW.regional_id IS NULL
      OR NEW.administracao_id IS NOT NULL
      OR NEW.setor_id IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM `participacoes_grupos_trabalho` p
        JOIN `setores` s ON s.id = p.setor_representado_id
        JOIN `administracoes` a ON a.id = s.administracao_id
        WHERE p.grupo_trabalho_id = OLD.id
          AND p.ativo = 1
          AND a.regional_id <> NEW.regional_id
      )
    THEN RAISE(ABORT, 'GT_PARTICIPACOES_INCOMPATIVEIS')
  END);
END;
