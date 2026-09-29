-- Consolida a DCO técnica das migrations 0032/0034 com uma função
-- institucional "Diácono Casa de Oração" já existente no ambiente.
--
-- A migration é deliberadamente agnóstica ao ID institucional:
-- - só atua se houver uma DCO técnica conhecida E exatamente uma função institucional
--   homônima com ID diferente;
-- - em Produção, onde existe somente a função institucional DCO e nenhum registro
--   técnico transitório, todas as operações abaixo são no-op;
-- - em ambientes novos, sem função institucional preexistente, a DCO UUID da 0034
--   permanece como canônica.

-- Libera o código DCO dos registros técnicos somente quando a consolidação é inequívoca.
UPDATE funcoes
SET codigo = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  'funcao-dco-canonica',
  'd0c0d0c0-0000-4000-8000-000000000001'
)
AND EXISTS (
  SELECT 1
  FROM funcoes
  WHERE id IN (
    'funcao-dco-canonica',
    'd0c0d0c0-0000-4000-8000-000000000001'
  )
)
AND (
  SELECT COUNT(*)
  FROM funcoes
  WHERE nome = 'Diácono Casa de Oração'
    AND id NOT IN (
      'funcao-dco-canonica',
      'd0c0d0c0-0000-4000-8000-000000000001'
    )
) = 1;

-- Se já houver vínculo ativo equivalente na função institucional, preserva o vínculo
-- técnico para histórico, mas o torna inativo para evitar duplicidade operacional.
UPDATE vinculos_funcionais AS src
SET ativo = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE src.funcao_id IN (
  'funcao-dco-canonica',
  'd0c0d0c0-0000-4000-8000-000000000001'
)
AND src.ativo = 1
AND EXISTS (
  SELECT 1
  FROM funcoes
  WHERE id IN (
    'funcao-dco-canonica',
    'd0c0d0c0-0000-4000-8000-000000000001'
  )
)
AND (
  SELECT COUNT(*)
  FROM funcoes
  WHERE nome = 'Diácono Casa de Oração'
    AND id NOT IN (
      'funcao-dco-canonica',
      'd0c0d0c0-0000-4000-8000-000000000001'
    )
) = 1
AND EXISTS (
  SELECT 1
  FROM vinculos_funcionais AS tgt
  WHERE tgt.funcao_id = (
  SELECT id
  FROM funcoes
  WHERE nome = 'Diácono Casa de Oração'
    AND id NOT IN (
      'funcao-dco-canonica',
      'd0c0d0c0-0000-4000-8000-000000000001'
    )
  LIMIT 1
)
    AND tgt.ativo = 1
    AND tgt.membro_id = src.membro_id
    AND tgt.regional_id IS src.regional_id
    AND tgt.administracao_id IS src.administracao_id
    AND tgt.setor_id IS src.setor_id
    AND tgt.casa_id IS src.casa_id
    AND tgt.grupo_trabalho_id IS src.grupo_trabalho_id
);

-- Evidências ligadas a vínculos técnicos que ainda serão promovidos acompanham o vínculo.
UPDATE convocacao_destinatario_evidencias
SET funcao_id = (
  SELECT id
  FROM funcoes
  WHERE nome = 'Diácono Casa de Oração'
    AND id NOT IN (
      'funcao-dco-canonica',
      'd0c0d0c0-0000-4000-8000-000000000001'
    )
  LIMIT 1
)
WHERE funcao_id IN (
  'funcao-dco-canonica',
  'd0c0d0c0-0000-4000-8000-000000000001'
)
AND vinculo_funcional_id IN (
  SELECT id
  FROM vinculos_funcionais
  WHERE funcao_id IN (
    'funcao-dco-canonica',
    'd0c0d0c0-0000-4000-8000-000000000001'
  )
  AND ativo = 1
)
AND EXISTS (
  SELECT 1
  FROM funcoes
  WHERE id IN (
    'funcao-dco-canonica',
    'd0c0d0c0-0000-4000-8000-000000000001'
  )
)
AND (
  SELECT COUNT(*)
  FROM funcoes
  WHERE nome = 'Diácono Casa de Oração'
    AND id NOT IN (
      'funcao-dco-canonica',
      'd0c0d0c0-0000-4000-8000-000000000001'
    )
) = 1;

-- Reaponta vínculos técnicos ativos que não colidiram com vínculo institucional existente.
UPDATE vinculos_funcionais
SET funcao_id = (
  SELECT id
  FROM funcoes
  WHERE nome = 'Diácono Casa de Oração'
    AND id NOT IN (
      'funcao-dco-canonica',
      'd0c0d0c0-0000-4000-8000-000000000001'
    )
  LIMIT 1
),
    updated_at = CURRENT_TIMESTAMP
WHERE funcao_id IN (
  'funcao-dco-canonica',
  'd0c0d0c0-0000-4000-8000-000000000001'
)
AND ativo = 1
AND EXISTS (
  SELECT 1
  FROM funcoes
  WHERE id IN (
    'funcao-dco-canonica',
    'd0c0d0c0-0000-4000-8000-000000000001'
  )
)
AND (
  SELECT COUNT(*)
  FROM funcoes
  WHERE nome = 'Diácono Casa de Oração'
    AND id NOT IN (
      'funcao-dco-canonica',
      'd0c0d0c0-0000-4000-8000-000000000001'
    )
) = 1;

-- Em rascunhos, remove associação técnica se a função institucional já estiver
-- vinculada à mesma convocação.
DELETE FROM convocacao_funcoes AS src
WHERE src.funcao_id IN (
  'funcao-dco-canonica',
  'd0c0d0c0-0000-4000-8000-000000000001'
)
AND EXISTS (
  SELECT 1
  FROM funcoes
  WHERE id IN (
    'funcao-dco-canonica',
    'd0c0d0c0-0000-4000-8000-000000000001'
  )
)
AND (
  SELECT COUNT(*)
  FROM funcoes
  WHERE nome = 'Diácono Casa de Oração'
    AND id NOT IN (
      'funcao-dco-canonica',
      'd0c0d0c0-0000-4000-8000-000000000001'
    )
) = 1
AND EXISTS (
  SELECT 1
  FROM convocacoes c
  WHERE c.id = src.convocacao_id
    AND c.status = 'RASCUNHO'
)
AND EXISTS (
  SELECT 1
  FROM convocacao_funcoes tgt
  WHERE tgt.convocacao_id = src.convocacao_id
    AND tgt.funcao_id = (
  SELECT id
  FROM funcoes
  WHERE nome = 'Diácono Casa de Oração'
    AND id NOT IN (
      'funcao-dco-canonica',
      'd0c0d0c0-0000-4000-8000-000000000001'
    )
  LIMIT 1
)
);

-- Rascunhos restantes passam a usar a função institucional. Publicadas/canceladas
-- permanecem imutáveis para preservar o snapshot histórico.
UPDATE convocacao_funcoes
SET funcao_id = (
  SELECT id
  FROM funcoes
  WHERE nome = 'Diácono Casa de Oração'
    AND id NOT IN (
      'funcao-dco-canonica',
      'd0c0d0c0-0000-4000-8000-000000000001'
    )
  LIMIT 1
)
WHERE funcao_id IN (
  'funcao-dco-canonica',
  'd0c0d0c0-0000-4000-8000-000000000001'
)
AND convocacao_id IN (
  SELECT id
  FROM convocacoes
  WHERE status = 'RASCUNHO'
)
AND EXISTS (
  SELECT 1
  FROM funcoes
  WHERE id IN (
    'funcao-dco-canonica',
    'd0c0d0c0-0000-4000-8000-000000000001'
  )
)
AND (
  SELECT COUNT(*)
  FROM funcoes
  WHERE nome = 'Diácono Casa de Oração'
    AND id NOT IN (
      'funcao-dco-canonica',
      'd0c0d0c0-0000-4000-8000-000000000001'
    )
) = 1;

-- A função institucional encontrada passa a ser a única DCO operacional.
UPDATE funcoes
SET codigo = 'DCO',
    nome = 'Diácono Casa de Oração',
    ativo = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = (
  SELECT id
  FROM funcoes
  WHERE nome = 'Diácono Casa de Oração'
    AND id NOT IN (
      'funcao-dco-canonica',
      'd0c0d0c0-0000-4000-8000-000000000001'
    )
  LIMIT 1
)
AND EXISTS (
  SELECT 1
  FROM funcoes
  WHERE id IN (
    'funcao-dco-canonica',
    'd0c0d0c0-0000-4000-8000-000000000001'
  )
)
AND (
  SELECT COUNT(*)
  FROM funcoes
  WHERE nome = 'Diácono Casa de Oração'
    AND id NOT IN (
      'funcao-dco-canonica',
      'd0c0d0c0-0000-4000-8000-000000000001'
    )
) = 1;

-- Registros técnicos permanecem apenas para integridade histórica.
UPDATE funcoes
SET codigo = NULL,
    ativo = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  'funcao-dco-canonica',
  'd0c0d0c0-0000-4000-8000-000000000001'
)
AND EXISTS (
  SELECT 1
  FROM funcoes
  WHERE id IN (
    'funcao-dco-canonica',
    'd0c0d0c0-0000-4000-8000-000000000001'
  )
)
AND (
  SELECT COUNT(*)
  FROM funcoes
  WHERE nome = 'Diácono Casa de Oração'
    AND id NOT IN (
      'funcao-dco-canonica',
      'd0c0d0c0-0000-4000-8000-000000000001'
    )
) = 1;
