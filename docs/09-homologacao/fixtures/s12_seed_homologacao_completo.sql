-- ==============================================================================
-- SCRATCH SCRIPT S12 - DADOS SINTÉTICOS DE HOMOLOGAÇÃO
-- ==============================================================================
-- ATENÇÃO: NÃO É UMA MIGRATION!
-- Este é um script de seed estático para uso local (SQLite/D1) do PO, com objetivo
-- de popular os dados necessários para rodar os cenários C3 a C10 da S12.
-- Sem PII real.
-- ==============================================================================

-- VALIDAÇÃO ESTÁTICA DO SEED
-- - Nomes das tabelas: OK (verificado contra schema.ts)
-- - Colunas: OK
-- - FKs / CHECK / NOT NULL: OK
-- - PENDENTE DE EXECUÇÃO: hashes de token precisam ser gerados.
-- - Risco: inserir colunas que possam ter sido alteradas por migrations locais.

-- 1. ESTRUTURA INSTITUCIONAL
INSERT OR IGNORE INTO regionais (id, nome, codigo, ativo, created_at, updated_at) VALUES
('reg-1', 'Regional de Testes 1', 'R1', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('reg-2', 'Regional Externa 2', 'R2', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO administracoes (id, regional_id, nome, codigo, ativo, created_at, updated_at) VALUES
('adm-2', 'reg-2', 'Administração de Testes 2', 'A2', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO setores (id, administracao_id, nome, codigo, ativo, created_at, updated_at) VALUES
('setor-1', 'adm-2', 'Setor Padrão 1', 'S1', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO casas (id, setor_id, nome, codigo, ativo, created_at, updated_at) VALUES
('casa-1', 'setor-1', 'Casa de Oração A', 'C1', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('casa-2', 'setor-1', 'Casa de Oração B', 'C2', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 2. FUNÇÕES
INSERT OR IGNORE INTO funcoes (id, nome, codigo, ativo, created_at, updated_at) VALUES
('f-gestor', 'Gestor de Relatórios', 'GESTOR_RELATORIOS', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('f-operador', 'Operador de Portaria', 'OPERADOR_PORTARIA', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('f-auditor', 'Auditor de Sistema', 'AUDITOR_SISTEMA', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 3. MEMBROS (M1 a M9)
INSERT OR IGNORE INTO membros (id, nome, celular, casa_id, ativo, autenticacao_ativa, created_at, updated_at) VALUES
('m-1', 'Comum (C1)', '11900000001', 'casa-1', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('m-2', 'Operador Portaria (C2)', '11900000002', 'casa-1', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('m-3', 'Gestor Relatórios (C3)', '11900000003', 'casa-1', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('m-4', 'Gestor Relatórios Fora (C4)', '11900000004', 'casa-2', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('m-5', 'Organizador (C5)', '11900000005', 'casa-1', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('m-6', 'Auditor Regional (C6)', '11900000006', 'casa-1', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('m-7', 'Auditor Adm (C7, C8)', '11900000007', 'casa-2', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('m-9', 'Multifunção (C9)', '11900000009', 'casa-1', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 4. VÍNCULOS FUNCIONAIS
INSERT OR IGNORE INTO vinculos_funcionais (id, membro_id, funcao_id, regional_id, administracao_id, ativo, created_at, updated_at) VALUES
-- M3: Gestor na Reg-1
('v-3', 'm-3', 'f-gestor', 'reg-1', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- M4: Gestor na Adm-2
('v-4', 'm-4', 'f-gestor', NULL, 'adm-2', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- M6: Auditor na Reg-1
('v-6', 'm-6', 'f-auditor', 'reg-1', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- M7: Auditor na Adm-2
('v-7', 'm-7', 'f-auditor', NULL, 'adm-2', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- M9: Gestor (Reg-1) + Auditor (Adm-2) + Operador (Reg-1)
('v-9a', 'm-9', 'f-gestor', 'reg-1', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('v-9b', 'm-9', 'f-auditor', NULL, 'adm-2', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('v-9c', 'm-9', 'f-operador', 'reg-1', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 5. LOCAIS
INSERT OR IGNORE INTO locais (id, nome, endereco, numero, cidade, uf, ativo, created_at, updated_at) VALUES
('loc-1', 'Local 1', 'Rua A', '100', 'São Paulo', 'SP', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 6. EVENTOS
INSERT OR IGNORE INTO eventos (id, titulo, modalidade, inicio_em, fim_em, local_id, organizador_membro_id, regional_id, administracao_id, ativo, created_at, updated_at) VALUES
('evento-sintetico-gestor-s12', 'Evento Teste Reg-1', 'PRESENCIAL', '2026-10-01T10:00:00Z', '2026-10-01T12:00:00Z', 'loc-1', 'm-5', 'reg-1', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('evento-sintetico-fora-s12', 'Evento Teste Adm-2', 'PRESENCIAL', '2026-10-02T10:00:00Z', '2026-10-02T12:00:00Z', 'loc-1', 'm-1', NULL, 'adm-2', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 7. CONVOCAÇÕES, DESTINATÁRIOS, RSVP E CHECK-IN PARA O EVENTO GESTOR
INSERT OR IGNORE INTO convocacoes (id, evento_id, status, ativo, created_at, updated_at) VALUES
('conv-101', 'evento-sintetico-gestor-s12', 'PUBLICADA', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO convocacao_destinatarios (id, convocacao_id, membro_id, created_at) VALUES
('dest-1', 'conv-101', 'm-1', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO rsvp (id, convocacao_destinatario_id, resposta, respondido_em, atualizado_em, created_at, updated_at) VALUES
('rsvp-1', 'dest-1', 'PARTICIPAREI', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO checkins (id, convocacao_destinatario_id, evento_id, membro_id, forma, operador_membro_id, created_at, updated_at) VALUES
('chk-1', 'dest-1', 'evento-sintetico-gestor-s12', 'm-1', 'QR', 'm-2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 8. AUDITORIA_LOGS (Ações Canônicas para C10-A)
INSERT OR IGNORE INTO auditoria_logs (id, acao, ator_membro_id, recurso_tipo, recurso_id, escopo_tipo, escopo_id, contexto, criado_em) VALUES
('log-1', 'EVENTO_CRIADO', 'm-5', 'EVENTO', 'evento-sintetico-gestor-s12', 'REGIONAL', 'reg-1', '{"teste":"C10-A"}', CURRENT_TIMESTAMP),
('log-2', 'EVENTO_ATUALIZADO', 'm-5', 'EVENTO', 'evento-sintetico-gestor-s12', 'REGIONAL', 'reg-1', '{"teste":"C10-A"}', CURRENT_TIMESTAMP),
('log-3', 'CONVOCACAO_PUBLICADA', 'm-5', 'CONVOCACAO', 'conv-101', 'REGIONAL', 'reg-1', '{"teste":"C10-A"}', CURRENT_TIMESTAMP),
('log-4', 'CONVOCACAO_CANCELADA', 'm-5', 'CONVOCACAO', 'conv-101', 'REGIONAL', 'reg-1', '{"teste":"C10-A"}', CURRENT_TIMESTAMP),
('log-5', 'RSVP_REGISTRADO', 'm-1', 'RSVP', 'rsvp-1', 'REGIONAL', 'reg-1', '{"teste":"C10-A"}', CURRENT_TIMESTAMP),
('log-6', 'CHECKIN_MANUAL', 'm-2', 'CHECKIN', 'chk-1', 'REGIONAL', 'reg-1', '{"teste":"C10-A"}', CURRENT_TIMESTAMP),
('log-7', 'CHECKIN_QR', 'm-2', 'CHECKIN', 'chk-1', 'REGIONAL', 'reg-1', '{"teste":"C10-A"}', CURRENT_TIMESTAMP),
('log-8', 'EVENTO_CRIADO', 'm-5', 'EVENTO', 'evento-sintetico-fora-s12', 'ADMINISTRACAO', 'adm-2', '{"teste":"C7"}', CURRENT_TIMESTAMP);

-- 9. SESSÕES E TOKENS SINTÉTICOS (Para uso direto via localStorage)
-- ATENÇÃO: As chaves na tabela sessoes requerem o hash SHA-256 do token bruto correspondente.
-- Marcar PENDENTE_GERAR_HASH quando não existir hash prévio documentado.
INSERT OR IGNORE INTO sessoes (id, membro_id, token_hash, expira_em, created_at) VALUES
('sess-3', 'm-3', 'PENDENTE_GERAR_HASH_GESTOR', '2030-01-01T00:00:00Z', CURRENT_TIMESTAMP),
('sess-4', 'm-4', 'PENDENTE_GERAR_HASH_GESTOR_FORA', '2030-01-01T00:00:00Z', CURRENT_TIMESTAMP),
('sess-5', 'm-5', 'PENDENTE_GERAR_HASH_ORGANIZADOR', '2030-01-01T00:00:00Z', CURRENT_TIMESTAMP),
('sess-6', 'm-6', 'PENDENTE_GERAR_HASH_AUDITOR_REG', '2030-01-01T00:00:00Z', CURRENT_TIMESTAMP),
('sess-7', 'm-7', 'PENDENTE_GERAR_HASH_AUDITOR_ADM', '2030-01-01T00:00:00Z', CURRENT_TIMESTAMP),
('sess-9', 'm-9', 'PENDENTE_GERAR_HASH_MULTIFUNCAO', '2030-01-01T00:00:00Z', CURRENT_TIMESTAMP);
