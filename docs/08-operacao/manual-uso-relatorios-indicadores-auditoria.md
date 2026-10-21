# Manual de Uso — Relatórios, Indicadores e Auditoria (M2.8)

> **Rascunho para revisão do PO — 20/10/2026.** Instruções baseadas no código da `develop`; validar telas, permissões, versão em produção e exemplos anonimizados antes da distribuição. Não altera o sistema.

## 1. Acesso e princípios

A consulta de relatórios depende da autorização do usuário **para o evento ou escopo solicitado**. A API aplica verificações próprias de `eGestorRelatoriosAutorizadoParaEvento` e `eGestorRelatoriosAutorizadoParaEscopo`. Visualizar um menu não dá acesso irrestrito aos dados.

A **Trilha de Auditoria** possui autorização distinta; consultar um relatório não significa poder consultar logs. Use apenas dados necessários à finalidade institucional e não compartilhe arquivos nominais em canais públicos.

## 2. Painel de Relatórios: três modos

A interface `RelatoriosView` oferece **Relatório do Evento**, **Presenças** e **Relatório Agregado**. As informações não são intercambiáveis: confirmação de participação (RSVP), presença registrada por check-in e fechamento definitivo são conceitos diferentes.

### 2.1. Relatório do Evento

1. Acesse **Relatórios → Relatório do Evento**.
2. Pesquise pelo nome e selecione a reunião na lista disponível.
3. Acione **Buscar Relatório**.
4. Confira indicadores, como convocados, respostas e presenças.
5. Na relação nominal, utilize os filtros por **resposta RSVP**, **presença** e **nome**. Os valores selecionados são aplicados à consulta, e respostas de consultas anteriores não devem substituir os resultados mais recentes. Confirme que está na aba **Relatório do Evento**, pois **Presenças → Reunião específica** possui apresentação distinta.

A API consolida destinatários por membro em convocações publicadas ativas. Em eventos nacionais ou internacionais, a forma de obter convidados nominais e confirmações difere do fluxo territorial; não interprete a contagem como check-in de Portaria quando a operação de Portaria não se aplica.

**Atenção:** a taxa de resposta/confirmados não equivale automaticamente à taxa de presença. Leia os rótulos dos indicadores antes de apresentar resultados a terceiros.

### 2.2. Presenças — reunião específica

1. Entre em **Relatórios → Presenças → Reunião específica**.
2. Pesquise e selecione a reunião; clique em **Consultar**.
3. Confira o cabeçalho: **Lista final da reunião** se houver snapshot de fechamento ou **Prévia operacional** enquanto ainda não houver fechamento materializado.
4. Analise convocados, presentes convocados, ausentes, convidados presentes e pendentes.
5. Para obter uma cópia, utilize **Exportar CSV** ou a opção de impressão da tela.

**A prévia operacional não é o fechamento oficial.** Não identifique como definitivo um resultado que ainda não passou pela confirmação da Portaria. Os relatórios de Portaria não se aplicam a eventos pessoais, nacionais e internacionais; a API pode retornar indisponibilidade nesses casos.

### 2.3. Presenças — histórico de membro

1. Selecione a aba de histórico por **membro** dentro de **Presenças**.
2. Pesquise o membro e ajuste o período, quando necessário.
3. Consulte a relação de reuniões e a situação de presença.
4. Se autorizado, utilize **Exportar CSV** ou impressão.

O histórico utiliza eventos **com fechamento materializado**, limitados ao escopo autorizado. Não é lista universal de toda a trajetória do membro: eventos ainda abertos, eventos pessoais e eventos externos não entram nessa consolidação. Se nenhum item autorizado existir, a API protege a identidade do membro consultado.

### 2.4. Presenças — período e escopo

1. Selecione **Presenças → Período / escopo**.
2. Informe o nível territorial desejado e a unidade correspondente pelos filtros de Regional, Administração, Setor, Casa ou Grupo de Trabalho.
3. Se necessário, informe data inicial e final.
4. Clique em **Consultar**; confira os totais e a lista de eventos.
5. Exporte CSV ou imprima somente quando houver finalidade autorizada.

Esse consolidado agrega **eventos territoriais institucionais com fechamento de Portaria**. Não equivale ao universo de eventos pessoais ou atendimentos nacionais/internacionais. Confira o denominador da **taxa de presença dos convocados**, distinto do total de convidados presentes.

## 3. Relatório Agregado e utilização de locais

1. Abra **Relatórios → Relatório Agregado**.
2. Defina **tipo de escopo**, informe o campo técnico **ID do Escopo (UUID)** e escolha **data inicial** e **data final**. **Nesta tela ainda não há seletor de unidade**: o UUID deve ser obtido com a equipe administradora responsável pelo cadastro institucional, mediante conferência da unidade e autorização. Não tente adivinhar o identificador nem utilizar dados de outra unidade.
3. Gere o relatório e confira totais e taxas por evento.
4. Para analisar demanda por instalações, consulte a seção de **utilização de locais/espaços**, que usa o mesmo escopo e período.
5. Caso precise compartilhar o levantamento de utilização, use **Exportar CSV**.

**Importante sobre privacidade:** o total de eventos no escopo pode incluir eventos cuja localização particular não é visível para o usuário; o ranking considera **somente locais e espaços visíveis**. Por isso, total geral e somatório do ranking podem divergir sem indicar erro. A consulta de utilização depende dos filtros utilizados, e uma troca de escopo/período exige carregar novamente o resultado correspondente.

## 4. Trilha de Auditoria

A tela de **Trilha de Auditoria** é reservada a quem possui permissão de auditoria conforme escopo; a API exige autorização e limita os registros territoriais acessíveis. A regra preserva a privacidade de eventos pessoais de terceiros, inclusive diante de consultas globais.

1. Abra **Trilha de Auditoria**, se estiver autorizada para o seu perfil.
2. Confira os registros recentes apresentados em **Data / Hora**, ação, recurso, ator e escopo.
3. Filtre pela **ação** ou **tipo de recurso**, quando necessário.
4. Utilize a paginação para navegar por registros mais antigos.
5. Se houver informação contextual, escolha **Ver Detalhes** para visualizar o contexto do registro.

A tela implementada **não oferece exportação CSV da auditoria**, nem expõe todos os parâmetros que a API aceita (como data inicial/final, escopo e ator). Não oriente o operador a procurar botões inexistentes ou executar consultas diretas à API para contornar autorização. Logs devem ser tratados como informações restritas; não copie contextos contendo informações pessoais para comentários públicos.

## 5. Interpretação dos indicadores

| Indicador | Leitura operacional |
|---|---|
| Convocados | Membros vinculados às convocações consideradas na consulta |
| Confirmados / RSVP | Resposta à convocação; não comprova comparecimento |
| Presentes convocados | Membros convocados com presença registrada/consolidada conforme o relatório |
| Convidados presentes | Convidados cuja presença foi validada |
| Ausentes | Convocados sem presença no retrato considerado |
| Taxa de presença | Conferir em cada tela o denominador informado; não misturar taxas diferentes |
| Utilização de locais | Frequência de uso de locais/espaços **visíveis** nos filtros selecionados |

## 6. Situações frequentes

| Situação | Procedimento |
|---|---|
| Reunião não aparece | Conferir filtros, período, existência do evento e autorização de consulta |
| Relatório final mostra **Prévia operacional** | Verificar se a Portaria teve fechamento definitivo |
| Relatório de Portaria indisponível | Verificar se é evento pessoal, nacional ou internacional |
| Histórico de membro incompleto | Conferir período, escopo e existência de reuniões fechadas |
| Totais de utilização diferem do ranking | Ranking não inclui locais particulares invisíveis ao usuário |
| Acesso negado aos logs | Verificar perfil de auditoria e escopo autorizado; não contornar o bloqueio |
| Indicadores de RSVP divergem das presenças | Confirmar distinção entre resposta à convocação e check-in efetivo |

## 7. Segurança e validações antes da publicação

- Não use relatórios nominais para finalidade não autorizada; adote distribuição restrita e retenção institucional adequada.
- Não inclua dados pessoais reais em capturas, tickets públicos ou anexos do manual.
- Confirme versão de produção e teste filtros, exportação, impressão e autorização com contas de homologação.
- Revise com gestor de relatórios as definições de taxa e critérios de consolidação.
- Valide a trilha de auditoria com perfil autorizado e confira ocultação de eventos pessoais de terceiros.
- Capture imagens anonimizadas do fluxo real somente após validação editorial.

## 8. Fontes técnicas

- `apps/web/src/components/relatorios/RelatoriosView.tsx`
- `apps/web/src/components/relatorios/RelatoriosPresencaView.tsx`
- `apps/web/src/components/auditoria/AuditoriaView.tsx`
- `apps/worker/src/routes/relatorios.ts`
- `apps/worker/src/routes/auditoria.ts`
- `apps/worker/src/security/permissoes.ts`

Este documento descreve funções existentes na branch examinada, não solicita novas permissões nem altera regras de negócio.
