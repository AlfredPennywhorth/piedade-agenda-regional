CREATE TABLE `checkins` (
  `id` text PRIMARY KEY NOT NULL,
  `convocacao_destinatario_id` text NOT NULL,
  `evento_id` text NOT NULL,
  `membro_id` text NOT NULL,
  `data_hora_checkin` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `forma` text NOT NULL,
  `operador_membro_id` text,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`convocacao_destinatario_id`) REFERENCES `convocacao_destinatarios`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (`membro_id`) REFERENCES `membros`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (`operador_membro_id`) REFERENCES `membros`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT `check_checkin_forma` CHECK (`forma` IN ('QR', 'MANUAL'))
);

CREATE UNIQUE INDEX `idx_checkin_evento_membro_unico` ON `checkins` (`evento_id`, `membro_id`);
CREATE INDEX `idx_checkin_destinatario` ON `checkins` (`convocacao_destinatario_id`);
CREATE INDEX `idx_checkin_membro` ON `checkins` (`membro_id`);
