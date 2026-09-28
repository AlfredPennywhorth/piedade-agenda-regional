-- Provisiona a função canônica DCO e garante unicidade de códigos de função.
-- Preserva uma DCO já cadastrada manualmente em ambientes existentes.

INSERT INTO funcoes (id, nome, codigo, descricao, ativo, created_at, updated_at)
SELECT
  'funcao-dco-canonica',
  'Diácono Casa de Oração',
  'DCO',
  'Função canônica vinculada automaticamente ao Diácono em sua Casa de Oração.',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM funcoes WHERE codigo = 'DCO'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_funcoes_codigo_unico
ON funcoes(codigo)
WHERE codigo IS NOT NULL;
