ALTER TABLE eventos
ADD COLUMN agenda_revisao text;

UPDATE eventos
SET agenda_revisao = COALESCE(updated_at, created_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
WHERE agenda_revisao IS NULL;
