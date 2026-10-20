# Manual de Uso — Portaria, Recepção e Controle de Presença (M2.7)

> **Rascunho para validação do PO — 20/10/2026.** Base: interface `PortariaView.tsx`, rotas de check-in e serviço de fechamento na `develop`. Antes de distribuir, conferir build e telas em produção e validar com usuários autorizados. **Somente documentação; não altera permissões nem o funcionamento do sistema.**

## 1. Objetivo e perfis

A **Operação de Portaria** permite registrar a presença de membros convocados, validar convidados, corrigir registros indevidos e encaminhar o encerramento de cada reunião. O acesso é condicionado à autorização **para o evento específico**. Ter um vínculo ou perfil em outro escopo não garante acesso à Portaria selecionada.

A operação de presença e a confirmação definitiva do fechamento podem exigir **responsáveis diferentes**. O sistema distingue `podeOperarPortaria` e `podeConfirmarFechamento`; não compartilhe conta ou credencial para contornar a separação.

Funções com código reservado `OPERADOR_PORTARIA` podem conferir capacidades operacionais no escopo aplicável. Consulte o capítulo M2.5 para cuidados com concessões e revogações de funções reservadas.

## 2. Selecionar o evento

1. Abra **Operação de Portaria**, quando a opção estiver disponível.
2. Na seção **1. Selecionar Evento**, escolha a reunião autorizada.
3. Confira a identificação do evento e seu estado de Portaria antes de registrar presenças.
4. Se o evento deixar de estar disponível ou houver erro de autorização, interrompa a operação e consulte o gestor.

A lista corresponde aos eventos que a API disponibiliza ao operador. Uma Portaria **FECHADA** não deve ser utilizada para novos check-ins sem reabertura autorizada. A interface pode atualizar participantes, convidados e estado do fechamento durante a operação.

## 3. Confirmar presença por QR Code

1. Na seção **2. Check-in por QR Code**, receba do participante o QR correspondente à sua convocação.
2. Utilize o campo de leitura do QR, conforme o dispositivo disponibilizado, e escolha **Confirmar QR**.
3. Aguarde a mensagem de sucesso e confira a atualização da lista de participantes.
4. Quando o sistema informar presença já registrada ou QR inválido, **não crie um segundo registro manual para contornar o retorno**. Identifique a situação e procure o responsável.

O QR está associado ao destinatário de uma convocação publicada. O sistema verifica se o operador está autorizado no escopo do evento e se já existe presença ativa para o membro. QR e identificação de presença não devem ser publicados em grupos ou compartilhados com terceiros.

## 4. Registrar presença manualmente

1. Utilize a lista de participantes do evento e a busca **Buscar participante por nome ou Casa de Oração**.
2. Confira a pessoa, a Casa de Oração e o evento selecionado.
3. Acione a opção de check-in manual disponível para o participante correspondente.
4. Aguarde a confirmação e confira o registro na lista.

O check-in manual usa o vínculo do destinatário com a convocação; não é um formulário genérico para criar membros ou convidados. Se a pessoa não consta da listagem, verifique o evento e a convocação antes de registrar qualquer informação.

## 5. Convidados não cadastrados

A seção **3. Convidados não cadastrados** oferece um fluxo diferente do check-in de membros convocados.

1. Se o evento e sua autorização permitirem, escolha **Gerar QR para convidados**.
2. Disponibilize o QR de autocadastro ao convidado ou utilize **Copiar link** quando necessário, somente pelos canais destinados à reunião.
3. Aguarde a atualização da relação de convidados.
4. Confira a identificação apresentada e acione **Validar presença** somente após confirmar o comparecimento.

**Autocadastro não significa presença validada.** A relação diferencia convidados **PENDENTE** e **VALIDADO**. Não valide antecipadamente uma pessoa apenas porque ela se cadastrou, e não exponha dados dos convidados fora da finalidade institucional.

## 6. Retificar presença incorreta

Uma presença registrada indevidamente deve ser corrigida pelo fluxo de auditoria, e não pela criação de novo check-in compensatório.

1. Localize o participante e a presença que precisam de correção.
2. Use **Retificar check-in**.
3. Informe o motivo solicitado no modal **Retificar Check-in**.
4. Revise a identificação e escolha **Confirmar retificação**.
5. Confira o resultado antes de tentar novo registro válido, quando cabível.

A API mantém a distinção entre check-in **ATIVO** e **RETIFICADO** e registra a operação para auditoria. Se a presença já tiver sido retificada, o sistema pode rejeitar a repetição. Respeite a política de acesso ao evento e não altere presença de outra reunião.

## 7. Encerramento da Portaria

O encerramento envolve **solicitação** e **confirmação**:

1. O operador autorizado aciona **Solicitar encerramento** e confirma a intenção.
2. A Portaria **permanece aberta** após a solicitação, até a confirmação do gestor da reunião.
3. O responsável autorizado utiliza **Confirmar encerramento**, após conferir a relação de presentes, ausentes e convidados.
4. A confirmação definitiva consolida os registros e revoga os acessos temporários vinculados à operação.

**Não confunda solicitação com fechamento efetivo.** Solicitar não é autorização para abandonar a conferência de participantes; o gestor deve validar o resultado antes de confirmar.

## 8. Reabertura excepcional

Quando a Portaria estiver encerrada, o gestor autorizado pode visualizar **Reabrir Portaria**, conforme as permissões e o estado do evento.

1. Confirme que há necessidade de correção excepcional.
2. Acione **Reabrir Portaria**.
3. Informe **motivo entre 5 e 200 caracteres**, conforme exigido pela interface.
4. Confira a mensagem de sucesso e a situação do evento.

**Reabrir não restaura as credenciais temporárias antigas**, que permanecem revogadas. O gestor deverá providenciar nova habilitação dos porteiros quando necessária. A reabertura e a correção posterior devem ter justificativa institucional.

## 9. Dados finais e conferência

O serviço de fechamento compõe um retrato com membros convocados e convidados do evento. Para os membros, diferencia **presente** e **ausente**; para convidados, diferencia **validado/presente** e **pendente**. Também registra modalidade e horário de presença quando disponíveis.

Antes de confirmar fechamento, confira especialmente divergências entre convocados e presentes, check-ins duplicados comunicados pela interface, convidados cadastrados mas não validados e retificações efetuadas.

Este capítulo não substitui o módulo específico de relatórios nem promete exportação que não esteja disponível na interface.

## 10. Problemas frequentes

| Ocorrência | Providência |
|---|---|
| Evento não aparece | Conferir autorização de Portaria, escopo e estado da reunião |
| QR não aceito | Conferir se pertence ao destinatário de convocação publicada e ao evento correto |
| Presença já registrada | Conferir lista, evitar duplicidade e retificar somente quando necessário |
| Participante não encontrado | Verificar filtros, Casa e convocação; não cadastrar ficticiamente |
| Convidado cadastrado sem presença | Validar presencialmente pela opção **Validar presença** |
| Encerramento solicitado, mas Portaria aberta | Aguardar **Confirmar encerramento** pelo gestor |
| Portaria encerrada exige correção | Solicitar reabertura excepcional ao responsável autorizado |
| Porteiro perdeu acesso após reabertura | Acesso temporário anterior foi revogado; solicitar nova habilitação |

## 11. Pendências para homologação editorial

- [ ] Conferir nomes de botões e telas em build efetivamente publicado.
- [ ] Validar com porteiro e gestor os limites de acesso e o fluxo completo de fechamento.
- [ ] Testar em homologação leitura QR, presença manual, duplicidade e retificação, com registros fictícios.
- [ ] Verificar o fluxo público de autocadastro de convidados e proteção de dados.
- [ ] Confirmar como o gestor consulta o retrato consolidado de presença e quais relatórios estão disponíveis.
- [ ] Obter capturas anonimizadas para a versão final do manual.

## 12. Fontes técnicas

- `apps/web/src/components/portaria/PortariaView.tsx`
- `apps/worker/src/routes/checkin.ts`
- `apps/worker/src/services/portaria-fechamento.ts`
- `apps/worker/src/security/permissoes.ts`

As regras devem ser conferidas com a API correspondente antes da publicação editorial.
