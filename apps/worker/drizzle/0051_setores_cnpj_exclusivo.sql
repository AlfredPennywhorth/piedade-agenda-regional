-- CNPJ exclusivo entre Setores; multiplos NULLs permitidos para cadastros legados.
-- Atenção: verificar previamente SELECT cnpj, COUNT(*) FROM setores
-- WHERE cnpj IS NOT NULL GROUP BY cnpj HAVING COUNT(*) > 1;
-- Duplicidades devem ser corrigidas mediante conferência institucional;
-- esta migração falha de propósito se dados existentes violarem a regra.
CREATE UNIQUE INDEX IF NOT EXISTS uq_setores_cnpj
  ON setores(cnpj)
  WHERE cnpj IS NOT NULL;
