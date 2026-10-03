# S13 - Handoff de UX para Google Stitch

## 1. Objetivo

Este documento fornece ao Google Stitch um inventario enxuto do frontend atual da Agenda Regional Sao Paulo e orienta uma proposta visual/UX para as superficies prioritarias. O objetivo e apoiar a aprovacao do PO sem alterar a arquitetura, as permissoes ou o codigo existente.

A nova rodada de UX deve ser tratada como um redesenho do zero. Artefatos, mockups ou propostas anteriores do Stitch nao devem ser considerados como referencia visual obrigatoria. O ponto de partida e o produto funcional atual, seus fluxos consolidados, as regras de negocio existentes e as dividas UX registradas.

O frontend atual usa React, Vite e Tailwind. O produto atende usuarios com diferentes niveis de familiaridade tecnologica, com foco em acesso por celular e em consultas e acoes recorrentes de agenda.

## 2. Fonte canonica do estado atual

Para este handoff, o estado atual do produto deve ser lido a partir de duas fontes de codigo:

- `apps/web/src/App.tsx`: define as superficies renderizadas, fluxos publicos, autenticacao, componentes e gates de acesso;
- `apps/web/src/components/layout/MainLayout.tsx`: define a navegacao autenticada, os agrupamentos visuais e a exibicao condicional por capability.

Quando houver divergencia entre este documento e essas fontes, prevalece o codigo. O Stitch nao deve inferir novas rotas, menus, capabilities ou agrupamentos.

## 3. Matriz canonica de superficies

Cada superficie possui uma classificacao primaria unica de UX. Essa classificacao define o prefixo do identificador de QA: `MOB` para `MOBILE_FIRST`, `ADM` para `DESKTOP_FIRST` e `SHR` para `RESPONSIVO_DUAL`.

| Superficie | Componente / rota | Navegacao / contexto atual | Capability de acesso | Capability interna relevante | Classificacao UX | Estado atual |
| --- | --- | --- | --- | --- | --- | --- |
| Minha Agenda | `AgendaView` | Barra inferior | nenhuma adicional | — | MOBILE_FIRST | EXISTENTE |
| Eventos | `EventosView` | Barra inferior | `podeGerirAgenda` | — | DESKTOP_FIRST | EXISTENTE |
| Calendario | `CalendarioView` | Barra inferior | nenhuma adicional | — | MOBILE_FIRST | EXISTENTE |
| Convocacoes | `ConvocacoesView` | Barra inferior | `podeGerirAgenda` | — | DESKTOP_FIRST | EXISTENTE |
| Series | `SeriesView` | Mais > Agenda e gestao | `podeGerirAgenda` | — | DESKTOP_FIRST | EXISTENTE |
| Relatorios | `RelatoriosView` | Mais > Agenda e gestao | `podeVisualizarRelatorios` | — | DESKTOP_FIRST | EXISTENTE |
| Avisos | `NotificacoesControl` | Mais > Agenda e gestao | nenhuma adicional | — | MOBILE_FIRST | PARCIAL |
| Portaria autenticada | `PortariaView` | Mais > Agenda e gestao | `podeOperarPortaria || podeGerirAgenda` | — | MOBILE_FIRST | EXISTENTE |
| Auditoria | `AuditoriaView` | Mais > Agenda e gestao | `podeVisualizarAuditoria` | — | DESKTOP_FIRST | EXISTENTE |
| Regionais | `RegionaisView` | Mais > Administracao | `podeAdministrarEstrutura` | `podeAdministrarRegionais` controla criacao/edicao | DESKTOP_FIRST | EXISTENTE |
| Administracoes | `AdministracoesView` | Mais > Administracao | `podeAdministrarEstrutura` | — | DESKTOP_FIRST | EXISTENTE |
| Setores | `SetoresView` | Mais > Administracao | `podeAdministrarEstrutura` | — | DESKTOP_FIRST | EXISTENTE |
| Casas | `CasasView` | Mais > Administracao | `podeAdministrarEstrutura` | — | DESKTOP_FIRST | EXISTENTE |
| Grupos de Trabalho | `GruposTrabalhoView` | Mais > Administracao | `podeAdministrarEstrutura` | — | DESKTOP_FIRST | EXISTENTE |
| Locais | `LocaisView` | Mais > Administracao | `podeGerirAgenda` | — | DESKTOP_FIRST | EXISTENTE |
| Membros | `MembrosView` | Mais > Pessoas e acessos | `podeAdministrarPessoas` | — | DESKTOP_FIRST | EXISTENTE |
| Funcoes | `FuncoesView` | Mais > Pessoas e acessos | `podeAdministrarFuncoes` | — | DESKTOP_FIRST | EXISTENTE |
| Vinculos | `VinculosFuncionaisView` | Mais > Pessoas e acessos | `podeAdministrarPessoas` | — | DESKTOP_FIRST | EXISTENTE |
| Acessos | `ContasAcessoView` | Mais > Pessoas e acessos | `podeAdministrarAcessos` | `podeGerenciarSessoes` controla consulta/revogacao de sessoes | DESKTOP_FIRST | EXISTENTE |
| Meu Cadastro | `PerfilView` | Mais > Conta | nenhuma adicional | — | RESPONSIVO_DUAL | EXISTENTE |
| Login | `AuthView` | Fluxo anonimo | sessao anonima | — | RESPONSIVO_DUAL | EXISTENTE |
| Ativacao de conta | `AuthView` com token | Fluxo anonimo | token de ativacao | — | RESPONSIVO_DUAL | EXISTENTE |
| Recuperacao de PIN | `AuthView` | Fluxo anonimo | sessao anonima | — | RESPONSIVO_DUAL | EXISTENTE |
| Portaria temporaria | `PortariaOperadorTemporarioView` — `/o/` ou `/portaria-operador` | Fluxo publico por token | token de operador | — | MOBILE_FIRST | EXISTENTE |
| Cadastro de convidado | `CadastroConvidadoView` — `/c` ou `/convidado` | Fluxo publico por token | token de portaria | — | MOBILE_FIRST | EXISTENTE |
| Ciencia de responsabilidade regional | `ResponsabilidadeRegionalGate` | Gate obrigatorio antes da area autenticada quando houver ciencia pendente | usuario autenticado com responsabilidade pendente | confirma um acesso regional por vez; apos cada registro consulta novamente e repete o gate ate nao restar pendencia. Se a consulta inicial falhar por erro diferente de 403, registra o erro e libera a aplicacao; se a reconsulta apos uma ciencia falhar por erro diferente de 403, preserva a responsabilidade anterior e mantem o gate exibido ate nova verificacao. Em 403, a responsabilidade e limpa e a aplicacao e liberada | RESPONSIVO_DUAL | EXISTENTE |
| Alerta global de recuperacao de PIN | `MainLayout` + contagem carregada em `App.tsx` | Banner global fora da tela Acessos, quando ha solicitacoes pendentes | `podeAdministrarAcessos` | acao `Ver solicitacoes` direciona para Acessos; oculto dentro da propria tela Acessos | DESKTOP_FIRST | EXISTENTE |

Os estados transversais — loading, erro, vazio, acesso negado, sessao expirada, sucesso e conflitos — pertencem a essas superficies e devem ser harmonizados visualmente, sem criar telas funcionais novas.

## 4. Navegacao canonica

A navegacao autenticada atual deve ser preservada como referencia funcional:

- barra inferior:
  - Minha Agenda;
  - Eventos, quando `podeGerirAgenda`;
  - Calendario;
  - Convocacoes, quando `podeGerirAgenda`;
  - Mais.
- Mais > Agenda e gestao:
  - Series;
  - Relatorios;
  - Avisos;
  - Portaria;
  - Auditoria.
- Mais > Administracao:
  - Regionais;
  - Administracoes;
  - Setores;
  - Casas;
  - Grupos de Trabalho;
  - Locais.
- Mais > Pessoas e acessos:
  - Membros;
  - Funcoes;
  - Vinculos;
  - Acessos.
- Mais > Conta:
  - Meu Cadastro.

O Stitch pode propor uma composicao visual melhor para desktop e mobile, mas nao deve alterar o significado dos destinos, as permissoes ou os fluxos sem aprovacao explicita do PO.

## 5. Capabilities e controles internos

As capabilities retornadas por `auth/me` devem ser preservadas. Elas podem liberar uma superficie inteira ou apenas acoes internas:

- `podeOperarPortaria` ou `podeGerirAgenda`: acesso a Portaria autenticada;
- `podeVisualizarRelatorios`: acesso a Relatorios;
- `podeVisualizarAuditoria`: acesso a Auditoria;
- `podeAdministrarAcessos`: acesso a Acessos;
- `podeAdministrarEstrutura`: acesso a Regionais, Administracoes, Setores, Casas e Grupos de Trabalho;
- `podeAdministrarPessoas`: acesso a Membros e Vinculos;
- `podeAdministrarFuncoes`: acesso a Funcoes;
- `podeGerirAgenda`: acesso a Eventos, Series, Convocacoes e Locais;
- `podeAdministrarRegionais`: dentro de Regionais, controla criacao/edicao;
- `podeGerenciarSessoes`: dentro de Acessos, controla consulta/revogacao de sessoes;
- `ResponsabilidadeRegionalGate`: quando existe ciencia pendente, substitui temporariamente toda a area autenticada; a confirmacao ocorre sequencialmente por acesso regional pendente, com nova consulta apos cada registro, e a aplicacao so e liberada quando nao restam pendencias. Em erro diferente de 403 na consulta inicial, o componente registra a falha e libera a aplicacao; em erro equivalente na reconsulta apos uma ciencia, preserva a responsabilidade anterior e mantem o gate exibido ate nova verificacao;
- recuperacoes de PIN pendentes: com `podeAdministrarAcessos`, `App.tsx` carrega a contagem e `MainLayout` exibe um alerta global com acesso direto a Acessos, exceto quando o usuario ja esta nessa tela.

Uma superficie visivel nao implica permissao para todas as suas acoes. O redesenho deve preservar essas diferencas.

## 6. Diretrizes UX por classificacao

- `MOBILE_FIRST`: Minha Agenda, Calendario, Avisos, Portaria autenticada, Portaria temporaria e Cadastro de convidado. Priorizar cards, fluxo sequencial, alvos de toque grandes, QR/check-in e poucos passos.
- `DESKTOP_FIRST`: Eventos, Convocacoes, Series, Relatorios, Auditoria, Regionais, Administracoes, Setores, Casas, Grupos de Trabalho, Locais, Membros, Funcoes, Vinculos, Acessos e o alerta global de recuperacoes de PIN. Priorizar tabelas, filtros persistentes, contexto simultaneo, formularios amplos e uso eficiente da largura.
- `RESPONSIVO_DUAL`: Login, Ativacao de conta, Recuperacao de PIN, Meu Cadastro e Ciencia de responsabilidade regional. Manter equivalencia funcional entre mobile e desktop, com composicao apropriada para cada breakpoint.

Cada superficie tem uma unica classificacao primaria. Adaptacoes para outro dispositivo nao criam uma segunda classificacao nem outro identificador para a mesma superficie.

## 7. Requisitos UX para o handoff

A proposta deve:

- usar a matriz canonica como inventario do produto atual;
- diferenciar claramente estado atual do produto e proposta futura de UX;
- nao tratar desktop como mero estiramento do mobile nem mobile como simples reducao do desktop;
- em desktop, aproveitar largura para tabelas, filtros persistentes, paineis laterais, multiplas colunas e contexto simultaneo;
- em mobile/PWA, preferir cards, etapas sequenciais, navegacao compacta e acoes focadas;
- considerar usuarios com diferentes niveis de familiaridade tecnologica;
- usar textos legiveis, linguagem direta, contraste adequado e hierarquia visual clara;
- manter alvos de toque grandes em navegacao, RSVP, QR e check-in;
- reduzir passos para consultar agenda, responder convocacao e apresentar QR Code;
- harmonizar cards, formularios, tabelas, dialogs e mensagens;
- explicitar sucesso, aviso, erro, carregamento, ausencia de dados e acesso negado;
- preservar contratos, regras de negocio, rotas publicas, capabilities, gates bloqueantes e controles internos/transversais;
- preparar base visual para acessibilidade nas sub-sprints seguintes sem antecipar definicoes tecnicas de WCAG.

Este documento nao define detalhes tecnicos de WCAG. A implementacao de acessibilidade sera tratada nas sub-sprints apropriadas.

## 8. Convencao de identificacao de telas

Toda tela ou superficie desenhada deve possuir um codigo unico e estavel no inventario de UX/QA, para permitir identificacao objetiva em suporte, homologacao, manutencao e relatos de erro. A exibicao desse codigo na interface do produto e opcional e depende de aprovacao explicita do PO.

Regras:

- o codigo deve existir obrigatoriamente no inventario de telas e artefatos de QA;
- quando o PO aprovar sua exibicao na interface, deve aparecer discretamente, preferencialmente no rodape, canto inferior ou area de metadados, sem competir visualmente com o conteudo principal;
- o identificador deve permanecer estavel mesmo que o layout evolua;
- modal, dialogo ou subfluxo relevante pode receber codigo proprio quando for tratado como superficie independente;
- relatos de suporte e QA devem poder referenciar diretamente o codigo da tela;
- a convencao deve ser simples e legivel, por exemplo: `AGD-MOB-001`, `AGD-ADM-001`, `AGD-SHR-001`;
- `MOB` identifica superficies mobile-first, `ADM` superficies administrativas/desktop-first e `SHR` fluxos responsivos compartilhados;
- o inventario de telas deve manter a correspondencia entre codigo, nome funcional, perfil de uso e rota/componente quando houver.

## 9. Dividas UX incorporadas ao redesenho

As dividas abaixo devem ser tratadas como requisitos do Stitch, evitando implementacao isolada antes do redesenho:

- #241: melhorar navegacao horizontal em telas largas do Master, preservando contexto de linha e reduzindo dependencia da barra de rolagem no fim da pagina;
- #242: incluir filtro de Setor antes de Casa de Oracao e ordenar alfabeticamente Locais fisicos;
- #226: adicionar busca e filtros em Contas e Acessos, incluindo nome, celular, carteirinha, escopo territorial, status e perfil;
- #231/#232: incorporar no redesenho os filtros remanescentes de ativos/inativos/cancelados e refinamentos do fluxo Evento -> Convocacao -> Funcoes.

Essas dividas nao sao pre-condicao para iniciar o trabalho com o Stitch; elas fazem parte do briefing do proprio redesenho.

## 10. Telas prioritarias

1. Minha Agenda e detalhe do evento, incluindo RSVP, periodos, justificativa e QR Code.
2. Calendario, com selecao de dia e visualizacao dos eventos.
3. Avisos, evoluindo o controle de notificacoes para uma tela compreensivel de preferencias.
4. Meu Cadastro, classificado como RESPONSIVO_DUAL, preservando consulta de dados institucionais, atualizacao de celular e alteracao de PIN.
5. Login e ativacao/redefinicao de PIN, classificados como RESPONSIVO_DUAL, preservando os fluxos existentes de autenticacao, ativacao e solicitacao de redefinicao.
6. Portaria, classificada como MOBILE_FIRST, e Relatorios/Auditoria, classificados integralmente como DESKTOP_FIRST, preservando os acessos condicionais e priorizando os respectivos contextos operacionais.

## 11. Estados especiais

A proposta deve apresentar estados visuais para:

- carregamento inicial e carregamento de acao;
- lista sem eventos, sem participantes ou sem registros;
- erro de consulta e erro de acao;
- permissao de notificacao negada ou recurso nao suportado;
- acesso negado por ausencia de capability;
- sessao expirada ou usuario nao autenticado;
- conflito de check-in ja registrado;
- RSVP pendente, confirmado, recusado e sem periodo selecionado;
- tabelas extensas em telas pequenas;
- sucesso com possibilidade de continuar a tarefa.

Os estados existentes devem ser preservados como comportamento funcional e harmonizados visualmente na proposta.

## 12. Restricoes tecnicas

- Preservar a arquitetura React/Vite/Tailwind existente.
- Preservar a navegacao e os nomes canonicamente definidos.
- Preservar as capabilities e a exibicao condicional atual.
- Preservar os contratos de dados e os fluxos funcionais ja implementados.
- Reaproveitar os componentes existentes quando o design aprovado for adaptado.
- Considerar a base visual atual: Tailwind, paleta `brand` azul e tipografia Inter.
- Nao introduzir backend, novas rotas de API ou novo modelo de permissao como parte do handoff.

## 13. Itens fora de escopo

- Implementacao de qualquer tela ou componente nesta etapa.
- Inicio da S13.03.
- Alteracao de arquitetura React/Vite/Tailwind.
- Criacao de novas capabilities ou menus.
- Definicao tecnica detalhada de WCAG.
- Mudanca dos contratos de autenticacao, sessao ou PIN.
- Incorporacao automatica de codigo gerado pelo Stitch.

O Stitch fornecera uma proposta visual/UX. O codigo gerado nao sera incorporado cegamente. O Copilot adaptara posteriormente o design aprovado a arquitetura real, preservando React/Vite/Tailwind e as permissoes existentes.

## 14. Criterios para aprovacao do PO

A proposta visual sera considerada pronta para aprovacao quando:

- cobrir a navegacao principal e as telas condicionais sem criar menus novos;
- representar desktop e mobile conforme a classificacao de cada fluxo: mobile-first para usuario comum, desktop-first para Master/administracao e responsivo dual quando aplicavel;
- atribuir codigo unico a cada tela/superficie aprovada e manter inventario de rastreabilidade; a exibicao do codigo na interface depende de aprovacao explicita do PO;
- mostrar os fluxos prioritarios e seus estados especiais;
- deixar claras as acoes principais e seus resultados;
- manter linguagem, hierarquia, contraste e alvos de toque adequados ao publico;
- distinguir recursos disponiveis de recursos condicionais por capability;
- permitir identificar o que e existente, parcial e futuro;
- nao exigir mudanca de arquitetura ou de contratos para ser adaptada;
- receber aprovacao explicita do PO antes de qualquer implementacao da S13.03.

## 15. Relacao com S13.03 e S13.04

Este documento e um handoff de UX, nao uma implementacao. A S13.03 so deve comecar depois da aprovacao visual/UX do PO e da definicao das telas prioritarias. A S13.04 e as demais atividades de acessibilidade devem usar a proposta aprovada como referencia, sem antecipar neste documento detalhes tecnicos de WCAG.

A S13.03 permanece NAO INICIADA.
