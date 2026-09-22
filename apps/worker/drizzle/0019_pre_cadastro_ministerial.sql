-- DATA-04A — pré-cadastro ministerial
-- Estrutura separada do cadastro operacional de membros.
-- Não contém PIN, sessão, celular ou número de carteirinha.

CREATE TABLE `pre_cadastros_ministeriais` (
  `id` text PRIMARY KEY NOT NULL,
  `nome` text NOT NULL,
  `ministerio` text,
  `rrm` text NOT NULL,
  `regional_id` text,
  `administracao_origem` text,
  `localidade_origem` text,
  `codigo_casa_referencia` text,
  `casa_id` text,
  `data_ordenacao` text,
  `status_origem` text,
  `membro_id` text UNIQUE,
  `fonte` text DEFAULT 'EXPORTACAO_CONSULTA_SERVOS_MINISTERIO' NOT NULL,
  `ativo` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`regional_id`) REFERENCES `regionais`(`id`),
  FOREIGN KEY (`casa_id`) REFERENCES `casas`(`id`),
  FOREIGN KEY (`membro_id`) REFERENCES `membros`(`id`),
  CONSTRAINT `check_pre_cadastro_ministerial_ativo` CHECK (`ativo` IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `idx_pre_cadastro_ministerial_nome`
  ON `pre_cadastros_ministeriais` (`nome`);
--> statement-breakpoint
CREATE INDEX `idx_pre_cadastro_ministerial_regional`
  ON `pre_cadastros_ministeriais` (`regional_id`, `ativo`);
--> statement-breakpoint
CREATE INDEX `idx_pre_cadastro_ministerial_casa`
  ON `pre_cadastros_ministeriais` (`casa_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_pre_cadastro_ministerial_membro`
  ON `pre_cadastros_ministeriais` (`membro_id`)
  WHERE `membro_id` IS NOT NULL;
