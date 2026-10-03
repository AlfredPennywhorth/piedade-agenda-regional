# S13 - Handoff de UX para Google Stitch

## 1. Objetivo

Este documento fornece ao Google Stitch um inventario enxuto do frontend atual da Agenda Regional Sao Paulo e orienta uma proposta visual/UX para as superficies prioritarias. O objetivo e apoiar a aprovacao do PO sem alterar a arquitetura, as permissoes ou o codigo existente.

A nova rodada de UX deve ser tratada como um redesenho do zero. Artefatos, mockups ou propostas anteriores do Stitch nao devem ser considerados como referencia visual obrigatoria. O ponto de partida e o produto funcional atual, seus fluxos consolidados, as regras de negocio existentes e as dividas UX registradas.

O frontend atual usa React, Vite e Tailwind. O produto atende usuarios com diferentes niveis de familiaridade tecnologica, com foco em acesso por celular e em consultas e acoes recorrentes de agenda.

## 2. Estado atual do frontend

### Telas e fluxos presentes

- Minha Agenda: lista eventos futuros, abre detalhe, permite RSVP, justificativa de ausencia, escolha de periodos, QR Code e compartilhamento por WhatsApp.
- Calendario: calendario mensal, navegacao entre meses, selecao de dia e abertura de eventos.
- Avisos: controle de notificacoes push e estados de suporte, permissao e ativacao; a tela ainda exibe aviso de modulo em desenvolvimento.
- Portaria: selecao de evento, leitura de token QR, busca de participante, check-in manual e feedback de sucesso, aviso e erro.
- Relatorios: relatorio por evento, lista nominal filtravel e relatorio agregado por escopo e periodo.
- Auditoria: filtros, tabela paginada, atualizacao e modal de contexto JSON.
- Meu Cadastro: rota de navegacao presente, mas somente com placeholder de modulo em desenvolvimento.

### Componentes estruturais e reutilizaveis

- `MainLayout`: cabecalho, area principal, navegacao inferior e exibicao condicional por capability.
- `EventCard`: resumo reutilizavel de evento em Minha Agenda e Calendario.
- `EventoDetalhe`: dialogo de detalhes, RSVP, QR Code, links de local/transmissao e compartilhamento.
- `QrCodeModal`: abertura do QR Code do destinatario.
- `NotificacoesControl`: leitura e alteracao do estado de notificacoes push.
- Controles nativos reutilizados: botoes, inputs, selects, tabelas, dialogs e mensagens de feedback.

Nao existe ainda um catalogo de componentes ou uma camada visual independente do Tailwind.

## 3. Matriz de superficies

| Superficie                    | Classificacao | Evidencia atual                                                                                |
| ----------------------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| Minha Agenda                  | EXISTENTE     | Lista, loading, erro, estado vazio, detalhe e RSVP.                                            |
| Calendario                    | EXISTENTE     | Grade mensal, navegacao, eventos por dia e estado vazio do dia.                                |
| Avisos                        | PARCIAL       | Notificacoes push funcionais, mas modulo ainda marcado como em desenvolvimento.                |
| Meu Cadastro                  | PARCIAL       | Navegacao existe; conteudo e placeholder.                                                      |
| Portaria                      | EXISTENTE     | Check-in QR/manual, busca, participantes e feedback operacional.                               |
| Relatorios                    | EXISTENTE     | Relatorio por evento, agregado, filtros, loading e erros.                                      |
| Auditoria                     | EXISTENTE     | Filtros, tabela, paginacao, loading, erro e detalhes.                                          |
| Login                         | AUSENTE       | Nao ha tela de login no frontend atual.                                                        |
| Ativacao / redefinicao de PIN | AUSENTE       | Nao ha tela ou fluxo visual correspondente.                                                    |
| Estados de erro               | PARCIAL       | Existem mensagens por view; falta tratamento visual transversal e consistente.                 |
| Estados vazios                | EXISTENTE     | Agenda, calendario, portaria e auditoria possuem estados vazios locais.                        |
| Loading                       | EXISTENTE     | Ha spinners, textos e botoes desabilitados em varias views.                                    |
| Acesso negado                 | PARCIAL       | Capabilities ocultam Portaria, Relatorios e Auditoria; nao ha tela explicita de acesso negado. |

## 4. Navegacao canonica

A navegacao principal definida no projeto e:

- Minha Agenda
- Calendario
- Avisos
- Meu Cadastro

A navegacao condicional conforme capability e:

- Portaria
- Relatorios
- Auditoria

O Stitch deve preservar esses nomes e essa organizacao. Nao devem ser inventados novos menus, agrupamentos ou perfis de acesso.

## 5. Perfis e capabilities relevantes

O frontend consulta as capabilities retornadas por `auth/me` e usa somente estas regras de exibicao:

- `podeOperarPortaria`: exibe Portaria.
- `podeVisualizarRelatorios`: exibe Relatorios.
- `podeVisualizarAuditoria`: exibe Auditoria.

Minha Agenda, Calendario, Avisos e Meu Cadastro formam a navegacao principal. A proposta visual deve manter a diferenca entre navegacao principal e ferramentas condicionais, sem criar novas capabilities ou presumir permissoes nao definidas.

## 6. Requisitos UX para o handoff

A proposta deve considerar:

- classificar cada fluxo como `MOBILE_FIRST`, `DESKTOP_FIRST` ou `RESPONSIVO_DUAL`;
- `MOBILE_FIRST`: priorizar o usuario comum em Minha Agenda, Calendario, RSVP, QR Code, notificacoes e acoes rapidas;
- `DESKTOP_FIRST`: priorizar Master e administracao em gestao de eventos/series, convocacoes, membros, contas e acessos, locais/espacos, relatorios densos e configuracoes;
- `RESPONSIVO_DUAL`: preservar experiencia equivalente em login, Meu Cadastro, consultas simples e fluxos compartilhados;
- nao tratar desktop como mero estiramento da tela mobile nem mobile como simples reducao da tela desktop;
- em desktop, aproveitar largura para tabelas, filtros persistentes, paineis laterais, multiplas colunas e contexto simultaneo;
- em mobile/PWA, preferir cards, etapas sequenciais, navegacao compacta e acoes focadas;
- usuarios com diferentes niveis de familiaridade tecnologica;
- navegacao simples e previsivel;
- textos legiveis e linguagem direta;
- contraste adequado e hierarquia visual clara;
- alvos de toque grandes, especialmente em navegacao, RSVP e check-in;
- poucos passos para consultar agenda, responder convocacao e apresentar QR Code;
- consistencia entre cards, formularios, tabelas, dialogs e mensagens;
- feedback explicito para sucesso, aviso, erro, carregamento e ausencia de dados;
- layout responsivo para tabelas e relatorios sem perda de contexto;
- base visual que permita a futura implementacao de acessibilidade em S13.03 e S13.04.

Este documento nao define detalhes tecnicos de WCAG. A implementacao de acessibilidade sera tratada nas sub-sprints apropriadas.

## 7. Diretriz de composicao por dispositivo

A aplicacao continuara sendo unica e responsiva, com os mesmos contratos, permissoes e regras de negocio, mas o Stitch deve propor composicoes distintas conforme o contexto de uso.

| Contexto | Prioridade | Superficies principais | Diretriz |
| --- | --- | --- | --- |
| Usuario comum em PWA/celular | MOBILE_FIRST | Minha Agenda, Calendario, RSVP, QR Code, notificacoes, Meu Cadastro | Navegacao simples, cards, acoes rapidas, poucos passos e alvos de toque grandes. |
| Master e administradores em computador | DESKTOP_FIRST | Eventos, Series, Convocacoes, Membros, Contas e Acessos, Locais/Espacos, Relatorios, Auditoria | Tabelas e formularios amplos, filtros persistentes, contexto simultaneo, paineis laterais e uso eficiente da largura. |
| Fluxos compartilhados | RESPONSIVO_DUAL | Login, Meu Cadastro, consultas simples, relatorios leves | Manter equivalencia funcional, com composicao adequada a cada breakpoint. |

A proposta deve considerar que configuracao e manutencao administrativa serao realizadas preferencialmente em computador. A experiencia mobile dessas telas administrativas pode permanecer funcional, mas nao deve limitar o desenho desktop.

## 8. Convencao de identificacao de telas

Toda tela ou superficie desenhada deve possuir um codigo unico, estavel e visivel ao usuario, para permitir identificacao objetiva em suporte, homologacao, manutencao e relatos de erro.

Regras:

- o codigo deve aparecer discretamente na propria interface, preferencialmente no rodape, canto inferior ou area de metadados da tela;
- o codigo nao deve competir visualmente com o conteudo principal;
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
4. Meu Cadastro, substituindo o placeholder por um fluxo de consulta e manutencao definido pelo PO.
5. Login e ativacao/redefinicao de PIN, ausentes no frontend atual e necessarios para completar a entrada do usuario.
6. Portaria, Relatorios e Auditoria, preservando os acessos condicionais e priorizando fluxos operacionais.

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
- atribuir codigo unico e visivel a cada tela/superficie aprovada e manter inventario de rastreabilidade;
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
