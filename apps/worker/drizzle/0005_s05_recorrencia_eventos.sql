CREATE TABLE `series_recorrencia` (
	`id` text PRIMARY KEY NOT NULL,
	`titulo` text NOT NULL,
	`descricao` text,
	`pauta` text,
	`modalidade` text NOT NULL,
	`frequencia` text NOT NULL,
	`intervalo` integer DEFAULT 1 NOT NULL,
	`data_inicio` text NOT NULL,
	`data_fim` text NOT NULL,
	`horario_inicio` text NOT NULL,
	`horario_fim` text NOT NULL,
	`timezone` text DEFAULT 'America/Sao_Paulo' NOT NULL,
	`dia_semana` integer,
	`dia_mes` integer,
	`posicao_semana_mes` integer,
	`local_id` text,
	`url_online` text,
	`organizador_membro_id` text,
	`regional_id` text,
	`administracao_id` text,
	`setor_id` text,
	`casa_id` text,
	`grupo_trabalho_id` text,
	`observacoes` text,
	`ativo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`local_id`) REFERENCES `locais`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organizador_membro_id`) REFERENCES `membros`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`regional_id`) REFERENCES `regionais`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`administracao_id`) REFERENCES `administracoes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`setor_id`) REFERENCES `setores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`casa_id`) REFERENCES `casas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grupo_trabalho_id`) REFERENCES `grupos_trabalho`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `check_serie_escopo_unico` CHECK((CASE WHEN "regional_id" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "administracao_id" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "setor_id" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "casa_id" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "grupo_trabalho_id" IS NOT NULL THEN 1 ELSE 0 END) = 1)
);
--> statement-breakpoint
CREATE INDEX `idx_series_data_inicio` ON `series_recorrencia` (`data_inicio`);
--> statement-breakpoint
CREATE INDEX `idx_series_ativo` ON `series_recorrencia` (`ativo`);
--> statement-breakpoint
ALTER TABLE `eventos` ADD COLUMN `serie_recorrencia_id` text REFERENCES `series_recorrencia`(`id`) ON UPDATE no action ON DELETE no action;
--> statement-breakpoint
ALTER TABLE `eventos` ADD COLUMN `recorrencia_excecao` integer DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_eventos_serie_recorrencia_id` ON `eventos` (`serie_recorrencia_id`);
