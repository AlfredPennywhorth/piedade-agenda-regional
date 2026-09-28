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
CREATE TABLE `portaria_fechamento_locks` (
  `evento_id` text PRIMARY KEY NOT NULL,
  `criado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`)
);
--> statement-breakpoint
CREATE TRIGGER `trg_checkin_portaria_aberta`
BEFORE INSERT ON `checkins`
WHEN EXISTS (
  SELECT 1 FROM `portarias_evento`
  WHERE `evento_id` = NEW.`evento_id`
    AND `status` = 'FECHADA'
) OR EXISTS (
  SELECT 1 FROM `portaria_fechamento_locks`
  WHERE `evento_id` = NEW.`evento_id`
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
    AND `status` = 'FECHADA'
) OR EXISTS (
  SELECT 1 FROM `portaria_fechamento_locks`
  WHERE `evento_id` = NEW.`evento_id`
)
BEGIN
  SELECT RAISE(ABORT, 'PORTARIA_NAO_ABERTA');
END;
