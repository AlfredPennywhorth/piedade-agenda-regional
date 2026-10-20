# Manual de Uso — Grupos de Trabalho, Membros, Funções e Vínculos

> **Rascunho M2.5, 20/10/2026, sujeito à validação do PO.** Base funcional: componentes da `main`. Confirmar versão/build e telas publicadas antes de distribuir. Nenhuma mudança funcional é proposta por este capítulo.

## 1. Quatro conceitos que não devem ser confundidos

| Cadastro | Para que serve |
|---|---|
| **Grupo de Trabalho (GT)** | Grupo institucional vinculado à **Regional**, com nome e situação ativa/inativa; os Setores participam por representantes |
| **Membro** | Pessoa cadastrada, com identificação ministerial, Casa de Oração e contato institucional |
| **Função** | Catálogo de atribuições disponíveis no sistema |
| **Vínculo funcional** | Associação entre **Membro + Função + Escopo institucional**, ativa ou inativa |

Uma pessoa pode ter mais de um vínculo; registrar um membro não o torna automaticamente integrante de todos os GTs nem cria convocação. Participação em GT e vínculo de função são conceitos relacionados, mas distintos.

## 2. Permissões e proteção dos dados

A navegação distingue capacidades efetivas:

- **Grupos de Trabalho:** a aba depende de `podeAdministrarEstrutura`.
- **Membros** e **Vínculos Funcionais:** as abas dependem de `podeAdministrarPessoas`.
- **Funções:** a aba depende de `podeAdministrarFuncoes`.

A API também valida permissão e escopo de cada escrita. Nem todo administrador territorial recebe automaticamente todas as capacidades. Caso não veja uma aba, solicite atendimento ao administrador competente, sem compartilhar sua conta.

Cadastros de membros contêm dados pessoais. Pesquise e atualize apenas dentro da finalidade institucional; não divulgue listas, carteirinhas ou celulares em grupos públicos. Não cadastre data de nascimento — esse campo foi removido do fluxo.

## 3. Grupos de Trabalho

1. Abra **Grupos de Trabalho** na área de gestão, quando autorizado.
2. Na listagem, consulte nome, escopo e situação **Ativo/Inativo**.
3. Use o filtro **Escopo** para a consulta de dados existentes; filtros de escopos históricos não significam que se possa criar novos GTs em qualquer nível.
4. Para criar, clique **+ Novo Grupo**, informe o **Nome do Grupo**, selecione a **Regional vinculada** e confira **Grupo Ativo**.
5. Confirme em **Salvar Grupo**.
6. Para atualizar um **GT já vinculado a uma Regional**, use **Editar**, revise nome, Regional e situação e salve com **Atualizar Grupo**; **Detalhes** permite consulta. **GTs históricos de Administração ou Setor** podem constar no filtro, mas **não podem ser atualizados pelo formulário atual**, nem pelo Master: a API rejeita a edição de registros sem vínculo Regional. Encaminhe tais casos para tratamento administrativo/migração fora deste fluxo; não tente alterar o escopo pela tela.

**Regra atual:** novos GTs são **exclusivamente Regionais**. Não cadastre GT subordinado a Administração ou Setor para representar participação local. A participação dos Setores ocorre por representantes; o capítulo de vínculos e a gestão específica de participantes devem manter essa distinção.

## 4. Diretório de Membros

1. Abra **Membros** (Diretório de Membros).
2. Utilize **Filtrar membros por Setor** e **Buscar membro ou Casa**, que aceita nome, código de carteirinha, nome/código da Casa de Oração.
3. Antes de cadastrar, confira se a pessoa já existe; **não crie duplicatas** por divergência de nome ou telefone.
4. Clique **+ Cadastrar Membro**.
5. Quando houver pré-cadastro ministerial, **pesquise e selecione o pré-cadastro**, depois confirme Casa de Oração, carteirinha e celular, e finalize. O nome fornecido pelo pré-cadastro fica somente para leitura nesse fluxo.
6. Se o procedimento institucional permitir **novo membro manual**, confira nome, data de ordenação, carteirinha, celular e Casa de Oração, usando a cascata Regional → Administração → Setor → Casa.
7. Salve e confira a mensagem de retorno.
8. Para cadastro existente, use **Editar**, revise e atualize apenas dados legitimamente corrigíveis.

A alteração de Regional ou Administração no formulário limpa as seleções inferiores para evitar associação incoerente. A mudança de Setor também limpa a Casa selecionada. Confira o vínculo completo antes de salvar.

**Exclusão:** a tela dispõe de ação de exclusão definitiva. A API exige ausência de **conta, convocações, vínculos manuais/legados ou outro histórico impeditivo**. **Exceção:** vínculos DCO criados automaticamente com origem `MEMBRO_AUTOMATICO` são removidos pela própria exclusão e **não bloqueiam sozinhos** a operação. Isso não autoriza apagar membro com histórico real. A confirmação é explícita; não trate esse comando como simples inativação nem o use para resolver duplicidade com histórico. Em recusa, solicite análise administrativa.

### 4.1. Pré-cadastro não é ativação de acesso

Concluir um pré-cadastro ministerial cria/regulariza o membro; isso não substitui as etapas de **geração de link de ativação e criação do PIN**. Consulte `manual-uso-acesso-cadastro.md` para a sequência administrativa de ativação, reemissão do link pendente e entrega ao titular.

## 5. Catálogo de Funções

1. Abra **Funções**, quando autorizado.
2. Consulte a lista por nome, código e situação.
3. Use o cadastro de nova função apenas quando houver atribuição institucional aprovada; preencha nome/código/descrição conforme campos e validações exibidos.
4. Confirme **Função Ativa** e utilize **Salvar Função**.
5. Para manutenção, utilize **Detalhes** ou **Editar**, alterando somente o necessário e salvando em **Atualizar Função**.

A função cadastrada representa um tipo de atribuição, **não** uma pessoa específica. **Atenção: algumas funções reservadas também concedem permissões operacionais quando há vínculo ativo no escopo aplicável:**

| Código reservado | Acesso que pode conceder |
|---|---|
| `OPERADOR_PORTARIA` | Operação de Portaria |
| `GESTOR_RELATORIOS` | Visualização/gestão de relatórios conforme escopo |
| `AUDITOR_SISTEMA` | Acesso de auditoria conforme escopo |

**Antes de criar, ativar ou alterar vínculo com esses códigos, obtenha autorização expressa do responsável institucional, confira pessoa e escopo e registre a justificativa pelo procedimento administrativo vigente.** A mesma autorização é obrigatória **antes de alterar o código de uma Função para um código reservado ou reativar uma Função reservada já cadastrada**: consulte todos os vínculos existentes (inclusive os que já estavam ativos), verifique seus membros e escopos e avalie os acessos que serão concedidos **em conjunto**. A API calcula as capacidades pelo código e pela situação **atuais** da Função: uma única alteração no catálogo pode conceder imediatamente acesso sensível a várias pessoas vinculadas, mesmo sem editar qualquer vínculo. Se houver dúvida sobre os destinatários ou a autorização, **não salve** e encaminhe para validação administrativa. Não crie funções reservadas ou cargos ministeriais artificiais para contornar permissões ou escopo de eventos nacionais/internacionais.

## 6. Vincular um Membro a uma Função

1. Abra **Vínculos Funcionais** e escolha **+ Novo Vínculo**.
2. Selecione o **Membro** e a **Função**. A criação normalmente apresenta funções ativas; ao editar um vínculo existente, sua função inativa pode continuar sendo mostrada para preservar o registro histórico.
3. Escolha **Tipo de Escopo Institucional**: Regional, Administração, Setor, Casa de Oração ou Grupo de Trabalho.
4. No seletor correspondente, informe a unidade/GT concreta. **Uma escolha de escopo exige a identificação da unidade**, não apenas o tipo.
5. Confira a situação **Ativo** e o potencial de concessão de acesso da função (seção 5) **antes de salvar**. Se for função reservada, confirme a autorização institucional e o escopo.
6. Para corrigir vínculo existente, abra **Editar**, confira pessoa, função, escopo e situação e clique **Atualizar Vínculo**.

### 6.1. Consultar vínculos pela Função

A tela atual organiza a lista **por Função**, com cartões expansíveis que mostram quantidade de **membros distintos**, vínculos e escopos. Assim, um membro pode aparecer em mais de uma atribuição ou em mais de um escopo.

Os filtros disponíveis incluem:

- **Buscar função ou membro**, por nome, função ou local.
- **Situação**: ativos, inativos ou todos.
- **Abrangência do vínculo**: Regional, Administração, Setor, Casa ou GT.
- **Setor → Casa de Oração** em filtro dependente.
- **Grupo de Trabalho**, quando dados de participações estiverem disponíveis.

Se aparecer o alerta de **participações dos GTs indisponíveis**, a listagem de vínculos continua utilizável, mas o filtro por GT é desabilitado. Não interprete a ausência desse filtro como exclusão das participações.

## 7. Relação com convocações

Uma convocação territorial pode selecionar destinatários por função e escopo. Para a lista resultar corretamente:

1. O membro precisa estar cadastrado e corretamente vinculado à sua Casa.
2. A função e o vínculo institucional devem refletir a atribuição real.
3. O organizador deve conferir a função selecionada no rascunho antes da publicação.
4. **Convites nominais externos** seguem fluxo diferente, descrito nos capítulos M2.2 e M2.3.

**Impacto imediato em convocações já publicadas:** criar, reativar ou editar um vínculo que fique **ativo** pode incluir imediatamente o membro como destinatário de convocações em status **PUBLICADA** cujo evento ainda não terminou. A sincronização também acontece quando o fluxo de cadastro manual ou de finalização de pré-cadastro cria automaticamente o vínculo DCO, **mesmo antes da ativação da conta de acesso**. Por outro lado, **inativar** um vínculo não remove retroativamente destinatários já materializados no retrato (snapshot) da convocação. Por isso, antes e depois de qualquer inclusão, edição ou inativação, a secretaria deve conferir **convocações vigentes e futuras**, destinatários e RSVP, além do escopo autorizado.

Não use cadastro fictício de função para forçar inclusão de convidado externo. O processo de revisão de destinatários de convocação publicada deve seguir a governança institucional.

## 8. Problemas frequentes

| Situação | Verificação |
|---|---|
| Membro não localizado | Setor filtrado, grafia do nome, carteirinha, Casa e existência de pré-cadastro |
| Casa não aparece no cadastro | Revisar a cascata Regional → Administração → Setor |
| Membro criado, mas ainda sem acesso | O fluxo de ativação é separado do cadastro |
| Função não está disponível no novo vínculo | Verificar se ela está ativa e se o perfil pode administrá-la |
| Vínculo incorreto | Conferir pessoa, função e unidade antes de atualizar/inativar |
| Filtro por GT desabilitado | Ler alerta de indisponibilidade temporária das participações |
| Exclusão de membro recusada | Verificar conta, convocação, vínculos **manuais/legados** e histórico; DCO exclusivamente automático não bloqueia por si só |

## 9. Pendências para homologação editorial

- [ ] Confirmar versão/build publicado e capturar telas reais com dados anonimizados.
- [ ] Validar limites exatos de edição por escopo e perfil na API de Membros, Funções e Vínculos.
- [ ] Verificar em produção os rótulos de criação/edição de Funções e o tratamento de função-base **Diácono Casa de Oração**.
- [ ] Validar com secretaria as condições de cadastro manual e origem/atualização de pré-cadastro ministerial.
- [ ] Conferir em perfis autorizados os efeitos de inclusão, reativação, edição e inativação de vínculo/DCO sobre **convocações já publicadas** e futuras, preservando o snapshot histórico.
- [ ] Documentar em subcapítulo próprio as telas de **participações em GT**, após localização e auditoria dos respectivos controles.
- [ ] Evitar incluir credenciais ou dados pessoais nas capturas do manual.

## 10. Fontes

Componentes auditados na `main`: `apps/web/src/App.tsx`, `apps/web/src/components/grupos-trabalho/GruposTrabalhoView.tsx`, `apps/web/src/components/membros/MembrosView.tsx`, `apps/web/src/components/funcoes/FuncoesView.tsx` e `apps/web/src/components/vinculos-funcionais/VinculosFuncionaisView.tsx`.

Complementos: `docs/08-operacao/manual-uso-acesso-cadastro.md`, `docs/08-operacao/manual-uso-gestao-eventos-convocacoes-series.md`. Protótipos Stitch são referências visuais, não fontes das regras.
