CREATE UNIQUE INDEX `membros_celular_unique` ON `membros` (`celular`);

ALTER TABLE sessoes ADD COLUMN updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL;
