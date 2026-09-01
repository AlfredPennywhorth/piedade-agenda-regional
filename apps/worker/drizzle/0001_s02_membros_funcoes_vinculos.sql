CREATE TABLE `membros` (
  `id` text PRIMARY KEY NOT NULL,
  `nome` text NOT NULL,
  `data_nascimento` text,
  `celular` text,
  `casa_id` text NOT NULL,
  `ativo` integer DEFAULT true NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`casa_id`) REFERENCES `casas`(`id`)
);

CREATE TABLE `funcoes` (
  `id` text PRIMARY KEY NOT NULL,
  `nome` text NOT NULL,
  `codigo` text,
  `descricao` text,
  `ativo` integer DEFAULT true NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);

CREATE TABLE `vinculos_funcionais` (
  `id` text PRIMARY KEY NOT NULL,
  `membro_id` text NOT NULL,
  `funcao_id` text NOT NULL,
  `regional_id` text,
  `administracao_id` text,
  `setor_id` text,
  `casa_id` text,
  `grupo_trabalho_id` text,
  `ativo` integer DEFAULT true NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,

  FOREIGN KEY (`membro_id`) REFERENCES `membros`(`id`),
  FOREIGN KEY (`funcao_id`) REFERENCES `funcoes`(`id`),
  FOREIGN KEY (`regional_id`) REFERENCES `regionais`(`id`),
  FOREIGN KEY (`administracao_id`) REFERENCES `administracoes`(`id`),
  FOREIGN KEY (`setor_id`) REFERENCES `setores`(`id`),
  FOREIGN KEY (`casa_id`) REFERENCES `casas`(`id`),
  FOREIGN KEY (`grupo_trabalho_id`) REFERENCES `grupos_trabalho`(`id`),

  CONSTRAINT `check_vinculo_escopo_unico` CHECK (
    (CASE WHEN `regional_id` IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN `administracao_id` IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN `setor_id` IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN `casa_id` IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN `grupo_trabalho_id` IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

CREATE UNIQUE INDEX `idx_vinculo_unico_regional`
ON `vinculos_funcionais` (`membro_id`, `funcao_id`, `regional_id`)
WHERE `regional_id` IS NOT NULL AND `ativo` = 1;

CREATE UNIQUE INDEX `idx_vinculo_unico_administracao`
ON `vinculos_funcionais` (`membro_id`, `funcao_id`, `administracao_id`)
WHERE `administracao_id` IS NOT NULL AND `ativo` = 1;

CREATE UNIQUE INDEX `idx_vinculo_unico_setor`
ON `vinculos_funcionais` (`membro_id`, `funcao_id`, `setor_id`)
WHERE `setor_id` IS NOT NULL AND `ativo` = 1;

CREATE UNIQUE INDEX `idx_vinculo_unico_casa`
ON `vinculos_funcionais` (`membro_id`, `funcao_id`, `casa_id`)
WHERE `casa_id` IS NOT NULL AND `ativo` = 1;

CREATE UNIQUE INDEX `idx_vinculo_unico_gt`
ON `vinculos_funcionais` (`membro_id`, `funcao_id`, `grupo_trabalho_id`)
WHERE `grupo_trabalho_id` IS NOT NULL AND `ativo` = 1;
