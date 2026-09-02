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
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (local_id) REFERENCES locais(id),
      FOREIGN KEY (organizador_membro_id) REFERENCES membros(id),
      FOREIGN KEY (regional_id) REFERENCES regionais(id),
      FOREIGN KEY (administracao_id) REFERENCES administracoes(id),
      FOREIGN KEY (setor_id) REFERENCES setores(id),
      FOREIGN KEY (casa_id) REFERENCES casas(id),
      FOREIGN KEY (grupo_trabalho_id) REFERENCES grupos_trabalho(id),
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
  `
  sqlite.exec(setupSql)
}
