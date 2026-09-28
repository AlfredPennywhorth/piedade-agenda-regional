CREATE TABLE `push_subscriptions` (
  `id` text PRIMARY KEY NOT NULL,
  `membro_id` text NOT NULL,
  `endpoint` text NOT NULL,
  `p256dh` text NOT NULL,
  `auth` text NOT NULL,
  `user_agent` text,
  `ativo` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  FOREIGN KEY (`membro_id`) REFERENCES `membros`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);

CREATE UNIQUE INDEX `idx_push_endpoint` ON `push_subscriptions` (`endpoint`);
CREATE INDEX `idx_push_membro` ON `push_subscriptions` (`membro_id`);
