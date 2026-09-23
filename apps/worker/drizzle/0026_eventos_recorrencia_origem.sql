-- S05 hardening — preservar o slot original de uma ocorrência recorrente.
ALTER TABLE eventos ADD COLUMN recorrencia_origem_inicio_em TEXT;

-- Para ocorrências já existentes, o melhor slot conhecido é o início atual.
-- Novas alterações individuais manterão este valor estável.
UPDATE eventos
SET recorrencia_origem_inicio_em = inicio_em
WHERE serie_recorrencia_id IS NOT NULL
  AND recorrencia_origem_inicio_em IS NULL;
