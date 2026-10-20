# Manual de Uso — Minha Agenda, Calendário e respostas a convocações

> **Rascunho para validação do PO — 20/10/2026 (Etapa M2.2).** Documenta o comportamento encontrado na branch `main` durante a auditoria, não um novo desenho de tela. Conferir a versão/build publicados e capturas reais antes de distribuir como manual definitivo. Complementa `manual-uso-acesso-cadastro.md`.

## 1. Onde encontrar seus compromissos

Depois de entrar na Agenda Regional São Paulo com seu celular e PIN, utilize a navegação inferior:

- **Minha Agenda** — `AGD-MOB-001`: compromissos futuros associados ao usuário, com informações de convocação, respostas e eventuais alertas de conflito.
- **Calendário** — `AGD-MOB-002`: visualização mensal, com dias que contêm eventos identificados por pontos coloridos. Permite consultar eventos de uma data.
- **Mais → Meu Cadastro** — `AGD-SHR-001`: consulta dos dados institucionais e manutenção do celular/PIN.

A opção **Eventos**, assim como **Séries**, **Convocações** e **Locais** administrativos, depende da capacidade `podeGerirAgenda`. Se não aparecer, isso não significa que a pessoa deixou de ter acesso a **Minha Agenda** ou ao **Calendário**. O menu exibido depende das permissões efetivas da conta.

## 2. Consultar Minha Agenda

1. Na barra inferior, selecione **Minha Agenda**.
2. Observe os cartões de eventos futuros relacionados ao seu acesso.
3. Toque no cartão de um compromisso para abrir seus **detalhes**.
4. Confira título, data, horário e demais informações que estiverem disponíveis para o evento.
5. Em compromissos presenciais ou híbridos com Local cadastrado, os detalhes podem apresentar endereço e links para **Google Maps** ou **Waze**.
6. Feche os detalhes para voltar à relação de compromissos.

A mensagem **Você não possui eventos futuros agendados** significa que a consulta não encontrou itens futuros para a sua agenda naquele momento. Ela não comprova que a instituição não tenha reuniões em geral. Se você esperava uma convocação, procure o organizador ou a secretaria para confirmar o vínculo com seu cadastro.

### 2.1. Cores e avisos

A tela apresenta uma legenda de cores por escopo do evento. As cores ajudam a diferenciar categorias; não significam confirmação de presença, prioridade ou autorização administrativa.

Alguns compromissos exibem avisos de **conflito de horário** ou de compromissos **próximos**, quando o sistema identifica sobreposição ou pequena janela de transição. Leia a descrição antes de tomar qualquer decisão.

Quando o botão **Priorizar este compromisso** estiver disponível, ele permite indicar uma prioridade para o tratamento de conflitos na sua agenda. **Priorizar não cancela automaticamente outro evento, não altera a convocação de terceiros e não garante que todos os conflitos sejam resolvidos**. Verifique os avisos e os demais compromissos.

## 3. Consultar o Calendário

1. Selecione **Calendário** na navegação inferior.
2. Use as setas laterais para alternar entre os meses.
3. Os dias com eventos exibem pontos coloridos, associados à legenda por escopo.
4. Selecione um dia para ver a lista **Eventos em DD/MM/AAAA**.
5. Toque no cartão do evento desejado para abrir os detalhes; a resposta à convocação, quando permitida, também pode ser feita ali.
6. Caso o dia não contenha itens, a tela mostra **Nenhum evento agendado para este dia**.

As datas do calendário são organizadas pelo dia operacional de São Paulo. Após responder a um convite, a lista e os conflitos podem ser recalculados. Se aparecer um aviso de falha ao atualizar os conflitos, **não responda novamente de imediato**: a resposta pode já ter sido salva. Recarregue o calendário e confira o status.

## 4. Responder à convocação pela Minha Agenda ou Calendário

O membro convocado normalmente pode responder pelo painel **Sua Participação**, presente nos detalhes de um evento **não pessoal** quando existe um destinatário de convocação vinculado à sua conta.

### 4.1. Confirmar participação

1. Abra o cartão do compromisso em **Minha Agenda** ou **Calendário**.
2. Localize **Sua Participação**.
3. Selecione **✓ Vou participar**.
4. Se o evento solicitar período de participação, escolha pelo menos uma opção disponível entre **Manhã**, **Tarde** e **Noite**.
5. Quando exibido, selecione **Confirmar Participação** e aguarde a gravação.
6. Verifique a indicação **Confirmado**.

Os períodos são opções condicionais: nem toda convocação solicita essa informação.

### 4.2. Informar que não poderá participar

1. Abra os detalhes do evento.
2. Em **Sua Participação**, selecione **✗ Não vou participar**.
3. Informe a **justificativa da ausência**, que é obrigatória nesse fluxo.
4. Selecione **Confirmar Ausência** e confira o estado apresentado.

### 4.3. Ainda não sabe se poderá comparecer

Selecione **? Não sei ainda**, quando disponível. A resposta ficará pendente de definição. Antes do início do evento, volte ao mesmo painel para atualizar a informação.

**Atenção:** depois do início do evento, a interface informa **Resposta bloqueada após início do evento**. Não prometa alteração de RSVP após esse horário; eventuais correções administrativas devem seguir as regras e autorizações do gestor.

### 4.4. Reconfirmação após alterações

Se aparecer o aviso **Reconfirmar**, uma alteração relevante no evento exige uma nova manifestação. A resposta anterior pode ter sido preservada para referência, mas não substitui a reconfirmação solicitada. Releia data, horário e local e responda novamente.

## 5. Convites nominais para eventos externos

Para certos eventos de abrangência **NACIONAL** ou **INTERNACIONAL**, os detalhes podem exibir um convite nominal. **Confirmar** e **Recusar** só aparecem enquanto o convite estiver com status **CONVIDADO** (pendente) e **antes do início do evento**. Esse fluxo é diferente do RSVP por função/convocação descrito acima.

1. Abra o cartão do evento externo e confira o destino informado (cidade/UF ou país/cidade), a data, o horário e os demais detalhes.
2. Se o convite estiver **pendente** e os comandos estiverem disponíveis, selecione **Confirmar** ou **Recusar** conforme sua decisão.
3. Aguarde a resposta do sistema e confira o novo status antes de fechar os detalhes.

**Importante:** após confirmar ou recusar o convite nominal, **não é possível mudar a decisão pelos mesmos botões**. O sistema só aceita a resposta enquanto o convite está pendente. Se precisar corrigir uma decisão já registrada, procure o organizador/administrador; o manual não deve prometer uma alteração direta pelo convidado.

Uma participação com status **ATRIBUIDO** é apresentada como **Atribuição individual**, **sem botões de Confirmar ou Recusar**. Após o início do evento, esses comandos também deixam de estar disponíveis. Portanto, a ausência dos botões não indica necessariamente erro.

Não confunda **convite nominal externo** com criação de um evento pessoal. Os dois tipos podem aparecer na agenda, mas possuem regras diferentes.

## 6. Eventos próprios e administração de eventos

Um evento identificado como **Próprio** aparece nos detalhes com a informação **Evento Próprio — já incluído na sua agenda**. Esse tipo não utiliza o painel comum de RSVP do destinatário de convocação.

A criação e a edição de eventos são operações distintas da consulta da agenda. No frontend atual, a aba administrativa **Eventos** (`AGD-ADM-001`) aparece apenas para contas com `podeGerirAgenda`, com permissões adicionais verificadas pelo servidor para ações e registros específicos.

**Não orientar todos os usuários comuns a abrir Eventos para criar compromissos.** A possibilidade de criar eventos próprios e seus escopos deve ser descrita no capítulo de gestão de eventos após a conferência das permissões por perfil e das condições institucionais.

## 7. Problemas frequentes

| Situação | O que conferir |
|---|---|
| Minha Agenda aparece vazia | Verifique se há compromissos futuros destinados ao seu cadastro; confirme com a secretaria quando esperar um convite |
| Evento não aparece no dia esperado | Confira o mês, a data, o fuso operacional e a publicação/vinculação do evento |
| A aba Eventos ou Convocações não aparece | Seu perfil pode não possuir `podeGerirAgenda`; isso não impede a consulta de Minha Agenda |
| Convocação não oferece botão de resposta | O evento pode já ter começado, ser pessoal ou não conter destinatário RSVP vinculado |
| Resposta exige período | Marque pelo menos um período disponível antes de confirmar |
| Não consigo confirmar ausência | Preencha a justificativa obrigatória |
| Apareceu **Reconfirmar** | Revise a alteração do evento e envie uma nova resposta |
| Aviso de conflito continua aparecendo | Consulte os detalhes; priorização não implica eliminação completa dos conflitos |
| Erro ao atualizar calendário após responder | Recarregue e verifique o estado antes de reenviar a resposta |

## 8. Segurança e suporte

- Não encaminhe capturas com dados pessoais, QR Code individual ou detalhes privados de outras pessoas.
- Ao solicitar suporte, informe **código da tela**, data do evento, ação realizada e mensagem exibida; evite enviar PIN ou tokens.
- Não interprete a ausência de um botão como autorização para usar a conta de outra pessoa.
- A resposta RSVP só deve ser considerada concluída após o retorno da aplicação. Em erro de atualização posterior, confira o estado novamente.

## 9. Pendências para homologação e publicação

- [ ] Capturar telas reais de `AGD-MOB-001` e `AGD-MOB-002`, incluindo evento com/sem RSVP, conflitos, reconfirmação e convite nominal externo, sem dados identificáveis.
- [ ] Confirmar versão/build da produção com o valor exibido na aplicação.
- [ ] Validar com membro comum o caminho das respostas e com gestor a apresentação dos eventos próprios.
- [ ] Confirmar com a API e os perfis de teste as condições de visibilidade e edição de eventos pessoais para o capítulo administrativo.
- [ ] Revisar linguagem e botões após eventuais atualizações de produção; protótipos Stitch não são fonte funcional.

## 10. Fontes

Componentes auditados na `main`: `apps/web/src/App.tsx`, `apps/web/src/components/layout/MainLayout.tsx`, `apps/web/src/components/agenda/AgendaView.tsx`, `apps/web/src/components/agenda/EventoDetalhe.tsx`, `apps/web/src/components/calendario/CalendarioView.tsx` e `apps/web/src/components/eventos/EventosView.tsx`.

Códigos: `docs/inventario-codigos-telas.md`. Capítulo anterior: `docs/08-operacao/manual-uso-acesso-cadastro.md`.
