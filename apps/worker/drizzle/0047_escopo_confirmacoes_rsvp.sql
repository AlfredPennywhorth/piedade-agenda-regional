-- Mantem confirmacoes territoriais vinculadas ao escopo original mesmo apos cancelamento da convocacao.
-- Esta migracao complementa 0046 sem recriar triggers ja implantados.
CREATE TRIGGER trg_evento_bloquear_conversao_com_rsvp_confirmado
BEFORE UPDATE OF abrangencia, pessoal ON eventos
WHEN (NEW.abrangencia IN ('NACIONAL','INTERNACIONAL') OR NEW.pessoal = 1)
 AND OLD.abrangencia = 'TERRITORIAL' AND OLD.pessoal = 0
 AND EXISTS (
   SELECT 1
   FROM convocacoes c
   JOIN convocacao_destinatarios cd ON cd.convocacao_id = c.id
   JOIN rsvp r ON r.convocacao_destinatario_id = cd.id
   WHERE c.evento_id = OLD.id AND r.resposta = 'PARTICIPAREI'
 )
BEGIN SELECT RAISE(ABORT, 'EVENTO_COM_PORTARIA_NAO_PODE_MUDAR_ESCOPO'); END;

-- Bloqueia confirmacao tardia em convocacao territorial cujo evento ja migrou.
CREATE TRIGGER trg_rsvp_confirmacao_evento_externo_insert
BEFORE INSERT ON rsvp
WHEN NEW.resposta = 'PARTICIPAREI' AND EXISTS (
  SELECT 1 FROM convocacao_destinatarios cd
  JOIN convocacoes c ON c.id = cd.convocacao_id
  JOIN eventos e ON e.id = c.evento_id
  WHERE cd.id = NEW.convocacao_destinatario_id
    AND (e.abrangencia <> 'TERRITORIAL' OR e.pessoal = 1)
)
BEGIN SELECT RAISE(ABORT, 'EVENTO_COM_PORTARIA_NAO_PODE_MUDAR_ESCOPO'); END;

CREATE TRIGGER trg_rsvp_confirmacao_evento_externo_update
BEFORE UPDATE OF resposta, convocacao_destinatario_id ON rsvp
WHEN NEW.resposta = 'PARTICIPAREI' AND EXISTS (
  SELECT 1 FROM convocacao_destinatarios cd
  JOIN convocacoes c ON c.id = cd.convocacao_id
  JOIN eventos e ON e.id = c.evento_id
  WHERE cd.id = NEW.convocacao_destinatario_id
    AND (e.abrangencia <> 'TERRITORIAL' OR e.pessoal = 1)
)
BEGIN SELECT RAISE(ABORT, 'EVENTO_COM_PORTARIA_NAO_PODE_MUDAR_ESCOPO'); END;
