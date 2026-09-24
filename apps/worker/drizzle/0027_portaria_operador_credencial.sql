CREATE TABLE `credenciais_operador_portaria_evento` (
  `id` text PRIMARY KEY NOT NULL,
  `evento_id` text NOT NULL,
  `token_hash` text NOT NULL UNIQUE,
  `expira_em` text NOT NULL,
  `revogado_em` text,
  `criado_por_membro_id` text,
  `ultimo_acesso_em` text,
  `ativo` integer DEFAULT true NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`),
  FOREIGN KEY (`criado_por_membro_id`) REFERENCES `membros`(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_credencial_operador_portaria_evento`
  ON `credenciais_operador_portaria_evento` (`evento_id`, `ativo`);

--> statement-breakpoint
CREATE TRIGGER `trg_checkin_portaria_aberta`
BEFORE INSERT ON `checkins`
WHEN EXISTS (
  SELECT 1 FROM `portarias_evento`
  WHERE `evento_id` = NEW.`evento_id`
    AND `status` <> 'ABERTA'
)
BEGIN
  SELECT RAISE(ABORT, 'PORTARIA_NAO_ABERTA');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_presenca_convidado_portaria_aberta`
BEFORE INSERT ON `presencas_convidado_evento`
WHEN EXISTS (
  SELECT 1 FROM `portarias_evento`
  WHERE `evento_id` = NEW.`evento_id`
    AND `status` <> 'ABERTA'
)
BEGIN
  SELECT RAISE(ABORT, 'PORTARIA_NAO_ABERTA');
END;
