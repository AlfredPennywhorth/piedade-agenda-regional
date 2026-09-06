-- Migration 0007_s08_rsvp.sql
-- Implementação do sistema de RSVP/Confirmação de Participação (S08)

CREATE TABLE `rsvp` (
	`id` text PRIMARY KEY NOT NULL,
	`convocacao_destinatario_id` text NOT NULL UNIQUE,
	`resposta` text NOT NULL,
	`justificativa` text,
	`respondido_em` text NOT NULL,
	`atualizado_em` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`convocacao_destinatario_id`) REFERENCES `convocacao_destinatarios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT check_rsvp_resposta CHECK (resposta IN ('PARTICIPAREI','NAO_PARTICIPAREI','NAO_SEI'))
);

CREATE INDEX `idx_rsvp_convocacao_dest_id` ON `rsvp` (`convocacao_destinatario_id`);
