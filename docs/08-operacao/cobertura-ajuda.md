# Auditoria da cobertura de Ajuda

Conferência das 20 abas de `MainLayout.tsx`, dos seis fluxos independentes em `App.tsx`/`AuthView.tsx` e do inventário canônico. O Beta no build `f500c79` tinha artigos para nove abas administrativas. A primeira versão do PR #348 acrescentou Eventos e Convocações (11/20). Esta ampliação completa as **20 abas**, sem depender da capacidade de gestão de agenda para as telas comuns do membro.

## Telas principais autenticadas

| Tela | Código | Disponibilidade do texto e botão |
|---|---|---|
| Minha Agenda | AGD-MOB-001 | Todos os membros autenticados |
| Calendário | AGD-MOB-002 | Todos os membros autenticados |
| Avisos | AGD-MOB-003 | Todos os membros autenticados; informa o estado real de desenvolvimento |
| Meu Cadastro | AGD-SHR-001 | Todos os membros autenticados |
| Eventos | AGD-ADM-001 | podeGerirAgenda |
| Séries | AGD-ADM-002 | podeGerirAgenda |
| Convocações | AGD-ADM-014 | podeGerirAgenda; ressalva específica de autorização do RSVP |
| Locais/Espaços | AGD-ADM-013 | podeGerirAgenda |
| Portaria | AGD-MOB-004 | podeOperarPortaria **ou** podeGerirAgenda |
| Relatórios | AGD-ADM-003 | podeVisualizarRelatorios |
| Auditoria | AGD-ADM-004 | podeVisualizarAuditoria |
| Regionais | AGD-ADM-005 | podeAdministrarEstrutura; escrita depende de podeAdministrarRegionais |
| Administrações | AGD-ADM-006 | podeAdministrarEstrutura |
| Setores | AGD-ADM-007 | podeAdministrarEstrutura |
| Casas | AGD-ADM-008 | podeAdministrarEstrutura |
| Grupos de Trabalho | AGD-ADM-009 | podeAdministrarEstrutura |
| Membros | AGD-ADM-010 | podeAdministrarPessoas |
| Funções | AGD-ADM-011 | podeAdministrarFuncoes |
| Vínculos Funcionais | AGD-ADM-012 | podeAdministrarPessoas |
| Contas/Acessos | AGD-ADM-015 | podeAdministrarAcessos; sessões dependem de podeGerenciarSessoes |

## Telas fora do menu Mais

| Tela | Código | Acesso à Ajuda |
|---|---|---|
| Entrar | AGD-SHR-002 | Botão local; somente início, login, ativação e recuperação |
| Ativar conta | AGD-SHR-003 | Mesmo conjunto público, sem utilizar o token de ativação |
| Recuperar PIN | AGD-SHR-004 | Mesmo conjunto público, sem enviar solicitação |
| Ciência do responsável PMO | AGD-SHR-005 | Somente instruções desse fluxo e início; não registra ciência |
| Operador temporário de Portaria | AGD-MOB-005 | Somente instruções desse fluxo e início; não utiliza nem exibe a credencial |
| Cadastro de convidado | AGD-MOB-006 | Somente instruções desse fluxo e início; não envia cadastro |

Esses seis artigos não aparecem no catálogo comum autenticado nem expõem artigos administrativos nos fluxos públicos. A Central em si permanece identificada como `AGD-SHR-006`.

## Subtelas e limites

Todos os códigos administrativos publicados `AGD-ADM-001–059`, móveis `AGD-MOB-001–006` e compartilhados `AGD-SHR-001–006` estão associados a um artigo (71 códigos, sem duplicidade). Formulários, detalhes e confirmações identificadas usam o artigo do módulo pai; não são 71 tutoriais independentes. Nas Séries e nos GTs foram incluídos acessos aos artigos também nas superfícies com código próprio. Detalhes de compromisso e QR individual abertos a partir de Minha Agenda/Calendário também oferecem Ajuda do contexto.

Estados transitórios de carregamento, confirmações nativas do navegador, permissões do sistema operacional e impressão não são telas funcionais independentes. A cobertura deste inventário não conclui a auditoria global de todas as subtelas ainda sem código da issue #247.

## Fontes cotejadas e diferenças da documentação

- Agenda/Calendário: manual M2.2 e componentes `AgendaView`, `EventoDetalhe`, `QrCodeModal`, `CalendarioView`.
- Login/ativação/recuperação/perfil: manual M2.1, `AuthView` e `PerfilView`; texto de ciência baseado em `ResponsabilidadeRegionalGate`.
- Eventos/Convocações/Séries: manual M2.3 e componentes/rotas correspondentes, incluindo autorização específica do acompanhamento RSVP.
- GTs: manual M2.5 e `GruposTrabalhoView`.
- Portaria e fluxos públicos: manual M2.7, `PortariaView`, `PortariaOperadorTemporarioView`, `CadastroConvidadoView` e fluxo de fechamento.
- Relatórios/Auditoria: manual M2.8 e componentes atuais. O aviso antigo sobre filtros nominais usarem valores anteriores **não foi reproduzido**: o código atual passa os novos valores explicitamente para a consulta. O relatório agregado ainda usa UUID do escopo. Relatório Agregado e utilização de locais/espaços exigem Master ou gestor de relatórios autorizado para o escopo; ser organizador de um evento não basta. Regra cotejada nas duas rotas e em `eGestorRelatoriosAutorizadoParaEscopo`.
- Avisos: `App.tsx` e `NotificacoesControl`. A tela configura a inscrição push do dispositivo e informa módulo em desenvolvimento; o texto não promete uma caixa de avisos de reuniões criada/alterada/cancelada.

## Verificação automatizada

O teste de ajuda percorre as abas exportadas de `SCREEN_CODES` e exige artigo, conteúdo, código e abertura contextual para cada uma. Outro teste verifica os 71 códigos e sua unicidade. A matriz de capacidades verifica as telas comuns e a autorização alternativa da Portaria. Telas isoladas são testadas com catálogo restrito. Os formulários reais de login/ativação e a entrada de recuperação preservam os dados ao abrir/fechar ajuda.

Playwright exercita os formulários reais de Local, Evento e Convocação, as telas reais Minha Agenda e Calendário e login/ativação/recuperação, em celular e desktop. A verificação pública também exige ausência de chamadas à API ao consultar Ajuda. Os demais módulos possuem cobertura de contexto e os testes existentes dos componentes; esta entrega não afirma E2E de todos os seus formulários reais.

Sem mudanças de API, banco, permissões ou publicação. Alterações continuam na branch do PR #348 para revisão Codex e CI; CodeRabbit é complementar, conforme orientação do usuário.
