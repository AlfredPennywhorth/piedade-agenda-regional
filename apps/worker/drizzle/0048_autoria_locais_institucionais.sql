-- Autoria registrada para locais institucionais novos. Não atribuir autoria retroativa.
ALTER TABLE locais ADD COLUMN criador_institucional_membro_id text REFERENCES membros(id);
CREATE INDEX idx_locais_criador_institucional ON locais(criador_institucional_membro_id);
