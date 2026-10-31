-- Campo institucional do Setor: aditivo, sem obrigatoriedade e sem unicidade.
-- Casas e Pontos de Atendimento não recebem CNPJ próprio.
ALTER TABLE setores ADD COLUMN cnpj TEXT;
