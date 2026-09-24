CREATE TABLE `credenciais_operador_portaria_evento` (
  `id` text PRIMARY KEY NOT NULL,
  `evento_id` text NOT NULL,
  `token_hash` text NOT NULL UNIQUE,
  `expira_em` text NOT NULL,
  `revogado_em` text,
  `criado_por_membro_id` text,
  `ultimo_acesso_em` text,
  `ativo` integer DEFAULT true NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`),
  FOREIGN KEY (`criado_por_membro_id`) REFERENCES `membros`(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_credencial_operador_portaria_evento`
  ON `credenciais_operador_portaria_evento` (`evento_id`, `ativo`);
