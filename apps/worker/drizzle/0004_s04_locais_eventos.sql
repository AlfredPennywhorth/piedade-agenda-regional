CREATE TABLE `locais` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`endereco` text NOT NULL,
	`numero` text NOT NULL,
	`complemento` text,
	`bairro` text,
	`cidade` text NOT NULL,
	`uf` text NOT NULL,
	`cep` text,
	`referencia` text,
	`latitude` real,
	`longitude` real,
	`url_maps` text,
	`url_waze` text,
	`ativo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `eventos` (
	`id` text PRIMARY KEY NOT NULL,
	`titulo` text NOT NULL,
	`descricao` text,
	`pauta` text,
	`modalidade` text NOT NULL,
	`inicio_em` text NOT NULL,
	`fim_em` text NOT NULL,
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
	CONSTRAINT `check_evento_escopo_unico` CHECK((CASE WHEN "regional_id" IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN "administracao_id" IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN "setor_id" IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN "casa_id" IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN "grupo_trabalho_id" IS NOT NULL THEN 1 ELSE 0 END) = 1)
);
--> statement-breakpoint
CREATE INDEX `idx_eventos_inicio_em` ON `eventos` (`inicio_em`);
--> statement-breakpoint
CREATE INDEX `idx_eventos_ativo` ON `eventos` (`ativo`);
--> statement-breakpoint
CREATE INDEX `idx_eventos_local_id` ON `eventos` (`local_id`);
