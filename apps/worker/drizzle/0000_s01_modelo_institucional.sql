CREATE TABLE `regionais` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`codigo` text,
	`ativo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `administracoes` (
	`id` text PRIMARY KEY NOT NULL,
	`regional_id` text NOT NULL,
	`nome` text NOT NULL,
	`codigo` text,
	`ativo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`regional_id`) REFERENCES `regionais`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `setores` (
	`id` text PRIMARY KEY NOT NULL,
	`administracao_id` text NOT NULL,
	`nome` text NOT NULL,
	`codigo` text,
	`ativo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`administracao_id`) REFERENCES `administracoes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `casas` (
	`id` text PRIMARY KEY NOT NULL,
	`setor_id` text NOT NULL,
	`nome` text NOT NULL,
	`codigo` text,
	`ativo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`setor_id`) REFERENCES `setores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `grupos_trabalho` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`regional_id` text,
	`administracao_id` text,
	`setor_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`regional_id`) REFERENCES `regionais`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`administracao_id`) REFERENCES `administracoes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`setor_id`) REFERENCES `setores`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "check_escopo_unico" CHECK(
      (CASE WHEN "regional_id" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "administracao_id" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "setor_id" IS NOT NULL THEN 1 ELSE 0 END) = 1
    )
);
