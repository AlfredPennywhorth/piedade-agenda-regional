-- DATA-05 — representantes setoriais dos GTs Regionais e telefone de referência
-- Regra vigente: GT pertence exclusivamente à Regional; o Setor é representado na participação.

ALTER TABLE `pre_cadastros_ministeriais`
  ADD COLUMN `celular_referencia` text;
--> statement-breakpoint
ALTER TABLE `pre_cadastros_ministeriais`
  ADD COLUMN `fonte_celular` text;
--> statement-breakpoint

CREATE TABLE `participacoes_grupos_trabalho` (
  `id` text PRIMARY KEY NOT NULL,
  `grupo_trabalho_id` text NOT NULL,
  `setor_representado_id` text NOT NULL,
  `pre_cadastro_ministerial_id` text NOT NULL,
  `papel` text NOT NULL,
  `status_mensageria` text,
  `justificativa` text,
  `ativo` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`grupo_trabalho_id`) REFERENCES `grupos_trabalho`(`id`),
  FOREIGN KEY (`setor_representado_id`) REFERENCES `setores`(`id`),
  FOREIGN KEY (`pre_cadastro_ministerial_id`) REFERENCES `pre_cadastros_ministeriais`(`id`),
  CONSTRAINT `check_participacao_gt_papel`
    CHECK (`papel` IN ('RESPONSAVEL','SUPLENTE')),
  CONSTRAINT `check_participacao_gt_ativo`
    CHECK (`ativo` IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_participacao_gt_unica`
  ON `participacoes_grupos_trabalho`
    (`grupo_trabalho_id`, `setor_representado_id`,
     `pre_cadastro_ministerial_id`, `papel`)
  WHERE `ativo` = 1;
--> statement-breakpoint
CREATE INDEX `idx_participacao_gt_setor`
  ON `participacoes_grupos_trabalho`
    (`grupo_trabalho_id`, `setor_representado_id`, `ativo`);
--> statement-breakpoint
CREATE INDEX `idx_participacao_gt_pre_cadastro`
  ON `participacoes_grupos_trabalho`
    (`pre_cadastro_ministerial_id`, `ativo`);
--> statement-breakpoint
CREATE TRIGGER `trg_participacao_gt_regional_insert`
BEFORE INSERT ON `participacoes_grupos_trabalho`
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM `grupos_trabalho` g
      WHERE g.id = NEW.grupo_trabalho_id
        AND g.regional_id IS NOT NULL
        AND g.administracao_id IS NULL
        AND g.setor_id IS NULL
    )
    THEN RAISE(ABORT, 'GT_DEVE_SER_REGIONAL')
  END;

  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM `grupos_trabalho` g
      JOIN `setores` s ON s.id = NEW.setor_representado_id
      JOIN `administracoes` a ON a.id = s.administracao_id
      WHERE g.id = NEW.grupo_trabalho_id
        AND g.regional_id = a.regional_id
    )
    THEN RAISE(ABORT, 'SETOR_FORA_DA_REGIONAL_DO_GT')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_participacao_gt_regional_update`
BEFORE UPDATE OF `grupo_trabalho_id`, `setor_representado_id`
ON `participacoes_grupos_trabalho`
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM `grupos_trabalho` g
      WHERE g.id = NEW.grupo_trabalho_id
        AND g.regional_id IS NOT NULL
        AND g.administracao_id IS NULL
        AND g.setor_id IS NULL
    )
    THEN RAISE(ABORT, 'GT_DEVE_SER_REGIONAL')
  END;

  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM `grupos_trabalho` g
      JOIN `setores` s ON s.id = NEW.setor_representado_id
      JOIN `administracoes` a ON a.id = s.administracao_id
      WHERE g.id = NEW.grupo_trabalho_id
        AND g.regional_id = a.regional_id
    )
    THEN RAISE(ABORT, 'SETOR_FORA_DA_REGIONAL_DO_GT')
  END;
END;
