-- Garante no banco a regra de uma única convocação por evento.
--
-- Antes de criar o índice UNIQUE, saneia quatro duplicatas históricas
-- identificadas no ambiente Beta em 29/09/2026. Os registros preservados são:
--
--   Ensaio Local:
--     79649ef2-8c87-4ca2-80a8-93d19d3511f6
--   Reunião GT Secretaria:
--     f2f327e7-3b90-48e5-a13d-231d92fddb96
--   Reunião Sigilo Setor Centro:
--     96723763-2304-473b-aa1d-81c79bc4bbd3
--
-- As quatro convocações removidas foram diagnosticadas individualmente:
--   3bd8a921-8e93-4980-b486-cb4a6ae18d92
--     publicada, mas sem destinatários/RSVP/check-ins;
--   ea6efa9f-0846-4688-97ed-5cf018ee9a81
--     cancelada; seu destinatário aparece novamente na convocação preservada;
--   af588224-8a15-4526-9d45-38328c262536
--     cancelada; seu destinatário aparece novamente na convocação preservada;
--   7dd99c75-87be-4a68-a2e5-d5cd84cfbef0
--     publicada após a ocorrência do evento, sem RSVP/check-in; o destinatário
--     já consta na convocação preservada com RSVP e check-in.
--
-- Os logs em auditoria_logs NÃO são apagados: eles permanecem como trilha
-- histórica das tentativas anteriores. recurso_id não possui FK para convocacoes.
--
-- A ordem abaixo respeita as FKs. Se ainda existir qualquer outra duplicidade
-- de evento_id, a criação do UNIQUE falhará e o D1 fará rollback desta migration.

-- 1. Remover dependências dos destinatários das convocações descartadas.
DELETE FROM rsvp
WHERE convocacao_destinatario_id IN (
  SELECT id
  FROM convocacao_destinatarios
  WHERE convocacao_id IN (
    '3bd8a921-8e93-4980-b486-cb4a6ae18d92',
    'ea6efa9f-0846-4688-97ed-5cf018ee9a81',
    'af588224-8a15-4526-9d45-38328c262536',
    '7dd99c75-87be-4a68-a2e5-d5cd84cfbef0'
  )
);

DELETE FROM checkins
WHERE convocacao_destinatario_id IN (
  SELECT id
  FROM convocacao_destinatarios
  WHERE convocacao_id IN (
    '3bd8a921-8e93-4980-b486-cb4a6ae18d92',
    'ea6efa9f-0846-4688-97ed-5cf018ee9a81',
    'af588224-8a15-4526-9d45-38328c262536',
    '7dd99c75-87be-4a68-a2e5-d5cd84cfbef0'
  )
);

DELETE FROM convocacao_destinatario_evidencias
WHERE convocacao_destinatario_id IN (
  SELECT id
  FROM convocacao_destinatarios
  WHERE convocacao_id IN (
    '3bd8a921-8e93-4980-b486-cb4a6ae18d92',
    'ea6efa9f-0846-4688-97ed-5cf018ee9a81',
    'af588224-8a15-4526-9d45-38328c262536',
    '7dd99c75-87be-4a68-a2e5-d5cd84cfbef0'
  )
);

-- 2. Remover relações diretamente ligadas às convocações descartadas.
DELETE FROM convocacao_destinatarios
WHERE convocacao_id IN (
  '3bd8a921-8e93-4980-b486-cb4a6ae18d92',
  'ea6efa9f-0846-4688-97ed-5cf018ee9a81',
  'af588224-8a15-4526-9d45-38328c262536',
  '7dd99c75-87be-4a68-a2e5-d5cd84cfbef0'
);

DELETE FROM convocacao_funcoes
WHERE convocacao_id IN (
  '3bd8a921-8e93-4980-b486-cb4a6ae18d92',
  'ea6efa9f-0846-4688-97ed-5cf018ee9a81',
  'af588224-8a15-4526-9d45-38328c262536',
  '7dd99c75-87be-4a68-a2e5-d5cd84cfbef0'
);

-- 3. Remover somente as quatro convocações redundantes diagnosticadas.
DELETE FROM convocacoes
WHERE id IN (
  '3bd8a921-8e93-4980-b486-cb4a6ae18d92',
  'ea6efa9f-0846-4688-97ed-5cf018ee9a81',
  'af588224-8a15-4526-9d45-38328c262536',
  '7dd99c75-87be-4a68-a2e5-d5cd84cfbef0'
);

-- 4. Aplicar a regra definitiva 1 evento -> 1 convocação.
DROP INDEX IF EXISTS idx_convocacoes_evento_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_convocacoes_evento_unico
  ON convocacoes (evento_id);
