-- Impede gravações incompatíveis durante conversão territorial -> externa/pessoal.
-- No SQLite, os triggers são avaliados na mesma operação de escrita, sem TOCTOU.
-- Credenciais legadas podem continuar sendo revogadas (UPDATE ativo/revogado_em).
CREATE TRIGGER trg_portaria_bloquear_conversao_evento
BEFORE UPDATE OF abrangencia, pessoal ON eventos
WHEN (NEW.abrangencia IN ('NACIONAL','INTERNACIONAL') OR NEW.pessoal = 1)
 AND (OLD.abrangencia = 'TERRITORIAL' AND OLD.pessoal = 0)
 AND (
   EXISTS (SELECT 1 FROM portarias_evento WHERE evento_id = OLD.id)
   OR    EXISTS (SELECT 1 FROM portaria_operadores_evento WHERE evento_id = OLD.id)
   OR    EXISTS (SELECT 1 FROM credenciais_operador_portaria_evento WHERE evento_id = OLD.id)
   OR    EXISTS (SELECT 1 FROM credenciais_cadastro_portaria_evento WHERE evento_id = OLD.id)
   OR    EXISTS (SELECT 1 FROM portaria_solicitacoes_fechamento WHERE evento_id = OLD.id)
   OR    EXISTS (SELECT 1 FROM portaria_fechamento_locks WHERE evento_id = OLD.id)
   OR    EXISTS (SELECT 1 FROM portaria_fechamentos WHERE evento_id = OLD.id)
   OR    EXISTS (SELECT 1 FROM portaria_reaberturas WHERE evento_id = OLD.id)
   OR    EXISTS (SELECT 1 FROM convidados_evento WHERE evento_id = OLD.id)
   OR    EXISTS (SELECT 1 FROM presencas_convidado_evento WHERE evento_id = OLD.id)
 )
BEGIN SELECT RAISE(ABORT, 'EVENTO_COM_PORTARIA_NAO_PODE_MUDAR_ESCOPO'); END;

CREATE TRIGGER trg_portarias_evento_institucional_insert
BEFORE INSERT ON portarias_evento
WHEN NOT EXISTS (SELECT 1 FROM eventos e WHERE e.id = NEW.evento_id AND e.ativo = 1 AND e.pessoal = 0 AND e.abrangencia = 'TERRITORIAL')
BEGIN SELECT RAISE(ABORT, 'PORTARIA_EVENTO_INCOMPATIVEL'); END;

CREATE TRIGGER trg_portaria_operadores_evento_institucional_insert
BEFORE INSERT ON portaria_operadores_evento
WHEN NOT EXISTS (SELECT 1 FROM eventos e WHERE e.id = NEW.evento_id AND e.ativo = 1 AND e.pessoal = 0 AND e.abrangencia = 'TERRITORIAL')
BEGIN SELECT RAISE(ABORT, 'PORTARIA_EVENTO_INCOMPATIVEL'); END;

CREATE TRIGGER trg_credenciais_operador_portaria_evento_institucional_insert
BEFORE INSERT ON credenciais_operador_portaria_evento
WHEN NOT EXISTS (SELECT 1 FROM eventos e WHERE e.id = NEW.evento_id AND e.ativo = 1 AND e.pessoal = 0 AND e.abrangencia = 'TERRITORIAL')
BEGIN SELECT RAISE(ABORT, 'PORTARIA_EVENTO_INCOMPATIVEL'); END;

CREATE TRIGGER trg_credenciais_cadastro_portaria_evento_institucional_insert
BEFORE INSERT ON credenciais_cadastro_portaria_evento
WHEN NOT EXISTS (SELECT 1 FROM eventos e WHERE e.id = NEW.evento_id AND e.ativo = 1 AND e.pessoal = 0 AND e.abrangencia = 'TERRITORIAL')
BEGIN SELECT RAISE(ABORT, 'PORTARIA_EVENTO_INCOMPATIVEL'); END;

CREATE TRIGGER trg_portaria_solicitacoes_fechamento_institucional_insert
BEFORE INSERT ON portaria_solicitacoes_fechamento
WHEN NOT EXISTS (SELECT 1 FROM eventos e WHERE e.id = NEW.evento_id AND e.ativo = 1 AND e.pessoal = 0 AND e.abrangencia = 'TERRITORIAL')
BEGIN SELECT RAISE(ABORT, 'PORTARIA_EVENTO_INCOMPATIVEL'); END;

CREATE TRIGGER trg_portaria_fechamento_locks_institucional_insert
BEFORE INSERT ON portaria_fechamento_locks
WHEN NOT EXISTS (SELECT 1 FROM eventos e WHERE e.id = NEW.evento_id AND e.ativo = 1 AND e.pessoal = 0 AND e.abrangencia = 'TERRITORIAL')
BEGIN SELECT RAISE(ABORT, 'PORTARIA_EVENTO_INCOMPATIVEL'); END;

CREATE TRIGGER trg_portaria_fechamentos_institucional_insert
BEFORE INSERT ON portaria_fechamentos
WHEN NOT EXISTS (SELECT 1 FROM eventos e WHERE e.id = NEW.evento_id AND e.ativo = 1 AND e.pessoal = 0 AND e.abrangencia = 'TERRITORIAL')
BEGIN SELECT RAISE(ABORT, 'PORTARIA_EVENTO_INCOMPATIVEL'); END;

CREATE TRIGGER trg_portaria_reaberturas_institucional_insert
BEFORE INSERT ON portaria_reaberturas
WHEN NOT EXISTS (SELECT 1 FROM eventos e WHERE e.id = NEW.evento_id AND e.ativo = 1 AND e.pessoal = 0 AND e.abrangencia = 'TERRITORIAL')
BEGIN SELECT RAISE(ABORT, 'PORTARIA_EVENTO_INCOMPATIVEL'); END;

CREATE TRIGGER trg_convidados_evento_institucional_insert
BEFORE INSERT ON convidados_evento
WHEN NOT EXISTS (SELECT 1 FROM eventos e WHERE e.id = NEW.evento_id AND e.ativo = 1 AND e.pessoal = 0 AND e.abrangencia = 'TERRITORIAL')
BEGIN SELECT RAISE(ABORT, 'PORTARIA_EVENTO_INCOMPATIVEL'); END;

CREATE TRIGGER trg_presencas_convidado_evento_institucional_insert
BEFORE INSERT ON presencas_convidado_evento
WHEN NOT EXISTS (SELECT 1 FROM eventos e WHERE e.id = NEW.evento_id AND e.ativo = 1 AND e.pessoal = 0 AND e.abrangencia = 'TERRITORIAL')
BEGIN SELECT RAISE(ABORT, 'PORTARIA_EVENTO_INCOMPATIVEL'); END;

CREATE TRIGGER trg_portarias_evento_institucional_update_status
BEFORE UPDATE OF status ON portarias_evento
WHEN NOT EXISTS (SELECT 1 FROM eventos e WHERE e.id = NEW.evento_id AND e.ativo = 1 AND e.pessoal = 0 AND e.abrangencia = 'TERRITORIAL')
BEGIN SELECT RAISE(ABORT, 'PORTARIA_EVENTO_INCOMPATIVEL'); END;

CREATE TRIGGER trg_convidados_evento_institucional_update_status
BEFORE UPDATE OF status ON convidados_evento
WHEN NOT EXISTS (SELECT 1 FROM eventos e WHERE e.id = NEW.evento_id AND e.ativo = 1 AND e.pessoal = 0 AND e.abrangencia = 'TERRITORIAL')
BEGIN SELECT RAISE(ABORT, 'PORTARIA_EVENTO_INCOMPATIVEL'); END;

CREATE TRIGGER trg_portaria_solicitacoes_fechamento_institucional_update_confirmado_em
BEFORE UPDATE OF confirmado_em ON portaria_solicitacoes_fechamento
WHEN NOT EXISTS (SELECT 1 FROM eventos e WHERE e.id = NEW.evento_id AND e.ativo = 1 AND e.pessoal = 0 AND e.abrangencia = 'TERRITORIAL')
BEGIN SELECT RAISE(ABORT, 'PORTARIA_EVENTO_INCOMPATIVEL'); END;

CREATE TRIGGER trg_portaria_operadores_evento_institucional_update_ativo
BEFORE UPDATE OF ativo ON portaria_operadores_evento
WHEN NOT EXISTS (SELECT 1 FROM eventos e WHERE e.id = NEW.evento_id AND e.ativo = 1 AND e.pessoal = 0 AND e.abrangencia = 'TERRITORIAL')
BEGIN SELECT RAISE(ABORT, 'PORTARIA_EVENTO_INCOMPATIVEL'); END;

CREATE TRIGGER trg_portaria_reaberturas_institucional_update_evento_id
BEFORE UPDATE OF evento_id ON portaria_reaberturas
WHEN NOT EXISTS (SELECT 1 FROM eventos e WHERE e.id = NEW.evento_id AND e.ativo = 1 AND e.pessoal = 0 AND e.abrangencia = 'TERRITORIAL')
BEGIN SELECT RAISE(ABORT, 'PORTARIA_EVENTO_INCOMPATIVEL'); END;

