export function setupDb(sqlite: any) {
  const setupSql = `
    CREATE TABLE IF NOT EXISTS regionais (id text PRIMARY KEY NOT NULL, nome text NOT NULL, codigo text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL);
    CREATE TABLE IF NOT EXISTS administracoes (id text PRIMARY KEY NOT NULL, regional_id text NOT NULL, nome text NOT NULL, codigo text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (regional_id) REFERENCES regionais(id));
    CREATE TABLE IF NOT EXISTS setores (id text PRIMARY KEY NOT NULL, administracao_id text NOT NULL, nome text NOT NULL, codigo text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (administracao_id) REFERENCES administracoes(id));
    CREATE TABLE IF NOT EXISTS casas (id text PRIMARY KEY NOT NULL, setor_id text NOT NULL, nome text NOT NULL, codigo text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (setor_id) REFERENCES setores(id));
    CREATE TABLE IF NOT EXISTS grupos_trabalho (id text PRIMARY KEY NOT NULL, nome text NOT NULL, ativo integer DEFAULT true NOT NULL, regional_id text, administracao_id text, setor_id text, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (regional_id) REFERENCES regionais(id), FOREIGN KEY (administracao_id) REFERENCES administracoes(id), FOREIGN KEY (setor_id) REFERENCES setores(id));
    
    CREATE TABLE IF NOT EXISTS membros (
      id text PRIMARY KEY NOT NULL,
      nome text NOT NULL,
      data_nascimento text,
      celular text UNIQUE,
      casa_id text NOT NULL,
      ativo integer DEFAULT true NOT NULL,
      autenticacao_ativa integer DEFAULT false NOT NULL,
      pin_hash text,
      pin_salt text,
      bloqueado_ate text,
      tentativas_pin integer DEFAULT 0 NOT NULL,
      ativado_em text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (casa_id) REFERENCES casas(id)
    );

    CREATE TABLE IF NOT EXISTS funcoes (id text PRIMARY KEY NOT NULL, nome text NOT NULL, codigo text, descricao text, ativo integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL);
    
    CREATE TABLE IF NOT EXISTS vinculos_funcionais (
      id text PRIMARY KEY NOT NULL,
      membro_id text NOT NULL,
      funcao_id text NOT NULL,
      regional_id text,
      administracao_id text,
      setor_id text,
      casa_id text,
      grupo_trabalho_id text,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (membro_id) REFERENCES membros(id),
      FOREIGN KEY (funcao_id) REFERENCES funcoes(id),
      CONSTRAINT check_vinculo_escopo_unico CHECK (
        (CASE WHEN regional_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN administracao_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN setor_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN casa_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN grupo_trabalho_id IS NOT NULL THEN 1 ELSE 0 END) = 1
      )
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_vinculo_unico_regional ON vinculos_funcionais (membro_id, funcao_id, regional_id) WHERE regional_id IS NOT NULL AND ativo = 1;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vinculo_unico_administracao ON vinculos_funcionais (membro_id, funcao_id, administracao_id) WHERE administracao_id IS NOT NULL AND ativo = 1;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vinculo_unico_setor ON vinculos_funcionais (membro_id, funcao_id, setor_id) WHERE setor_id IS NOT NULL AND ativo = 1;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vinculo_unico_casa ON vinculos_funcionais (membro_id, funcao_id, casa_id) WHERE casa_id IS NOT NULL AND ativo = 1;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vinculo_unico_gt ON vinculos_funcionais (membro_id, funcao_id, grupo_trabalho_id) WHERE grupo_trabalho_id IS NOT NULL AND ativo = 1;

    CREATE TABLE IF NOT EXISTS links_ativacao (
      id text PRIMARY KEY NOT NULL,
      membro_id text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expira_em text NOT NULL,
      utilizado_em text,
      revogado_em text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (membro_id) REFERENCES membros(id)
    );

    CREATE TABLE IF NOT EXISTS sessoes (
      id text PRIMARY KEY NOT NULL,
      membro_id text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expira_em text NOT NULL,
      revogado_em text,
      ultimo_acesso_em text,
      user_agent text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (membro_id) REFERENCES membros(id)
    );

    CREATE TABLE IF NOT EXISTS tentativas_acesso (
      id text PRIMARY KEY NOT NULL,
      membro_id text,
      tipo text NOT NULL,
      sucesso integer NOT NULL,
      motivo text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (membro_id) REFERENCES membros(id)
    );

    CREATE TABLE IF NOT EXISTS locais (
      id text PRIMARY KEY NOT NULL,
      nome text NOT NULL,
      endereco text NOT NULL,
      numero text NOT NULL,
      complemento text,
      bairro text,
      cidade text NOT NULL,
      uf text NOT NULL,
      cep text,
      referencia text,
      latitude real,
      longitude real,
      url_maps text,
      url_waze text,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS series_recorrencia (
      id text PRIMARY KEY NOT NULL,
      titulo text NOT NULL,
      descricao text,
      pauta text,
      modalidade text NOT NULL,
      frequencia text NOT NULL,
      intervalo integer DEFAULT 1 NOT NULL,
      data_inicio text NOT NULL,
      data_fim text NOT NULL,
      horario_inicio text NOT NULL,
      horario_fim text NOT NULL,
      timezone text DEFAULT 'America/Sao_Paulo' NOT NULL,
      dia_semana integer,
      dia_mes integer,
      posicao_semana_mes integer,
      local_id text,
      url_online text,
      organizador_membro_id text,
      regional_id text,
      administracao_id text,
      setor_id text,
      casa_id text,
      grupo_trabalho_id text,
      observacoes text,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (local_id) REFERENCES locais(id),
      FOREIGN KEY (organizador_membro_id) REFERENCES membros(id),
      FOREIGN KEY (regional_id) REFERENCES regionais(id),
      FOREIGN KEY (administracao_id) REFERENCES administracoes(id),
      FOREIGN KEY (setor_id) REFERENCES setores(id),
      FOREIGN KEY (casa_id) REFERENCES casas(id),
      FOREIGN KEY (grupo_trabalho_id) REFERENCES grupos_trabalho(id),
      CONSTRAINT check_serie_escopo_unico CHECK (
        (CASE WHEN regional_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN administracao_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN setor_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN casa_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN grupo_trabalho_id IS NOT NULL THEN 1 ELSE 0 END) = 1
      )
    );

    CREATE INDEX IF NOT EXISTS idx_series_data_inicio ON series_recorrencia (data_inicio);
    CREATE INDEX IF NOT EXISTS idx_series_ativo ON series_recorrencia (ativo);

    CREATE TABLE IF NOT EXISTS eventos (
      id text PRIMARY KEY NOT NULL,
      titulo text NOT NULL,
      descricao text,
      pauta text,
      modalidade text NOT NULL,
      inicio_em text NOT NULL,
      fim_em text NOT NULL,
      local_id text,
      url_online text,
      organizador_membro_id text,
      regional_id text,
      administracao_id text,
      setor_id text,
      casa_id text,
      grupo_trabalho_id text,
      observacoes text,
      ativo integer DEFAULT true NOT NULL,
      serie_recorrencia_id text,
      recorrencia_excecao integer DEFAULT false NOT NULL,
      possui_manha integer DEFAULT false NOT NULL,
      possui_tarde integer DEFAULT false NOT NULL,
      possui_noite integer DEFAULT false NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (local_id) REFERENCES locais(id),
      FOREIGN KEY (organizador_membro_id) REFERENCES membros(id),
      FOREIGN KEY (regional_id) REFERENCES regionais(id),
      FOREIGN KEY (administracao_id) REFERENCES administracoes(id),
      FOREIGN KEY (setor_id) REFERENCES setores(id),
      FOREIGN KEY (casa_id) REFERENCES casas(id),
      FOREIGN KEY (grupo_trabalho_id) REFERENCES grupos_trabalho(id),
      FOREIGN KEY (serie_recorrencia_id) REFERENCES series_recorrencia(id),
      CONSTRAINT check_evento_escopo_unico CHECK (
        (CASE WHEN regional_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN administracao_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN setor_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN casa_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN grupo_trabalho_id IS NOT NULL THEN 1 ELSE 0 END) = 1
      )
    );

    CREATE INDEX IF NOT EXISTS idx_eventos_inicio_em ON eventos (inicio_em);
    CREATE INDEX IF NOT EXISTS idx_eventos_ativo ON eventos (ativo);
    CREATE INDEX IF NOT EXISTS idx_eventos_local_id ON eventos (local_id);
    CREATE INDEX IF NOT EXISTS idx_eventos_serie_recorrencia_id ON eventos (serie_recorrencia_id);

    CREATE TABLE IF NOT EXISTS convocacoes (
      id text PRIMARY KEY NOT NULL,
      evento_id text NOT NULL,
      status text NOT NULL,
      observacoes text,
      publicada_em text,
      cancelada_em text,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (evento_id) REFERENCES eventos(id),
      CONSTRAINT check_status_convocacao CHECK (status IN ('RASCUNHO','PUBLICADA','CANCELADA'))
    );
    CREATE INDEX IF NOT EXISTS idx_convocacoes_evento_id ON convocacoes (evento_id);
    CREATE INDEX IF NOT EXISTS idx_convocacoes_status ON convocacoes (status);

    CREATE TABLE IF NOT EXISTS convocacao_funcoes (
      id text PRIMARY KEY NOT NULL,
      convocacao_id text NOT NULL,
      funcao_id text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (convocacao_id) REFERENCES convocacoes(id),
      FOREIGN KEY (funcao_id) REFERENCES funcoes(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_convocacao_funcao_unico ON convocacao_funcoes (convocacao_id, funcao_id);
    CREATE INDEX IF NOT EXISTS idx_convocacao_funcoes_convocacao_id ON convocacao_funcoes (convocacao_id);

    CREATE TABLE IF NOT EXISTS convocacao_destinatarios (
      id text PRIMARY KEY NOT NULL,
      convocacao_id text NOT NULL,
      membro_id text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (convocacao_id) REFERENCES convocacoes(id),
      FOREIGN KEY (membro_id) REFERENCES membros(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_convocacao_destinatario_unico ON convocacao_destinatarios (convocacao_id, membro_id);
    CREATE INDEX IF NOT EXISTS idx_convocacao_destinatarios_convocacao_id ON convocacao_destinatarios (convocacao_id);
    CREATE INDEX IF NOT EXISTS idx_convocacao_destinatarios_membro_id ON convocacao_destinatarios (membro_id);

    CREATE TABLE IF NOT EXISTS convocacao_destinatario_evidencias (
      id text PRIMARY KEY NOT NULL,
      convocacao_destinatario_id text NOT NULL,
      funcao_id text NOT NULL,
      vinculo_funcional_id text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (convocacao_destinatario_id) REFERENCES convocacao_destinatarios(id),
      FOREIGN KEY (funcao_id) REFERENCES funcoes(id),
      FOREIGN KEY (vinculo_funcional_id) REFERENCES vinculos_funcionais(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_convocacao_evidencia_unica ON convocacao_destinatario_evidencias (convocacao_destinatario_id, funcao_id, vinculo_funcional_id);
    CREATE INDEX IF NOT EXISTS idx_convocacao_evidencias_dest_id ON convocacao_destinatario_evidencias (convocacao_destinatario_id);

    CREATE TABLE IF NOT EXISTS rsvp (
      id text PRIMARY KEY NOT NULL,
      convocacao_destinatario_id text NOT NULL UNIQUE,
      resposta text NOT NULL,
      justificativa text,
      periodos_participacao text,
      respondido_em text NOT NULL,
      atualizado_em text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (convocacao_destinatario_id) REFERENCES convocacao_destinatarios(id),
      CONSTRAINT check_rsvp_resposta CHECK (resposta IN ('PARTICIPAREI','NAO_PARTICIPAREI','NAO_SEI'))
    );
    CREATE INDEX IF NOT EXISTS idx_rsvp_convocacao_dest_id ON rsvp (convocacao_destinatario_id);

    CREATE TABLE IF NOT EXISTS evento_refeicoes (
      id text PRIMARY KEY NOT NULL,
      evento_id text NOT NULL,
      tipo text NOT NULL,
      ativo integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (evento_id) REFERENCES eventos(id),
      CONSTRAINT check_evento_refeicoes_tipo CHECK (tipo IN ('CAFE_MANHA','ALMOCO','LANCHE','JANTAR'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_evento_refeicoes_unico ON evento_refeicoes (evento_id, tipo);

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id text PRIMARY KEY NOT NULL,
      membro_id text NOT NULL,
      endpoint text NOT NULL,
      p256dh text NOT NULL,
      auth text NOT NULL,
      user_agent text,
      ativo integer DEFAULT 1 NOT NULL,
      created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (membro_id) REFERENCES membros(id) ON UPDATE NO ACTION ON DELETE NO ACTION
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_push_endpoint ON push_subscriptions (endpoint);
    CREATE INDEX IF NOT EXISTS idx_push_membro ON push_subscriptions (membro_id);

    CREATE TABLE IF NOT EXISTS checkins (
      id text PRIMARY KEY NOT NULL,
      convocacao_destinatario_id text NOT NULL,
      evento_id text NOT NULL,
      membro_id text NOT NULL,
      data_hora_checkin text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      forma text NOT NULL,
      operador_membro_id text,
      created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (convocacao_destinatario_id) REFERENCES convocacao_destinatarios(id),
      FOREIGN KEY (evento_id) REFERENCES eventos(id),
      FOREIGN KEY (membro_id) REFERENCES membros(id),
      FOREIGN KEY (operador_membro_id) REFERENCES membros(id),
      CONSTRAINT check_checkin_forma CHECK (forma IN ('QR', 'MANUAL'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_checkin_evento_membro_unico ON checkins (evento_id, membro_id);
    CREATE INDEX IF NOT EXISTS idx_checkin_destinatario ON checkins (convocacao_destinatario_id);
    CREATE INDEX IF NOT EXISTS idx_checkin_membro ON checkins (membro_id);
  `
  sqlite.exec(setupSql)
}
