-- DATA-05 — trigger de integridade na alteração de participação em GT
-- Isolado em migration própria por compatibilidade com o parser remoto do Cloudflare D1.

CREATE TRIGGER IF NOT EXISTS `trg_participacao_gt_regional_update`
BEFORE UPDATE OF `grupo_trabalho_id`, `setor_representado_id`
ON `participacoes_grupos_trabalho`
BEGIN
  SELECT (CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM `grupos_trabalho` g
      WHERE g.id = NEW.grupo_trabalho_id
        AND g.regional_id IS NOT NULL
        AND g.administracao_id IS NULL
        AND g.setor_id IS NULL
    )
    THEN RAISE(ABORT, 'GT_DEVE_SER_REGIONAL')
  END);

  SELECT (CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM `grupos_trabalho` g
      JOIN `setores` s ON s.id = NEW.setor_representado_id
      JOIN `administracoes` a ON a.id = s.administracao_id
      WHERE g.id = NEW.grupo_trabalho_id
        AND g.regional_id = a.regional_id
    )
    THEN RAISE(ABORT, 'SETOR_FORA_DA_REGIONAL_DO_GT')
  END);
END;
