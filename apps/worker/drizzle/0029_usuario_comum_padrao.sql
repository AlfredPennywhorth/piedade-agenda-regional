-- BETA — acesso padrão canônico para contas existentes
-- USUARIO_COMUM deve existir somente no escopo CASA correspondente à Casa atual do membro.

-- 1. Retira acessos comuns ativos que apontem para nível ou Casa incorretos.
UPDATE acessos_conta
SET
  ativo = 0,
  revogado_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE perfil_codigo = 'USUARIO_COMUM'
  AND ativo = 1
  AND NOT (
    escopo_tipo = 'CASA'
    AND escopo_id = (
      SELECT m.casa_id
      FROM contas_acesso c
      INNER JOIN membros m ON m.id = c.membro_id
      WHERE c.id = acessos_conta.conta_acesso_id
    )
  );

-- 2. Garante exatamente um acesso comum ativo na Casa atual quando ainda não houver o canônico.
INSERT INTO acessos_conta (
  id,
  conta_acesso_id,
  perfil_codigo,
  escopo_tipo,
  escopo_id,
  ativo,
  created_at,
  updated_at
)
SELECT
  lower(hex(randomblob(16))),
  c.id,
  'USUARIO_COMUM',
  'CASA',
  m.casa_id,
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM contas_acesso c
INNER JOIN membros m ON m.id = c.membro_id
WHERE m.casa_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM acessos_conta a
    WHERE a.conta_acesso_id = c.id
      AND a.perfil_codigo = 'USUARIO_COMUM'
      AND a.escopo_tipo = 'CASA'
      AND a.escopo_id = m.casa_id
      AND a.ativo = 1
  );
