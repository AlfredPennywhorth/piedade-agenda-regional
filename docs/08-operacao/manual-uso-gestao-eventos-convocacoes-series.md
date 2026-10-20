# Manual de Uso — Gestão de Eventos, Convocações e Séries

> **Rascunho para revisão do PO — 20/10/2026 (Etapa M2.3).** Documentação funcional baseada nos componentes da branch `main` consultados nesta etapa. A versão/build efetivamente publicada e capturas de tela ainda precisam de conferência antes da distribuição. Não cria permissões ou funcionalidades novas.

## 1. Quem encontra os módulos administrativos

Depois do login, contas com a capacidade efetiva `podeGerirAgenda` têm acesso, na navegação, a **Eventos**, **Convocações** e **Séries**. A visibilidade do módulo **não** significa permissão irrestrita sobre todos os registros: a API valida o escopo e as autorizações de cada operação. Consulte também o capítulo **Minha Agenda e Calendário** para as ações do usuário convidado.

- **Eventos** (`AGD-ADM-001`): cadastrar, consultar, filtrar e, se permitido, editar/cancelar eventos.
- **Convocações**: preparar, publicar, acompanhar e cancelar convocações institucionais.
- **Séries**: definir reuniões recorrentes e administrar ocorrências.
- **Minha Agenda** e **Calendário**: consultar compromissos e responder convocações pelo perfil do participante, sem depender do módulo administrativo.

**Importante:** se uma aba ou comando não aparecer, não tente contornar a restrição usando outra conta. Procure um administrador de nível competente.

## 2. Consultar e filtrar eventos

1. Abra **Eventos**.
2. A listagem inicia com filtros de **eventos futuros** e **ativos**; altere o período para passados/todos ou a situação para cancelados/todos quando necessário.
3. Conforme o escopo autorizado, utilize os filtros de abrangência e localização (Regional, Administração e Setor). Para perfil Master, há também filtro de pessoa.
4. Use **Ver** para consultar detalhes e verificar título, início, modalidade, escopo e, quando exibidos, local/espaço.
5. Nos eventos externos, observe destino nacional (cidade/UF) ou internacional (cidade/país).
6. Os comandos **Editar**, **Cancelar Evento**, **Reativar Evento** e **Gerar acesso de Portaria** só aparecem em condições específicas de gerenciamento, status e tipo de evento.

A lista administrativa não deve ser confundida com a lista pessoal de compromissos. Um filtro pode ocultar eventos que existem e continuam válidos.

## 3. Cadastrar evento

1. Em **Eventos**, escolha **+ Novo Evento**.
2. Informe o **tipo/escopo** autorizado, distinguindo evento institucional de **Próprio** quando essa opção estiver efetivamente disponível à sua conta.
3. Preencha título, início, fim, modalidade e demais campos apresentados. Utilize descrição, pauta e observações conforme a necessidade.
4. Para evento presencial ou híbrido, selecione o **Local** e, quando aplicável, o **Espaço**. Em modalidades com participação online, confira a URL solicitada.
5. Confira o organizador apresentado. O formulário normalmente utiliza a identidade do usuário ao criar, mas não se deve prometer livre escolha de organizador para todos os perfis.
6. Confira a abrangência antes de salvar:
   - **Territorial**: Regional, Administração, Setor, Casa de Oração ou Grupo de Trabalho, conforme disponibilidade e competência.
   - **Nacional**: destino em estado e cidade do Brasil fora do fluxo territorial comum, com convites nominais quando aplicável.
   - **Internacional**: país e cidade de destino, com convites nominais quando aplicável.
7. Se houver opção legítima de criação de **Local** ou **Espaço** dentro do formulário, confira a titularidade e autorização. Local particular e local institucional não são intercambiáveis.
8. Clique em **Salvar Evento** e aguarde a resposta. Se forem exibidos erros, corrija os campos indicados antes de repetir a gravação.

**Destino do fluxo após salvar:** a navegação depende do tipo de evento. Um evento próprio pode retornar à agenda do criador; um evento institucional territorial pode conduzir à etapa de convocação; um evento institucional nacional/internacional pode abrir os detalhes para gerenciamento de participantes. **Não considerar a criação do evento, por si só, prova de que uma convocação foi publicada.**

## 4. Alterar, cancelar ou reativar evento

- Se o registro permitir, selecione **Editar**, revise os campos e confirme a gravação.
- Quando a ocorrência pertence a uma série, a interface distingue **esta ocorrência** e alterações da série **desta em diante**. Leia a confirmação antes de salvar; não suponha que modificar um dia específico altere todos os outros.
- **Cancelar Evento** pede confirmação. Se houver convocação em rascunho, o sistema indica que suas funções serão removidas e a convocação será cancelada. A ação não deve ser descrita como simples retorno da convocação a rascunho.
- Em eventos inativos cujo término ainda é futuro, a interface pode oferecer **Reativar Evento**. **A convocação cancelada não é reaberta automaticamente** na reativação.
- Se não houver autorização ou o evento já estiver encerrado, alguns comandos não aparecem. Em erro de gravação, leia a mensagem exibida e não repita indiscriminadamente a ação.

## 5. Preparar convocação institucional

1. Abra **Convocações** e escolha **Nova Convocação** (ou acesse a etapa a partir da criação de evento, quando encaminhado).
2. Vincule a convocação ao evento correspondente e preencha os campos disponíveis, incluindo observações quando necessárias.
3. Salve para criar um **rascunho**.
4. No item em status **RASCUNHO**, utilize **Gerenciar Funções** para configurar os destinatários por função nos fluxos institucionais compatíveis.
5. Confira as funções/destinatários e o evento antes de **Publicar**.
6. Se precisar corrigir a convocação, utilize **Editar** enquanto ela estiver em **RASCUNHO**; após publicação, a própria interface impede essa edição direta.

A publicação é uma ação distinta do salvamento do rascunho, com confirmação. Se outra pessoa modificar a convocação durante o processo, o sistema pode informar conflito de atualização; recarregue antes de tentar novamente.

**Atenção aos eventos externos:** para os fluxos **NACIONAL** e **INTERNACIONAL**, não presumir convocação por função. Os convites individuais são gerenciados nas ações específicas de participantes do evento externo, conforme permissões. Esse caminho precisa de capturas reais antes de se tornar instrução detalhada definitiva.

## 6. Acompanhar e administrar convocações

A lista de **Convocações** permite filtrar por situação (ativas, rascunho, publicada, cancelada, todas), período (futuros, passados, todos) e recortes territoriais autorizados.

| Situação/condição | Ação que pode aparecer |
|---|---|
| `RASCUNHO` com autorização | **Publicar**, **Gerenciar Funções**, **Editar**, **Cancelar** |
| `PUBLICADA` | **Acompanhar RSVP** |
| `PUBLICADA` territorial, com função DCO, antes do encerramento, e com autorização | **Sincronizar Diáconos** |
| Convocação não cancelada, com autorização | **Cancelar** |

**Sincronizar Diáconos** atualiza a distribuição de destinatários da convocação sob as condições exibidas; confira a mensagem com contagem anterior e posterior. Essa ação não fica disponível depois de encerrada a reunião.

**Acompanhar RSVP** é consulta administrativa da participação. As respostas dos membros são dadas pelas telas pessoais e seguem as regras do capítulo anterior.

Cancelar uma convocação ou um evento é uma ação relevante; revise o alvo antes de confirmar. Não prometa reabertura automática.

## 7. Criar e manter séries de recorrência

1. Abra **Séries** e selecione **+ Nova Série**.
2. Preencha título, modalidade, **frequência**, período inicial/final, horários e critérios de recorrência apresentados no formulário.
3. Indique escopo e Local/Espaço ou URL online, conforme a modalidade e as permissões.
4. Confira a prévia/validação exibida e salve.
5. Na lista, utilize os filtros de séries **ativas/inativas/todas** e de **futuras/passadas/todas**.
6. Ao editar uma série, a interface pede confirmação para aplicar a alteração no modo indicado; verifique o efeito sobre ocorrências antes de confirmar.
7. Ao **inativar**, confirme qual série será afetada. Não trate inativar como apagar histórico nem como cancelamento automático de todas as convocações já publicadas.

O filtro temporal considera a última ocorrência real da série. Um período nominal amplo pode não significar que haja reunião futura gerada.

## 8. Dúvidas e cuidados operacionais

| Situação | Orientação |
|---|---|
| Não aparece a aba Eventos/Convocações/Séries | Conferir a autorização `podeGerirAgenda` e o escopo institucional |
| Não vejo determinado evento | Revisar filtros de status, período, pessoa e território |
| Não aparece **Editar** em convocação | Apenas rascunhos podem ser editados diretamente nessa tela |
| Evento salvo, mas participantes não receberam convocação | Verificar se há convocação **PUBLICADA** ou convites nominais gerados |
| Não encontro **Sincronizar Diáconos** | Verificar status publicado, escopo territorial, função DCO, término futuro e permissão |
| Reativei evento, mas convocação continua cancelada | Reativação de evento não reabre convocação automaticamente |
| Alteração em série não refletiu como esperado | Conferir se a edição foi da ocorrência ou da série e qual modo foi confirmado |

Não compartilhe dados privados, telefones de terceiros, PIN ou links individuais de ativação em chamados. Ao solicitar suporte, informe código da tela, ação, data/horário e mensagem de erro, sem anexar informação sensível.

## 9. Pendências antes da publicação do manual definitivo

- [ ] Confirmar versão/build efetivamente publicada em produção e confrontar nomes/posições dos controles.
- [ ] Capturar telas anonimizadas de evento territorial, externo nacional/internacional, próprio, formulário, lista e confirmação de cancelamento.
- [ ] Validar com usuários de cada perfil quais operações aparecem e passam pela autorização do servidor.
- [ ] Capturar ciclo real rascunho → funções → publicação → RSVP, inclusive fluxo nominativo externo.
- [ ] Verificar as mensagens e os efeitos de edição de ocorrência/série e de inativação.
- [ ] Conferir criação rápida de Local/Espaço conforme titularidade e perfil.
- [ ] Validar terminologia com secretaria/gestores antes de distribuir aos usuários finais.

## 10. Fontes da auditoria

`apps/web/src/App.tsx`, `apps/web/src/components/eventos/EventosView.tsx`, `apps/web/src/components/convocacoes/ConvocacoesView.tsx` e `apps/web/src/components/series/SeriesView.tsx` na `main`. Complementos: `docs/08-operacao/manual-uso-acesso-cadastro.md` e `docs/08-operacao/manual-uso-minha-agenda-calendario.md`. Os protótipos Google Stitch não são evidência de funcionalidade.
