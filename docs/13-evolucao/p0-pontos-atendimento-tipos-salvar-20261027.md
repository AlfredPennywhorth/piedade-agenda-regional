# P0 — Implantação acelerada: Pontos de Atendimento, Tipos de Reunião, Salvar

Data: 27/10/2026. Origem: demanda funcional do PMO. Referência: Issue #414.

## Escopo de entrega conjunta
1. Ponto de Atendimento (PA): nível entre Setor e Casa de Oração, com diversos PAs por Setor e diversas Casas por PA.
2. Catálogo administrável de Tipos de Reunião: ID estável, nome, status ativo/inativo; uso em cadastro de eventos institucionais; títulos históricos preservados.
3. Correção do botão Salvar no fluxo de criação de reunião/evento/convocação: estado de salvamento, validação, confirmação, persistência uma única vez, retorno coerente e atualização imediata da lista após sucesso.

## Invariantes para o desenho
- Setor Centro pode ter PA A, PA B e PA C com reuniões do MESMO tipo e horário, em locais diferentes já cadastrados. São três reuniões distintas, uma por PA, nunca uma reunião única do Setor inteiro.
- Cada PA agrega Casas do respectivo Setor. Convocação por PA não replica a mesma reunião para cada Casa.
- Um Diácono eventualmente elegível a reuniões equivalentes de PAs distintos escolhe/é alocado a um PA, com uma única participação/RSVP efetivo. Os demais PAs são alternativas, não compromissos extras. Não ocultar o fato de serem reuniões distintas.
- Eventos de OUTRO tipo/assunto simultâneos continuam gerando conflito; não desativar o algoritmo globalmente.
- Coincidência de título, data ou horário nunca basta para equivalência. A regra deve usar tipoId (e quando necessário identificador de rodada/atividade compartilhada), escopo e participação.
- Reutilizar locais/espacos cadastrados; o PA não cria local físico duplicado.
- Portaria, convocações publicadas, RSVP e eventos históricos precisam permanecer íntegros.
- Casa não pode vincular-se a PA de outro Setor. Migração deve permitir classificação gradual das Casas existentes.

## Estratégia de entrega e aceite
### Etapa 1 — Banco, API e integridade
- Criar migration D1 forward-only para PAs, relação das Casas e tipos. Alterar eventos/convocações com migração compatível.
- API para CRUD/consulta PA e tipos, filtros territoriais e validação de acesso.
- Cobrir cardinalidade, migração, segurança por escopo, não exclusão com dependências.

### Etapa 2 — Fluxo funcional
- Formulários responsivos de Pontos/Tipos.
- Evento com seleção de tipo, PA e Local existente; filtros em cascata.
- Corrigir Salvar: impedir duplo clique/duplicidade, mostrar erro de validação, sucesso e recarregar registros.
- Convocações e destinatários de PA: sem duplicidade por Casa.

### Etapa 3 — Agenda e conflitos
- Introduzir identidade de ocorrência/tipo compartilhado, lógica de alternativas por PA e seleção efetiva única.
- Manter detector de conflito real por evento diferente, com assunto/tipo distinto.
- Cenário: PA A e B, mesmo tipo e 19h; uma escolha de participação, sem alerta falso. Outra reunião de tipo distinto às 19h => conflito real.

### Etapa 4 — Homologação / promoção rápida e segura
- Testes automatizados de backend e web, build/typecheck, migrações D1 beta, smoke funcional e revisão Codex.
- Deploy beta e aceite funcional do PMO: cadastro de PA, associação de Casas, uso de Local existente, tipo de reunião, Salvar, convocação, RSVP e conflito.
- Só após autorização explícita do PMO executar migração D1 produção, deploy Workers/Pages e smoke pós-deploy. Verificar rollback funcional e backup D1 antes da migração.
- Não misturar refatorações visuais extensas nem mudanças não relacionadas no pacote P0.

## Itens fora do pacote
- Filtro 'Meus registros' nas listagens administrativas de Eventos e Convocações (P1; PR separado após P0).
- Redesenho geral das telas do Gate B.

## Revisões obrigatórias antes do código
- apps/worker/src/routes/agenda.ts, eventos.ts, convocacoes.ts; esquema Drizzle e migrations.
- apps/web/src/components/convocacoes/ConvocacoesView.tsx, fluxo de salvar eventos.
- packages/shared schemas; permissões e testes atuais.

## Critérios de aceite objetivos
- PA de um Setor nunca contém Casa de outro Setor.
- Mesma reunião institucional em dois PAs distintos continua sendo dois eventos nos dois locais.
- Cada Diácono participa de somente um PA por rodada equivalente.
- Outra pauta no mesmo horário é conflito.
- Salvar cria um registro e fornece confirmação/estado correto, sem duplicação e com lista atualizada.
- Histórico existente continua acessível e sem mudanças acidentais.
