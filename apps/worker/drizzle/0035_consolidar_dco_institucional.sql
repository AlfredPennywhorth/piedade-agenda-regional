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

-- Remove somente evidência técnica que se tornaria duplicata exata após a
-- canonicalização. A evidência institucional equivalente já preserva o mesmo
-- destinatário e vínculo funcional.
DELETE FROM convocacao_destinatario_evidencias AS src
WHERE src.funcao_id IN (
  'funcao-dco-canonica',
  'd0c0d0c0-0000-4000-8000-000000000001'
)
AND src.vinculo_funcional_id IN (
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
) = 1
AND EXISTS (
  SELECT 1
  FROM convocacao_destinatario_evidencias tgt
  WHERE tgt.convocacao_destinatario_id = src.convocacao_destinatario_id
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
    AND tgt.vinculo_funcional_id = src.vinculo_funcional_id
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

-- Canonicaliza também as funções associadas a convocações já publicadas/canceladas.
-- Isso não altera o snapshot de destinatários; apenas substitui o ID técnico pelo ID
-- institucional semanticamente equivalente, mantendo a sincronização retroativa de
-- vínculos futuros baseada em igualdade de funcao_id.
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
