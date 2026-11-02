-- Ciência obrigatória e versionada dos termos de privacidade, por membro.
-- Não armazenar celular, PIN, IP nem dados de dispositivo neste registro.
CREATE TABLE ciencias_privacidade (
  id TEXT PRIMARY KEY NOT NULL,
  membro_id TEXT NOT NULL REFERENCES membros(id),
  conta_acesso_id TEXT NOT NULL REFERENCES contas_acesso(id),
  versao TEXT NOT NULL,
  texto_hash TEXT NOT NULL,
  leitura_confirmada INTEGER NOT NULL CHECK (leitura_confirmada = 1),
  tratamento_necessario_ciente INTEGER NOT NULL CHECK (tratamento_necessario_ciente = 1),
  registrado_em TEXT NOT NULL,
  UNIQUE(membro_id, versao)
);
CREATE INDEX idx_ciencias_privacidade_membro_versao
  ON ciencias_privacidade (membro_id, versao);
