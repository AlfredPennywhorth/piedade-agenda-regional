-- Consolida a função DCO criada pelas migrations 0032/0034 com a função
-- institucional já existente nos ambientes Beta/Produção.
--
-- Regra:
-- - se a função institucional conhecida existir, ela passa a ser a DCO canônica;
-- - vínculos ativos sem colisão são reapontados preservando o próprio ID;
-- - vínculos ativos duplicados são apenas inativados para preservar evidências históricas;
-- - funções de convocações em RASCUNHO são reapontadas;
-- - convocações já PUBLICADAS/CANCELADAS e evidências históricas permanecem auditáveis;
-- - em ambientes novos, sem a função institucional preexistente, esta migration não altera
--   a DCO UUID provisionada pela 0034.

-- ID institucional já existente em Beta e Produção.
-- ID técnico transitório gerado pela 0034: d0c0d0c0-0000-4000-8000-000000000001.

-- Libera o código DCO dos registros técnicos somente quando o alvo institucional existe.
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
  WHERE id = 'a6fed6a4-7561-4ad9-b4e2-01fd73607859'
);

-- Se já houver um vínculo ativo equivalente no alvo institucional, preserva o vínculo
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
  WHERE id = 'a6fed6a4-7561-4ad9-b4e2-01fd73607859'
)
AND EXISTS (
  SELECT 1
  FROM vinculos_funcionais AS tgt
  WHERE tgt.funcao_id = 'a6fed6a4-7561-4ad9-b4e2-01fd73607859'
    AND tgt.ativo = 1
    AND tgt.membro_id = src.membro_id
    AND tgt.regional_id IS src.regional_id
    AND tgt.administracao_id IS src.administracao_id
    AND tgt.setor_id IS src.setor_id
    AND tgt.casa_id IS src.casa_id
    AND tgt.grupo_trabalho_id IS src.grupo_trabalho_id
);

-- Evidências que apontam para vínculos técnicos ainda ativos acompanharão o vínculo
-- quando ele for promovido para a função institucional.
UPDATE convocacao_destinatario_evidencias
SET funcao_id = 'a6fed6a4-7561-4ad9-b4e2-01fd73607859'
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
  WHERE id = 'a6fed6a4-7561-4ad9-b4e2-01fd73607859'
);

-- Reaponta vínculos técnicos ativos que não colidem com um vínculo institucional existente.
UPDATE vinculos_funcionais
SET funcao_id = 'a6fed6a4-7561-4ad9-b4e2-01fd73607859',
    updated_at = CURRENT_TIMESTAMP
WHERE funcao_id IN (
  'funcao-dco-canonica',
  'd0c0d0c0-0000-4000-8000-000000000001'
)
AND ativo = 1
AND EXISTS (
  SELECT 1
  FROM funcoes
  WHERE id = 'a6fed6a4-7561-4ad9-b4e2-01fd73607859'
);

-- Em rascunhos, remove a associação técnica se a função institucional já estiver
-- vinculada à mesma convocação.
DELETE FROM convocacao_funcoes AS src
WHERE src.funcao_id IN (
  'funcao-dco-canonica',
  'd0c0d0c0-0000-4000-8000-000000000001'
)
AND EXISTS (
  SELECT 1
  FROM funcoes
  WHERE id = 'a6fed6a4-7561-4ad9-b4e2-01fd73607859'
)
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
    AND tgt.funcao_id = 'a6fed6a4-7561-4ad9-b4e2-01fd73607859'
);

-- Rascunhos restantes passam a usar a função institucional. Publicadas/canceladas
-- permanecem imutáveis para preservar o snapshot histórico.
UPDATE convocacao_funcoes
SET funcao_id = 'a6fed6a4-7561-4ad9-b4e2-01fd73607859'
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
  WHERE id = 'a6fed6a4-7561-4ad9-b4e2-01fd73607859'
);

-- O registro institucional passa a ser a única DCO ativa.
UPDATE funcoes
SET codigo = 'DCO',
    nome = 'Diácono Casa de Oração',
    ativo = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'a6fed6a4-7561-4ad9-b4e2-01fd73607859';

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
  WHERE id = 'a6fed6a4-7561-4ad9-b4e2-01fd73607859'
);
