CREATE TABLE `rate_limits_autenticacao` (
  `chave_hash` text PRIMARY KEY NOT NULL,
  `falhas_consecutivas` integer DEFAULT 0 NOT NULL,
  `bloqueado_ate` text,
  `expira_em` text NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);

CREATE INDEX `idx_rate_limits_autenticacao_expira_em` ON `rate_limits_autenticacao` (`expira_em`);