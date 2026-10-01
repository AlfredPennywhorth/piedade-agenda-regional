ALTER TABLE eventos
ADD COLUMN agenda_revisao text NOT NULL DEFAULT '';

UPDATE eventos
SET agenda_revisao = COALESCE(updated_at, created_at, '')
WHERE agenda_revisao = '';
