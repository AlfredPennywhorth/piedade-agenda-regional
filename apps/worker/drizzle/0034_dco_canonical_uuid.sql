-- Normaliza a função canônica DCO criada pela migration 0032 para um UUID válido.
-- Necessário porque os contratos públicos de vínculos e convocações validam funcaoId como UUID.
-- Preserva vínculos e evidências existentes antes de remover o identificador legado.

INSERT INTO funcoes (id, nome, codigo, descricao, ativo, created_at, updated_at)
SELECT
  'd0c0d0c0-0000-4000-8000-000000000001',
  nome,
  NULL,
  descricao,
  ativo,
  created_at,
  updated_at
FROM funcoes
WHERE id = 'funcao-dco-canonica';

UPDATE vinculos_funcionais
SET funcao_id = 'd0c0d0c0-0000-4000-8000-000000000001'
WHERE funcao_id = 'funcao-dco-canonica';

UPDATE convocacao_funcoes
SET funcao_id = 'd0c0d0c0-0000-4000-8000-000000000001'
WHERE funcao_id = 'funcao-dco-canonica';

UPDATE convocacao_destinatario_evidencias
SET funcao_id = 'd0c0d0c0-0000-4000-8000-000000000001'
WHERE funcao_id = 'funcao-dco-canonica';

DELETE FROM funcoes
WHERE id = 'funcao-dco-canonica';

UPDATE funcoes
SET
  codigo = 'DCO',
  nome = 'Diácono Casa de Oração',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'd0c0d0c0-0000-4000-8000-000000000001'
  AND NOT EXISTS (
    SELECT 1
    FROM funcoes
    WHERE codigo = 'DCO'
      AND id <> 'd0c0d0c0-0000-4000-8000-000000000001'
  );
