-- PR-ACC-03 — perfis técnicos, escopos e governança de acesso
-- Estratégia expand-only: nenhuma tabela ou coluna existente é removida.

CREATE TABLE `perfis_acesso` (
  `codigo` text PRIMARY KEY NOT NULL,
  `nome` text NOT NULL,
  `descricao` text NOT NULL,
  `ativo` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  CONSTRAINT `check_perfil_acesso_ativo` CHECK (`ativo` IN (0, 1))
);
--> statement-breakpoint

INSERT INTO `perfis_acesso` (`codigo`, `nome`, `descricao`) VALUES
  ('MASTER_SISTEMA', 'Master do Sistema', 'Governança global, contingência e criação inicial de Regionais.'),
  ('ADMINISTRADOR_SISTEMA', 'Administrador do Sistema', 'Administração de pessoas, contas, perfis e acessos de uma Regional.'),
  ('GESTOR_AGENDA', 'Gestor de Agenda', 'Gestão de eventos, convocações e processos de agenda autorizados.'),
  ('OPERADOR_PORTARIA_PERMANENTE', 'Operador de Portaria permanente', 'Operação permanente de Portaria no escopo autorizado.'),
  ('GESTOR_RELATORIOS', 'Gestor de Relatórios', 'Consulta de relatórios autorizados.'),
  ('AUDITOR', 'Auditor', 'Consulta da auditoria no escopo autorizado.'),
  ('USUARIO_COMUM', 'Usuário comum', 'Agenda, RSVP e ações pessoais permitidas.');
--> statement-breakpoint

CREATE TABLE `acessos_conta` (
  `id` text PRIMARY KEY NOT NULL,
  `conta_acesso_id` text NOT NULL,
  `perfil_codigo` text NOT NULL,
  `escopo_tipo` text NOT NULL,
  `escopo_id` text,
  `concedido_por_conta_id` text,
  `revogado_por_conta_id` text,
  `revogado_em` text,
  `ativo` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`conta_acesso_id`) REFERENCES `contas_acesso`(`id`),
  FOREIGN KEY (`perfil_codigo`) REFERENCES `perfis_acesso`(`codigo`),
  FOREIGN KEY (`concedido_por_conta_id`) REFERENCES `contas_acesso`(`id`),
  FOREIGN KEY (`revogado_por_conta_id`) REFERENCES `contas_acesso`(`id`),
  CONSTRAINT `check_acesso_conta_ativo` CHECK (`ativo` IN (0, 1)),
  CONSTRAINT `check_acesso_conta_escopo` CHECK (
    (`escopo_tipo` = 'GLOBAL' AND `escopo_id` IS NULL)
    OR
    (`escopo_tipo` IN ('REGIONAL', 'ADMINISTRACAO', 'SETOR', 'CASA', 'GRUPO_TRABALHO')
      AND `escopo_id` IS NOT NULL)
  ),
  CONSTRAINT `check_master_somente_global` CHECK (
    (`perfil_codigo` = 'MASTER_SISTEMA' AND `escopo_tipo` = 'GLOBAL' AND `escopo_id` IS NULL)
    OR
    (`perfil_codigo` <> 'MASTER_SISTEMA' AND `escopo_tipo` <> 'GLOBAL')
  ),
  CONSTRAINT `check_admin_somente_regional` CHECK (
    `perfil_codigo` <> 'ADMINISTRADOR_SISTEMA' OR `escopo_tipo` = 'REGIONAL'
  ),
  CONSTRAINT `check_auditor_escopo` CHECK (
    `perfil_codigo` <> 'AUDITOR' OR `escopo_tipo` IN ('REGIONAL', 'ADMINISTRACAO')
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_acesso_conta_ativo_unico`
ON `acessos_conta` (
  `conta_acesso_id`,
  `perfil_codigo`,
  `escopo_tipo`,
  ifnull(`escopo_id`, '')
)
WHERE `ativo` = 1;
CREATE INDEX `idx_acessos_conta_conta` ON `acessos_conta` (`conta_acesso_id`, `ativo`);
CREATE INDEX `idx_acessos_conta_escopo` ON `acessos_conta` (`escopo_tipo`, `escopo_id`, `ativo`);
--> statement-breakpoint

CREATE TABLE `ciencias_responsabilidade` (
  `id` text PRIMARY KEY NOT NULL,
  `conta_acesso_id` text NOT NULL,
  `acesso_conta_id` text NOT NULL,
  `tipo` text NOT NULL,
  `versao_texto` text NOT NULL,
  `texto_hash` text NOT NULL,
  `ciente_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`conta_acesso_id`) REFERENCES `contas_acesso`(`id`),
  FOREIGN KEY (`acesso_conta_id`) REFERENCES `acessos_conta`(`id`),
  CONSTRAINT `check_ciencia_tipo` CHECK (
    `tipo` IN ('RESPONSAVEL_REGIONAL_PMO', 'AVISO_PRIVACIDADE')
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ciencia_responsabilidade_unica`
ON `ciencias_responsabilidade` (
  `conta_acesso_id`, `acesso_conta_id`, `tipo`, `versao_texto`
);
--> statement-breakpoint

CREATE TABLE `bootstrap_master` (
  `id` text PRIMARY KEY NOT NULL,
  `conta_acesso_id` text NOT NULL,
  `concluido_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`conta_acesso_id`) REFERENCES `contas_acesso`(`id`),
  CONSTRAINT `check_bootstrap_master_unico` CHECK (`id` = 'PRIMEIRO_MASTER')
);
--> statement-breakpoint

ALTER TABLE `auditoria_logs` ADD `ator_conta_acesso_id` text
  REFERENCES `contas_acesso`(`id`);
--> statement-breakpoint
CREATE INDEX `idx_auditoria_ator_conta`
ON `auditoria_logs` (`ator_conta_acesso_id`);
