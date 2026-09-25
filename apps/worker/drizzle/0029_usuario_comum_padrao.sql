-- BETA — acesso padrão para contas existentes
-- Todo usuário autenticável mantém USUARIO_COMUM no escopo de sua Casa de Oração.
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
      AND a.ativo = 1
  );
