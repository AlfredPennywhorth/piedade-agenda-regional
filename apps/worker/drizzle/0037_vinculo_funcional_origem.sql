-- Registra de forma positiva a origem dos vínculos funcionais criados
-- automaticamente pelo fluxo institucional de Membros.
--
-- Registros existentes permanecem NULL deliberadamente: vínculos legados não
-- podem ser classificados com segurança como automáticos apenas por função,
-- escopo ou ausência de auditoria. Assim, a exclusão de membro permanece
-- fail-closed para qualquer dependência histórica ambígua.

ALTER TABLE vinculos_funcionais
ADD COLUMN origem TEXT;
