CREATE TABLE `portarias_evento` (
  `evento_id` text PRIMARY KEY NOT NULL,
  `status` text DEFAULT 'ABERTA' NOT NULL,
  `fechada_em` text,
  `fechada_por_membro_id` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`),
  FOREIGN KEY (`fechada_por_membro_id`) REFERENCES `membros`(`id`),
  CONSTRAINT `check_portaria_evento_status` CHECK (`status` IN ('ABERTA','FECHADA'))
);
--> statement-breakpoint
CREATE TABLE `portaria_operadores_evento` (
  `id` text PRIMARY KEY NOT NULL,
  `evento_id` text NOT NULL,
  `membro_id` text NOT NULL,
  `concedido_por_membro_id` text,
  `revogado_em` text,
  `ativo` integer DEFAULT true NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`),
  FOREIGN KEY (`membro_id`) REFERENCES `membros`(`id`),
  FOREIGN KEY (`concedido_por_membro_id`) REFERENCES `membros`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_portaria_operador_evento_ativo`
  ON `portaria_operadores_evento` (`evento_id`, `membro_id`) WHERE `ativo` = 1;
--> statement-breakpoint
CREATE INDEX `idx_portaria_operador_evento`
  ON `portaria_operadores_evento` (`evento_id`, `ativo`);
--> statement-breakpoint
CREATE INDEX `idx_portaria_operador_membro`
  ON `portaria_operadores_evento` (`membro_id`, `ativo`);
