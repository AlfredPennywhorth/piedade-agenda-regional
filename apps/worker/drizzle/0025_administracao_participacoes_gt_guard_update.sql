-- DATA-05 hardening — impedir mover Administração para Regional incompatível com GTs representados.
CREATE TRIGGER IF NOT EXISTS `trg_administracao_participacoes_gt_guard_update`
BEFORE UPDATE OF `regional_id`
ON `administracoes`
WHEN NEW.regional_id <> OLD.regional_id
BEGIN
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM `setores` s
      JOIN `participacoes_grupos_trabalho` p ON p.setor_representado_id = s.id
      JOIN `grupos_trabalho` g ON g.id = p.grupo_trabalho_id
      WHERE s.administracao_id = OLD.id
        AND p.ativo = 1
        AND g.regional_id <> NEW.regional_id
    )
    THEN RAISE(ABORT, 'GT_PARTICIPACOES_INCOMPATIVEIS')
  END;
END;
