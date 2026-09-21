CREATE TABLE `portaria_fechamentos` (
  `id` text PRIMARY KEY NOT NULL,
  `evento_id` text NOT NULL UNIQUE,
  `fechado_por_membro_id` text,
  `fechado_em` text NOT NULL,
  `total_convocados` integer DEFAULT 0 NOT NULL,
  `total_convocados_presentes` integer DEFAULT 0 NOT NULL,
  `total_convocados_ausentes` integer DEFAULT 0 NOT NULL,
  `total_convidados_validados` integer DEFAULT 0 NOT NULL,
  `total_convidados_pendentes` integer DEFAULT 0 NOT NULL,
  `total_presentes` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`),
  FOREIGN KEY (`fechado_por_membro_id`) REFERENCES `membros`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_portaria_fechamento_evento`
  ON `portaria_fechamentos` (`evento_id`);
--> statement-breakpoint
CREATE TABLE `portaria_fechamento_itens` (
  `id` text PRIMARY KEY NOT NULL,
  `fechamento_id` text NOT NULL,
  `evento_id` text NOT NULL,
  `tipo_pessoa` text NOT NULL,
  `origem_id` text NOT NULL,
  `nome` text NOT NULL,
  `localidade` text,
  `situacao` text NOT NULL,
  `resposta_rsvp` text,
  `forma_presenca` text,
  `registrado_em` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`fechamento_id`) REFERENCES `portaria_fechamentos`(`id`),
  FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`),
  CONSTRAINT `check_portaria_fechamento_tipo_pessoa`
    CHECK (`tipo_pessoa` IN ('MEMBRO','CONVIDADO')),
  CONSTRAINT `check_portaria_fechamento_situacao`
    CHECK (`situacao` IN ('PRESENTE','AUSENTE','PENDENTE'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_portaria_fechamento_origem_unica`
  ON `portaria_fechamento_itens` (`fechamento_id`, `tipo_pessoa`, `origem_id`);
--> statement-breakpoint
CREATE INDEX `idx_portaria_fechamento_itens_evento`
  ON `portaria_fechamento_itens` (`evento_id`);
