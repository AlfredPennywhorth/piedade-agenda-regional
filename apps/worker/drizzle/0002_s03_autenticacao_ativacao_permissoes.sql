-- Migration S03 - Autenticação, Ativação e Permissões

-- Tabela de Links de Ativação
CREATE TABLE `links_ativacao` (
	`id` text PRIMARY KEY NOT NULL,
	`membro_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expira_em` text NOT NULL,
	`utilizado_em` text,
	`revogado_em` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`membro_id`) REFERENCES `membros`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX `links_ativacao_token_hash_unique` ON `links_ativacao` (`token_hash`);

-- Tabela de Sessões
CREATE TABLE `sessoes` (
	`id` text PRIMARY KEY NOT NULL,
	`membro_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expira_em` text NOT NULL,
	`revogado_em` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`ultimo_acesso_em` text,
	`user_agent` text,
	FOREIGN KEY (`membro_id`) REFERENCES `membros`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX `sessoes_token_hash_unique` ON `sessoes` (`token_hash`);

-- Tabela de Tentativas de Acesso
CREATE TABLE `tentativas_acesso` (
	`id` text PRIMARY KEY NOT NULL,
	`membro_id` text,
	`tipo` text NOT NULL,
	`sucesso` integer NOT NULL,
	`motivo` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`membro_id`) REFERENCES `membros`(`id`) ON UPDATE no action ON DELETE no action
);

-- Alterações na Tabela Membros
ALTER TABLE `membros` ADD `autenticacao_ativa` integer DEFAULT false NOT NULL;
ALTER TABLE `membros` ADD `pin_hash` text;
ALTER TABLE `membros` ADD `pin_salt` text;
ALTER TABLE `membros` ADD `bloqueado_ate` text;
ALTER TABLE `membros` ADD `tentativas_pin` integer DEFAULT 0 NOT NULL;
ALTER TABLE `membros` ADD `ativado_em` text;
