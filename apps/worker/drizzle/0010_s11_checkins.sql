CREATE TABLE `checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`evento_id` text NOT NULL,
	`membro_id` text NOT NULL,
	`convocacao_destinatario_id` text,
	`modo` text NOT NULL,
	`registrado_em` text NOT NULL,
	`registrado_por_membro_id` text NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`membro_id`) REFERENCES `membros`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`convocacao_destinatario_id`) REFERENCES `convocacao_destinatarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`registrado_por_membro_id`) REFERENCES `membros`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "check_checkin_modo" CHECK("modo" IN ('QR','MANUAL'))
);
--> statement-breakpoint
CREATE TABLE `checkin_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`evento_id` text NOT NULL,
	`membro_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expira_em` text NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`membro_id`) REFERENCES `membros`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_checkin_unico` ON `checkins` (`evento_id`,`membro_id`) WHERE "ativo" = 1;--> statement-breakpoint
CREATE INDEX `idx_checkins_evento_id` ON `checkins` (`evento_id`);--> statement-breakpoint
CREATE INDEX `idx_checkins_membro_id` ON `checkins` (`membro_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_checkin_token_hash` ON `checkin_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_checkin_token_evento_membro` ON `checkin_tokens` (`evento_id`,`membro_id`);
