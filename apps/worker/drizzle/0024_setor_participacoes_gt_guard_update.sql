-- DATA-05 hardening — impedir mover Setor para Regional incompatível com seus GTs.
CREATE TRIGGER IF NOT EXISTS `trg_setor_participacoes_gt_guard_update`
BEFORE UPDATE OF `administracao_id`
ON `setores`
WHEN NEW.administracao_id <> OLD.administracao_id
BEGIN
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM `participacoes_grupos_trabalho` p
      JOIN `grupos_trabalho` g ON g.id = p.grupo_trabalho_id
      JOIN `administracoes` a ON a.id = NEW.administracao_id
      WHERE p.setor_representado_id = OLD.id
        AND p.ativo = 1
        AND g.regional_id <> a.regional_id
    )
    THEN RAISE(ABORT, 'GT_PARTICIPACOES_INCOMPATIVEIS')
  END;
END;
