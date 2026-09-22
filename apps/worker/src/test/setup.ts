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
      data_ordenacao text,
      codigo_carteirinha text UNIQUE,
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

    CREATE TABLE IF NOT EXISTS pre_cadastros_ministeriais (
      id text PRIMARY KEY NOT NULL,
      nome text NOT NULL,
      ministerio text,
      rrm text NOT NULL,
      regional_id text,
      administracao_origem text,
      localidade_origem text,
      codigo_casa_referencia text,
      casa_id text,
      data_ordenacao text,
      status_origem text,
      celular_referencia text,
      fonte_celular text,
      membro_id text UNIQUE,
      fonte text DEFAULT 'EXPORTACAO_CONSULTA_SERVOS_MINISTERIO' NOT NULL,
      ativo integer DEFAULT 1 NOT NULL CHECK (ativo IN (0, 1)),
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (regional_id) REFERENCES regionais(id),
      FOREIGN KEY (casa_id) REFERENCES casas(id),
      FOREIGN KEY (membro_id) REFERENCES membros(id)
    );
    CREATE INDEX IF NOT EXISTS idx_pre_cadastro_ministerial_nome
      ON pre_cadastros_ministeriais (nome);
    CREATE INDEX IF NOT EXISTS idx_pre_cadastro_ministerial_regional
      ON pre_cadastros_ministeriais (regional_id, ativo);
    CREATE INDEX IF NOT EXISTS idx_pre_cadastro_ministerial_casa
      ON pre_cadastros_ministeriais (casa_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pre_cadastro_ministerial_membro
      ON pre_cadastros_ministeriais (membro_id) WHERE membro_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS participacoes_grupos_trabalho (
      id text PRIMARY KEY NOT NULL,
      grupo_trabalho_id text NOT NULL,
      setor_representado_id text NOT NULL,
      pre_cadastro_ministerial_id text NOT NULL,
      papel text NOT NULL CHECK (papel IN ('RESPONSAVEL','SUPLENTE')),
      status_mensageria text,
      justificativa text,
      ativo integer DEFAULT 1 NOT NULL CHECK (ativo IN (0, 1)),
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (grupo_trabalho_id) REFERENCES grupos_trabalho(id),
      FOREIGN KEY (setor_representado_id) REFERENCES setores(id),
      FOREIGN KEY (pre_cadastro_ministerial_id) REFERENCES pre_cadastros_ministeriais(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_participacao_gt_unica
      ON participacoes_grupos_trabalho
        (grupo_trabalho_id, setor_representado_id, pre_cadastro_ministerial_id, papel)
      WHERE ativo = 1;
    CREATE INDEX IF NOT EXISTS idx_participacao_gt_setor
      ON participacoes_grupos_trabalho (grupo_trabalho_id, setor_representado_id, ativo);
    CREATE INDEX IF NOT EXISTS idx_participacao_gt_pre_cadastro
      ON participacoes_grupos_trabalho (pre_cadastro_ministerial_id, ativo);

    CREATE TRIGGER IF NOT EXISTS trg_participacao_gt_regional_insert
    BEFORE INSERT ON participacoes_grupos_trabalho
    BEGIN
      SELECT CASE
        WHEN NOT EXISTS (
          SELECT 1 FROM grupos_trabalho g
          WHERE g.id = NEW.grupo_trabalho_id
            AND g.regional_id IS NOT NULL
            AND g.administracao_id IS NULL
            AND g.setor_id IS NULL
        )
        THEN RAISE(ABORT, 'GT_DEVE_SER_REGIONAL')
      END;

      SELECT CASE
        WHEN NOT EXISTS (
          SELECT 1
          FROM grupos_trabalho g
          JOIN setores s ON s.id = NEW.setor_representado_id
          JOIN administracoes a ON a.id = s.administracao_id
          WHERE g.id = NEW.grupo_trabalho_id
            AND g.regional_id = a.regional_id
        )
        THEN RAISE(ABORT, 'SETOR_FORA_DA_REGIONAL_DO_GT')
      END;
    END;

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

    CREATE TABLE IF NOT EXISTS contas_acesso (
      id text PRIMARY KEY NOT NULL,
      membro_id text NOT NULL UNIQUE,
      status text DEFAULT 'PENDENTE_ATIVACAO' NOT NULL,
      pin_hash text,
      pin_salt text,
      bloqueado_ate text,
      tentativas_pin integer DEFAULT 0 NOT NULL,
      ativado_em text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (membro_id) REFERENCES membros(id),
      CONSTRAINT check_conta_acesso_status CHECK (
        status IN ('PENDENTE_ATIVACAO', 'ATIVA', 'BLOQUEADA', 'DESATIVADA')
      )
    );
    CREATE INDEX IF NOT EXISTS idx_contas_acesso_status ON contas_acesso (status);

    CREATE TABLE IF NOT EXISTS links_ativacao (
      id text PRIMARY KEY NOT NULL,
      conta_acesso_id text,
      membro_id text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expira_em text NOT NULL,
      utilizado_em text,
      revogado_em text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (membro_id) REFERENCES membros(id),
      FOREIGN KEY (conta_acesso_id) REFERENCES contas_acesso(id)
    );

    CREATE TABLE IF NOT EXISTS sessoes (
      id text PRIMARY KEY NOT NULL,
      conta_acesso_id text,
      membro_id text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expira_em text NOT NULL,
      revogado_em text,
      ultimo_acesso_em text,
      user_agent text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (membro_id) REFERENCES membros(id),
      FOREIGN KEY (conta_acesso_id) REFERENCES contas_acesso(id)
    );

    -- Compatibilidade explícita da infraestrutura de testes legados:
    -- suítes antigas inserem sessões diretamente. O código de produção nunca usa este gatilho.
    CREATE TRIGGER IF NOT EXISTS test_vincular_sessao_a_conta
    AFTER INSERT ON sessoes
    WHEN NEW.conta_acesso_id IS NULL
    BEGIN
      INSERT OR IGNORE INTO contas_acesso (
        id, membro_id, status, pin_hash, pin_salt, bloqueado_ate,
        tentativas_pin, ativado_em
      )
      SELECT
        'test-conta-' || NEW.membro_id,
        m.id,
        CASE WHEN m.autenticacao_ativa = 1 THEN 'ATIVA' ELSE 'PENDENTE_ATIVACAO' END,
        m.pin_hash,
        m.pin_salt,
        m.bloqueado_ate,
        m.tentativas_pin,
        m.ativado_em
      FROM membros m
      WHERE m.id = NEW.membro_id;

      UPDATE sessoes
      SET conta_acesso_id = (
        SELECT id FROM contas_acesso WHERE membro_id = NEW.membro_id
      )
      WHERE id = NEW.id;
    END;

    CREATE TABLE IF NOT EXISTS tentativas_acesso (
      id text PRIMARY KEY NOT NULL,
      conta_acesso_id text,
      membro_id text,
      tipo text NOT NULL,
      sucesso integer NOT NULL,
      motivo text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (membro_id) REFERENCES membros(id),
      FOREIGN KEY (conta_acesso_id) REFERENCES contas_acesso(id)
    );

    CREATE TABLE IF NOT EXISTS rate_limits_autenticacao (
      chave_hash text PRIMARY KEY NOT NULL,
      falhas_consecutivas integer DEFAULT 0 NOT NULL,
      bloqueado_ate text,
      expira_em text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rate_limits_autenticacao_expira_em ON rate_limits_autenticacao (expira_em);

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
      status text DEFAULT 'ATIVO' NOT NULL,
      operador_membro_id text,
      created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (convocacao_destinatario_id) REFERENCES convocacao_destinatarios(id),
      FOREIGN KEY (evento_id) REFERENCES eventos(id),
      FOREIGN KEY (membro_id) REFERENCES membros(id),
      FOREIGN KEY (operador_membro_id) REFERENCES membros(id),
      CONSTRAINT check_checkin_forma CHECK (forma IN ('QR', 'MANUAL')),
      CONSTRAINT check_checkin_status CHECK (status IN ('ATIVO', 'RETIFICADO'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_checkin_evento_membro_unico ON checkins (evento_id, membro_id) WHERE status = 'ATIVO';
    CREATE INDEX IF NOT EXISTS idx_checkin_destinatario ON checkins (convocacao_destinatario_id);
    CREATE INDEX IF NOT EXISTS idx_checkin_membro ON checkins (membro_id);

    CREATE TABLE IF NOT EXISTS portarias_evento (
      evento_id text PRIMARY KEY NOT NULL,
      status text DEFAULT 'ABERTA' NOT NULL CHECK (status IN ('ABERTA','FECHADA')),
      fechada_em text,
      fechada_por_membro_id text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (evento_id) REFERENCES eventos(id),
      FOREIGN KEY (fechada_por_membro_id) REFERENCES membros(id)
    );

    CREATE TABLE IF NOT EXISTS portaria_operadores_evento (
      id text PRIMARY KEY NOT NULL,
      evento_id text NOT NULL,
      membro_id text NOT NULL,
      concedido_por_membro_id text,
      revogado_em text,
      ativo integer DEFAULT 1 NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (evento_id) REFERENCES eventos(id),
      FOREIGN KEY (membro_id) REFERENCES membros(id),
      FOREIGN KEY (concedido_por_membro_id) REFERENCES membros(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_portaria_operador_evento_ativo
      ON portaria_operadores_evento (evento_id, membro_id) WHERE ativo = 1;
    CREATE INDEX IF NOT EXISTS idx_portaria_operador_evento
      ON portaria_operadores_evento (evento_id, ativo);
    CREATE INDEX IF NOT EXISTS idx_portaria_operador_membro
      ON portaria_operadores_evento (membro_id, ativo);

    CREATE TABLE IF NOT EXISTS convidados_evento (
      id text PRIMARY KEY NOT NULL,
      evento_id text NOT NULL,
      nome text NOT NULL,
      localidade text NOT NULL,
      referencia text,
      observacoes text,
      status text DEFAULT 'PENDENTE' NOT NULL CHECK (status IN ('PENDENTE','VALIDADO')),
      criado_por_membro_id text,
      validado_por_membro_id text,
      validado_em text,
      ativo integer DEFAULT 1 NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (evento_id) REFERENCES eventos(id),
      FOREIGN KEY (criado_por_membro_id) REFERENCES membros(id),
      FOREIGN KEY (validado_por_membro_id) REFERENCES membros(id)
    );
    CREATE INDEX IF NOT EXISTS idx_convidados_evento
      ON convidados_evento (evento_id, ativo);

    CREATE TABLE IF NOT EXISTS credenciais_cadastro_portaria_evento (
      id text PRIMARY KEY NOT NULL,
      evento_id text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expira_em text NOT NULL,
      revogado_em text,
      criado_por_membro_id text,
      ativo integer DEFAULT 1 NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (evento_id) REFERENCES eventos(id),
      FOREIGN KEY (criado_por_membro_id) REFERENCES membros(id)
    );
    CREATE INDEX IF NOT EXISTS idx_credencial_cadastro_portaria_evento
      ON credenciais_cadastro_portaria_evento (evento_id, ativo);

    CREATE TABLE IF NOT EXISTS presencas_convidado_evento (
      id text PRIMARY KEY NOT NULL,
      convidado_id text NOT NULL,
      evento_id text NOT NULL,
      forma text NOT NULL CHECK (forma IN ('VALIDACAO_PORTEIRO','MANUAL')),
      registrado_por_membro_id text,
      registrado_em text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (convidado_id) REFERENCES convidados_evento(id),
      FOREIGN KEY (evento_id) REFERENCES eventos(id),
      FOREIGN KEY (registrado_por_membro_id) REFERENCES membros(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_presenca_convidado_unica
      ON presencas_convidado_evento (evento_id, convidado_id);
    CREATE INDEX IF NOT EXISTS idx_presenca_convidado_evento
      ON presencas_convidado_evento (evento_id);

    CREATE TABLE IF NOT EXISTS portaria_fechamentos (
      id text PRIMARY KEY NOT NULL,
      evento_id text NOT NULL UNIQUE,
      fechado_por_membro_id text,
      fechado_em text NOT NULL,
      total_convocados integer DEFAULT 0 NOT NULL,
      total_convocados_presentes integer DEFAULT 0 NOT NULL,
      total_convocados_ausentes integer DEFAULT 0 NOT NULL,
      total_convidados_validados integer DEFAULT 0 NOT NULL,
      total_convidados_pendentes integer DEFAULT 0 NOT NULL,
      total_presentes integer DEFAULT 0 NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (evento_id) REFERENCES eventos(id),
      FOREIGN KEY (fechado_por_membro_id) REFERENCES membros(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_portaria_fechamento_evento
      ON portaria_fechamentos (evento_id);

    CREATE TABLE IF NOT EXISTS portaria_fechamento_itens (
      id text PRIMARY KEY NOT NULL,
      fechamento_id text NOT NULL,
      evento_id text NOT NULL,
      tipo_pessoa text NOT NULL CHECK (tipo_pessoa IN ('MEMBRO','CONVIDADO')),
      origem_id text NOT NULL,
      nome text NOT NULL,
      localidade text,
      situacao text NOT NULL CHECK (situacao IN ('PRESENTE','AUSENTE','PENDENTE')),
      resposta_rsvp text,
      forma_presenca text,
      registrado_em text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (fechamento_id) REFERENCES portaria_fechamentos(id),
      FOREIGN KEY (evento_id) REFERENCES eventos(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_portaria_fechamento_origem_unica
      ON portaria_fechamento_itens (fechamento_id, tipo_pessoa, origem_id);
    CREATE INDEX IF NOT EXISTS idx_portaria_fechamento_itens_evento
      ON portaria_fechamento_itens (evento_id);

    CREATE TABLE IF NOT EXISTS auditoria_logs (
      id text PRIMARY KEY NOT NULL,
      acao text NOT NULL,
      ator_membro_id text,
      ator_conta_acesso_id text,
      recurso_tipo text NOT NULL,
      recurso_id text NOT NULL,
      escopo_tipo text,
      escopo_id text,
      contexto text,
      criado_em text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (ator_membro_id) REFERENCES membros(id),
      FOREIGN KEY (ator_conta_acesso_id) REFERENCES contas_acesso(id)
    );
    CREATE INDEX IF NOT EXISTS idx_auditoria_acao ON auditoria_logs (acao);
    CREATE INDEX IF NOT EXISTS idx_auditoria_ator ON auditoria_logs (ator_membro_id);
    CREATE INDEX IF NOT EXISTS idx_auditoria_recurso ON auditoria_logs (recurso_tipo, recurso_id);
    CREATE INDEX IF NOT EXISTS idx_auditoria_escopo ON auditoria_logs (escopo_tipo, escopo_id);
    CREATE INDEX IF NOT EXISTS idx_auditoria_criado_em ON auditoria_logs (criado_em);
    CREATE INDEX IF NOT EXISTS idx_auditoria_ator_conta ON auditoria_logs (ator_conta_acesso_id);

    CREATE TABLE IF NOT EXISTS perfis_acesso (
      codigo text PRIMARY KEY NOT NULL,
      nome text NOT NULL,
      descricao text NOT NULL,
      ativo integer DEFAULT 1 NOT NULL CHECK (ativo IN (0, 1)),
      created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );

    INSERT OR IGNORE INTO perfis_acesso (codigo, nome, descricao) VALUES
      ('MASTER_SISTEMA', 'Master do Sistema', 'Governança global e contingência.'),
      ('ADMINISTRADOR_SISTEMA', 'Administrador do Sistema', 'Administração de uma Regional.'),
      ('GESTOR_AGENDA', 'Gestor de Agenda', 'Gestão de agenda autorizada.'),
      ('OPERADOR_PORTARIA_PERMANENTE', 'Operador de Portaria permanente', 'Operação permanente de Portaria.'),
      ('GESTOR_RELATORIOS', 'Gestor de Relatórios', 'Consulta de relatórios autorizados.'),
      ('AUDITOR', 'Auditor', 'Consulta de auditoria autorizada.'),
      ('USUARIO_COMUM', 'Usuário comum', 'Agenda e ações pessoais.');

    CREATE TABLE IF NOT EXISTS acessos_conta (
      id text PRIMARY KEY NOT NULL,
      conta_acesso_id text NOT NULL,
      perfil_codigo text NOT NULL,
      escopo_tipo text NOT NULL,
      escopo_id text,
      concedido_por_conta_id text,
      revogado_por_conta_id text,
      revogado_em text,
      ativo integer DEFAULT 1 NOT NULL CHECK (ativo IN (0, 1)),
      created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (conta_acesso_id) REFERENCES contas_acesso(id),
      FOREIGN KEY (perfil_codigo) REFERENCES perfis_acesso(codigo),
      FOREIGN KEY (concedido_por_conta_id) REFERENCES contas_acesso(id),
      FOREIGN KEY (revogado_por_conta_id) REFERENCES contas_acesso(id),
      CHECK (
        (escopo_tipo = 'GLOBAL' AND escopo_id IS NULL)
        OR (escopo_tipo IN ('REGIONAL','ADMINISTRACAO','SETOR','CASA','GRUPO_TRABALHO')
          AND escopo_id IS NOT NULL)
      ),
      CHECK (
        (perfil_codigo = 'MASTER_SISTEMA' AND escopo_tipo = 'GLOBAL' AND escopo_id IS NULL)
        OR (perfil_codigo <> 'MASTER_SISTEMA' AND escopo_tipo <> 'GLOBAL')
      ),
      CHECK (perfil_codigo <> 'ADMINISTRADOR_SISTEMA' OR escopo_tipo = 'REGIONAL'),
      CHECK (perfil_codigo <> 'AUDITOR' OR escopo_tipo IN ('REGIONAL','ADMINISTRACAO'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_acesso_conta_ativo_unico
      ON acessos_conta (conta_acesso_id, perfil_codigo, escopo_tipo, ifnull(escopo_id, ''))
      WHERE ativo = 1;
    CREATE INDEX IF NOT EXISTS idx_acessos_conta_conta
      ON acessos_conta (conta_acesso_id, ativo);
    CREATE INDEX IF NOT EXISTS idx_acessos_conta_escopo
      ON acessos_conta (escopo_tipo, escopo_id, ativo);

    CREATE TABLE IF NOT EXISTS ciencias_responsabilidade (
      id text PRIMARY KEY NOT NULL,
      conta_acesso_id text NOT NULL,
      acesso_conta_id text NOT NULL,
      tipo text NOT NULL CHECK (tipo IN ('RESPONSAVEL_REGIONAL_PMO','AVISO_PRIVACIDADE')),
      versao_texto text NOT NULL,
      texto_hash text NOT NULL,
      ciente_em text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (conta_acesso_id) REFERENCES contas_acesso(id),
      FOREIGN KEY (acesso_conta_id) REFERENCES acessos_conta(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ciencia_responsabilidade_unica
      ON ciencias_responsabilidade
      (conta_acesso_id, acesso_conta_id, tipo, versao_texto);

    CREATE TABLE IF NOT EXISTS bootstrap_master (
      id text PRIMARY KEY NOT NULL CHECK (id = 'PRIMEIRO_MASTER'),
      conta_acesso_id text NOT NULL,
      concluido_em text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      FOREIGN KEY (conta_acesso_id) REFERENCES contas_acesso(id)
    );

  `
  sqlite.exec(setupSql)
}
