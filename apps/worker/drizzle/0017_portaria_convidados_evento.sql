CREATE TABLE `convidados_evento` (
  `id` text PRIMARY KEY NOT NULL,
  `evento_id` text NOT NULL,
  `nome` text NOT NULL,
  `localidade` text NOT NULL,
  `referencia` text,
  `observacoes` text,
  `status` text DEFAULT 'PENDENTE' NOT NULL,
  `criado_por_membro_id` text,
  `validado_por_membro_id` text,
  `validado_em` text,
  `ativo` integer DEFAULT true NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`),
  FOREIGN KEY (`criado_por_membro_id`) REFERENCES `membros`(`id`),
  FOREIGN KEY (`validado_por_membro_id`) REFERENCES `membros`(`id`),
  CONSTRAINT `check_convidado_evento_status` CHECK (`status` IN ('PENDENTE','VALIDADO'))
);
--> statement-breakpoint
CREATE INDEX `idx_convidados_evento`
  ON `convidados_evento` (`evento_id`, `ativo`);
--> statement-breakpoint
CREATE TABLE `credenciais_cadastro_portaria_evento` (
  `id` text PRIMARY KEY NOT NULL,
  `evento_id` text NOT NULL,
  `token_hash` text NOT NULL UNIQUE,
  `expira_em` text NOT NULL,
  `revogado_em` text,
  `criado_por_membro_id` text,
  `ativo` integer DEFAULT true NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`),
  FOREIGN KEY (`criado_por_membro_id`) REFERENCES `membros`(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_credencial_cadastro_portaria_evento`
  ON `credenciais_cadastro_portaria_evento` (`evento_id`, `ativo`);
--> statement-breakpoint
CREATE TABLE `presencas_convidado_evento` (
  `id` text PRIMARY KEY NOT NULL,
  `convidado_id` text NOT NULL,
  `evento_id` text NOT NULL,
  `forma` text NOT NULL,
  `registrado_por_membro_id` text,
  `registrado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`convidado_id`) REFERENCES `convidados_evento`(`id`),
  FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`),
  FOREIGN KEY (`registrado_por_membro_id`) REFERENCES `membros`(`id`),
  CONSTRAINT `check_presenca_convidado_forma` CHECK (`forma` IN ('VALIDACAO_PORTEIRO','MANUAL'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_presenca_convidado_unica`
  ON `presencas_convidado_evento` (`evento_id`, `convidado_id`);
--> statement-breakpoint
CREATE INDEX `idx_presenca_convidado_evento`
  ON `presencas_convidado_evento` (`evento_id`);
