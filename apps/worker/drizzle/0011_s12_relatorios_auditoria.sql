CREATE TABLE `auditoria_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `acao` text NOT NULL,
  `ator_membro_id` text NOT NULL,
  `recurso_tipo` text NOT NULL,
  `recurso_id` text NOT NULL,
  `escopo_tipo` text,
  `escopo_id` text,
  `contexto` text,
  `ip` text,
  `user_agent` text,
  `criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`ator_membro_id`) REFERENCES `membros`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE INDEX `idx_auditoria_acao` ON `auditoria_logs` (`acao`);
CREATE INDEX `idx_auditoria_ator` ON `auditoria_logs` (`ator_membro_id`);
CREATE INDEX `idx_auditoria_recurso` ON `auditoria_logs` (`recurso_tipo`, `recurso_id`);
CREATE INDEX `idx_auditoria_escopo` ON `auditoria_logs` (`escopo_tipo`, `escopo_id`);
CREATE INDEX `idx_auditoria_criado_em` ON `auditoria_logs` (`criado_em`);
