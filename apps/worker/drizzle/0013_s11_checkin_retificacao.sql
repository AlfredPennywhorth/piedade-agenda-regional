PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_checkins` (
  `id` text PRIMARY KEY NOT NULL,
  `convocacao_destinatario_id` text NOT NULL,
  `evento_id` text NOT NULL,
  `membro_id` text NOT NULL,
  `data_hora_checkin` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `forma` text NOT NULL,
  `status` text DEFAULT 'ATIVO' NOT NULL,
  `operador_membro_id` text,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`convocacao_destinatario_id`) REFERENCES `convocacao_destinatarios`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (`membro_id`) REFERENCES `membros`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (`operador_membro_id`) REFERENCES `membros`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT `check_checkin_forma` CHECK (`forma` IN ('QR', 'MANUAL')),
  CONSTRAINT `check_checkin_status` CHECK (`status` IN ('ATIVO', 'RETIFICADO'))
);
--> statement-breakpoint
INSERT INTO `__new_checkins`("id", "convocacao_destinatario_id", "evento_id", "membro_id", "data_hora_checkin", "forma", "operador_membro_id", "created_at", "updated_at") SELECT "id", "convocacao_destinatario_id", "evento_id", "membro_id", "data_hora_checkin", "forma", "operador_membro_id", "created_at", "updated_at" FROM `checkins`;
--> statement-breakpoint
DROP TABLE `checkins`;
--> statement-breakpoint
ALTER TABLE `__new_checkins` RENAME TO `checkins`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_checkin_evento_membro_unico` ON `checkins` (`evento_id`, `membro_id`) WHERE `status` = 'ATIVO';
--> statement-breakpoint
CREATE INDEX `idx_checkin_destinatario` ON `checkins` (`convocacao_destinatario_id`);
--> statement-breakpoint
CREATE INDEX `idx_checkin_membro` ON `checkins` (`membro_id`);
