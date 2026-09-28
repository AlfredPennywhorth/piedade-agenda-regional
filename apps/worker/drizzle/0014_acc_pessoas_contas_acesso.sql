-- PR-ACC-01 — separação progressiva entre Pessoa/Membro e Conta de Acesso
--
-- Estratégia expand-only:
-- 1. preserva dados e colunas legadas durante a transição;
-- 2. não atribui data de nascimento como data de ordenação;
-- 3. cria conta somente quando há evidência de acesso existente;
-- 4. adiciona referências de conta sem remover membro_id nesta etapa.

ALTER TABLE `membros` ADD `data_ordenacao` text;
ALTER TABLE `membros` ADD `codigo_carteirinha` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `membros_codigo_carteirinha_unique`
ON `membros` (`codigo_carteirinha`)
WHERE `codigo_carteirinha` IS NOT NULL;
--> statement-breakpoint

CREATE TABLE `contas_acesso` (
  `id` text PRIMARY KEY NOT NULL,
  `membro_id` text NOT NULL,
  `status` text DEFAULT 'PENDENTE_ATIVACAO' NOT NULL,
  `pin_hash` text,
  `pin_salt` text,
  `bloqueado_ate` text,
  `tentativas_pin` integer DEFAULT 0 NOT NULL,
  `ativado_em` text,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`membro_id`) REFERENCES `membros`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT `check_conta_acesso_status`
    CHECK (`status` IN ('PENDENTE_ATIVACAO', 'ATIVA', 'BLOQUEADA', 'DESATIVADA'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contas_acesso_membro_id_unique` ON `contas_acesso` (`membro_id`);
--> statement-breakpoint
CREATE INDEX `idx_contas_acesso_status` ON `contas_acesso` (`status`);
--> statement-breakpoint

INSERT INTO `contas_acesso` (
  `id`,
  `membro_id`,
  `status`,
  `pin_hash`,
  `pin_salt`,
  `bloqueado_ate`,
  `tentativas_pin`,
  `ativado_em`,
  `created_at`,
  `updated_at`
)
SELECT
  lower(hex(randomblob(4))) || '-' ||
  lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6))),
  m.`id`,
  CASE
    WHEN m.`ativo` = 0 THEN 'DESATIVADA'
    WHEN m.`autenticacao_ativa` = 1 THEN 'ATIVA'
    ELSE 'PENDENTE_ATIVACAO'
  END,
  m.`pin_hash`,
  m.`pin_salt`,
  m.`bloqueado_ate`,
  m.`tentativas_pin`,
  m.`ativado_em`,
  m.`created_at`,
  m.`updated_at`
FROM `membros` m
WHERE
  m.`autenticacao_ativa` = 1
  OR m.`pin_hash` IS NOT NULL
  OR EXISTS (SELECT 1 FROM `links_ativacao` l WHERE l.`membro_id` = m.`id`)
  OR EXISTS (SELECT 1 FROM `sessoes` s WHERE s.`membro_id` = m.`id`);
--> statement-breakpoint

ALTER TABLE `links_ativacao` ADD `conta_acesso_id` text
  REFERENCES `contas_acesso`(`id`);
ALTER TABLE `sessoes` ADD `conta_acesso_id` text
  REFERENCES `contas_acesso`(`id`);
ALTER TABLE `tentativas_acesso` ADD `conta_acesso_id` text
  REFERENCES `contas_acesso`(`id`);
--> statement-breakpoint

UPDATE `links_ativacao`
SET `conta_acesso_id` = (
  SELECT c.`id`
  FROM `contas_acesso` c
  WHERE c.`membro_id` = `links_ativacao`.`membro_id`
);
UPDATE `sessoes`
SET `conta_acesso_id` = (
  SELECT c.`id`
  FROM `contas_acesso` c
  WHERE c.`membro_id` = `sessoes`.`membro_id`
);
UPDATE `tentativas_acesso`
SET `conta_acesso_id` = (
  SELECT c.`id`
  FROM `contas_acesso` c
  WHERE c.`membro_id` = `tentativas_acesso`.`membro_id`
)
WHERE `membro_id` IS NOT NULL;
--> statement-breakpoint

CREATE INDEX `idx_links_ativacao_conta_acesso`
ON `links_ativacao` (`conta_acesso_id`);
CREATE INDEX `idx_sessoes_conta_acesso`
ON `sessoes` (`conta_acesso_id`);
CREATE INDEX `idx_tentativas_acesso_conta_acesso`
ON `tentativas_acesso` (`conta_acesso_id`);
