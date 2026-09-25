-- S13.01 — remoção definitiva de data de nascimento
-- O campo não integra mais cadastro, autenticação, recuperação ou relatórios.
ALTER TABLE membros DROP COLUMN data_nascimento;
