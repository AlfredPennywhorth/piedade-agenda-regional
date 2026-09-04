-- Migration 0006_s06_convocacoes.sql
-- Implementação do sistema de convocações (S06)

CREATE TABLE `convocacoes` (
	`id` text PRIMARY KEY NOT NULL,
	`evento_id` text NOT NULL,
	`status` text NOT NULL,
	`observacoes` text,
	`publicada_em` text,
	`cancelada_em` text,
	`ativo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `convocacao_funcoes` (
	`id` text PRIMARY KEY NOT NULL,
	`convocacao_id` text NOT NULL,
	`funcao_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`convocacao_id`) REFERENCES `convocacoes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`funcao_id`) REFERENCES `funcoes`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `convocacao_destinatarios` (
	`id` text PRIMARY KEY NOT NULL,
	`convocacao_id` text NOT NULL,
	`membro_id` text NOT NULL,
	`funcao_id` text NOT NULL,
	`vinculo_funcional_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`convocacao_id`) REFERENCES `convocacoes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`membro_id`) REFERENCES `membros`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`funcao_id`) REFERENCES `funcoes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vinculo_funcional_id`) REFERENCES `vinculos_funcionais`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `idx_convocacoes_evento_id` ON `convocacoes` (`evento_id`);
CREATE INDEX `idx_convocacoes_status` ON `convocacoes` (`status`);
CREATE UNIQUE INDEX `idx_convocacao_funcao_unico` ON `convocacao_funcoes` (`convocacao_id`, `funcao_id`);
CREATE INDEX `idx_convocacao_funcoes_convocacao_id` ON `convocacao_funcoes` (`convocacao_id`);
CREATE UNIQUE INDEX `idx_convocacao_destinatario_unico` ON `convocacao_destinatarios` (`convocacao_id`, `membro_id`, `funcao_id`, `vinculo_funcional_id`);
CREATE INDEX `idx_convocacao_destinatarios_convocacao_id` ON `convocacao_destinatarios` (`convocacao_id`);
CREATE INDEX `idx_convocacao_destinatarios_membro_id` ON `convocacao_destinatarios` (`membro_id`);
