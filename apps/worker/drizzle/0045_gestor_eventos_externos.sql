-- Permissão técnica de viajantes, restrita à Regional e sem privilégios de gestor de agenda.
INSERT OR IGNORE INTO perfis_acesso (codigo, nome, descricao)
VALUES ('GESTOR_EVENTOS_EXTERNOS', 'Gestor de Eventos Externos', 'Criação e gestão de atendimentos nacionais e internacionais pelo viajante autorizado.');
