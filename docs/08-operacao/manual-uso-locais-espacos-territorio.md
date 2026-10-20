# Manual de Uso — Locais, Espaços e Estrutura Territorial

> **Rascunho para validação do PO — 20/10/2026 (Etapa M2.4).** Descreve telas e ações identificadas nos componentes da `main`. Confirmar build publicado, perfis autorizados e capturas reais antes de distribuir como manual definitivo. Este documento não modifica cadastros existentes.

## 1. Para que servem esses cadastros

A Agenda separa **estrutura territorial** e **locais de realização** de reuniões.

- **Regional → Administração → Setor → Casa de Oração**: hierarquia institucional usada em vínculos, filtros, responsabilidades e escopos territoriais.
- **Local**: endereço físico utilizado no agendamento, que pode representar uma Casa de Oração ou outro lugar de reunião.
- **Espaço**: ambiente pertencente a um Local, como salão ou sala, com nome, descrição, capacidade e situação ativa/inativa.
- **Grupo de Trabalho (GT)**: vínculo organizacional regional, **não é** um nível entre Setor e Casa de Oração.

Um Local com o nome de uma Casa de Oração não substitui automaticamente o cadastro institucional da Casa. Tampouco cadastrar um Espaço altera a hierarquia territorial.

## 2. Permissões e cautelas

As permissões são diferentes para **Locais/Espaços** e para **Estrutura Territorial**; o servidor valida cada gravação.

| Recurso | Membro comum ativo | Gestor territorial autorizado | Master |
|---|---|---|---|
| Consultar Locais | Pode acessar a tela | Pode acessar | Pode acessar |
| Criar Local institucional | Apenas no **Setor da sua Casa de Oração** | Conforme seu escopo autorizado | Conforme autorização global |
| Criar Espaço institucional | Apenas em **Local ativo criado pelo próprio membro** | Conforme seu escopo autorizado | Conforme autorização global |
| Editar ou inativar Local/Espaço | **Não permitido**, mesmo se o botão estiver visível (API retorna 403) | Permitido dentro dos limites de seu escopo | Conforme autorização global |
| Gravar estrutura territorial | Não permitido | Somente perfil/escopo descrito na seção 5 | Permitido |

A tela de **Regionais** tem modo de consulta sem edição quando `podeEditar` é falso. Já a tela de **Locais/Espaços** pode exibir **Editar** para um membro comum mesmo quando a API impede a gravação; portanto, **não oriente o membro comum a usar Editar ou inativar**. Nunca use a conta de outra pessoa para contornar restrições.

Antes de alterar cadastro institucional em produção, confirme o nome oficial, código, vínculo superior e efeitos sobre registros existentes. **Não crie duplicatas** para contornar erro de relacionamento.

## 3. Consultar e administrar Locais

1. Abra **Locais** na navegação do sistema. A tela pode ser acessível também a membros comuns ativos, com operações limitadas conforme a seção 2.
2. Utilize **Pesquisar locais** para buscar por **nome, endereço, bairro, cidade, UF ou CEP**. O filtro também reconhece dígitos de CEP, independentemente de máscara.
3. Observe a lista com nome, endereço, cidade/UF e indicação **Ativo** ou **Inativo**.
4. Clique em **Ver** para conferir detalhes cadastrais, referência, CEP, coordenadas e links disponíveis para **Google Maps** ou **Waze**.
5. **Somente se possuir permissão de gestão territorial aplicável**, selecione **Editar**, revise os dados e clique em **Salvar Local**. Para membro comum, a presença do botão não significa autorização de alteração.

### 3.1. Cadastrar Local

1. Clique em **+ Novo Local**.
2. Selecione o escopo de cadastro dentre os **escopos autorizados** apresentados. Para membro comum ativo, a criação de Local institucional é limitada ao **Setor da sua Casa de Oração**. A lista é carregada do sistema; não invente escopo alternativo. **Confira cuidadosamente: após classificar um Local, não será possível alterar seu escopo pelo formulário de edição.** A API rejeita alterações de `escopoTipo`/`escopoId` para Local já classificado. Apenas o Master pode classificar Local legado que ainda esteja sem escopo. Se o escopo foi escolhido incorretamente, interrompa a operação e solicite tratamento administrativo; não duplique o Local.
3. Informe o nome e o endereço nos campos solicitados (logradouro, número, bairro, cidade, UF e **CEP**, quando aplicável).
4. Ao consultar o CEP, aguarde o resultado. Se não for encontrado ou o serviço estiver indisponível, a interface permite preencher o endereço manualmente.
5. Informe complemento, referência e URLs de navegação quando houver dados conferidos; não invente coordenadas ou links.
6. Confira o seletor **Local Ativo** e clique em **Salvar Local**.
7. Aguarde a confirmação; em erro, corrija o campo ou solicite suporte, evitando cadastro duplicado.

A interface impede o salvamento enquanto uma consulta de CEP ainda está em andamento. O preenchimento automático do CEP deve ser conferido com o endereço real, inclusive número e complemento.

**Local institucional x particular:** alguns fluxos de Eventos permitem criação rápida de locais particulares ou institucionais. A propriedade e o escopo autorizados são diferentes; consulte o capítulo de Eventos e não use um Local particular para representar indevidamente um espaço institucional.

### 3.2. Atualizar situação do Local

Na edição autorizada, **Local Ativo** registra a situação do cadastro, preservando o histórico. **Limitação atual importante:** inativar um **Local** não impede, por si só, novos agendamentos: ele ainda pode aparecer nos seletores de Eventos/Séries e a API não rejeita seu uso. Portanto, não trate a inativação do Local como bloqueio efetivo de reservas; confirme o procedimento com o gestor e registre a necessidade de correção funcional em etapa própria. Em contraste, um **Espaço inativo** deixa de ser oferecido para novos Eventos/Séries e seu novo uso é rejeitado pela API, permanecendo apenas as referências de registros existentes. **Membro comum não pode alterar esses estados**.

## 4. Cadastrar e editar Espaços de um Local

1. Na lista de Locais, clique em **Espaços** no local correto.
2. A janela **Espaços do Local** lista os ambientes com nome, capacidade e status.
3. Para adicionar, informe **Nome do Espaço** (obrigatório), capacidade e descrição quando aplicável.
4. Marque ou desmarque **Espaço ativo** conforme a situação verificada.
5. Clique em **+ Adicionar Espaço** e aguarde a resposta.
6. **Somente gestores autorizados** podem modificar um Espaço existente: escolha **Editar**, atualize e clique em **Atualizar Espaço**. Para membro comum, a tentativa é recusada pela API mesmo que o comando permaneça visível.
7. Se necessário, use **Cancelar edição** para limpar a seleção de edição sem apagar o Espaço existente.

A capacidade é opcional na interface; se for informada, deve fazer sentido para o ambiente. Espaços estão vinculados a um Local específico, portanto confira o cabeçalho antes de salvar. Uma mudança de status não deve ser apresentada como remoção física ou exclusão de histórico.

## 5. Estrutura territorial — ordem e vínculos

A estrutura deve ser cadastrada de cima para baixo:

1. **Regional**: unidade institucional superior.
2. **Administração**: vinculada à Regional.
3. **Setor**: vinculado a uma Administração da Regional selecionada.
4. **Casa de Oração**: vinculada ao Setor.

**Quem pode manter essa estrutura:** na implementação atual, apenas **Master** e **ADMINISTRADOR_SISTEMA com escopo Regional** recebem a capacidade `podeAdministrarEstrutura`. O administrador de escopo Regional pode gravar **Administrações, Setores e Casas apenas dentro de sua Regional**; somente o **Master** pode criar ou alterar **Regionais**. Administradores técnicos limitados a Administração, Setor ou Casa não recebem essas telas de gestão nem passam pela autorização de escrita.

Os formulários autorizados têm campos de nome, código quando previsto, vínculo superior e indicador **Ativo**. Os dados devem seguir os registros institucionais oficiais; o manual não autoriza criar uma Regional ou Setor fictício para satisfazer o formulário.

### 5.1. Regionais

Na tela **Gestão Territorial — Regionais**, consulte a listagem e **Detalhes**. **Apenas para Master**, use **+ Nova Regional** ou **Editar**. Confira nome, eventual código e situação ativa/inativa antes de **Salvar Regional** ou **Atualizar Regional**.

**Atenção:** essa operação é particularmente sensível. O fato de existir o botão não autoriza implantação em outra Regional: essa iniciativa está registrada separadamente como **dívida pós-implantação de São Paulo** (issue #330), com banco D1 isolado e cargas próprias.

### 5.2. Administrações

Na tela **Gestão Territorial — Administrações**, utilize **Filtrar por Regional**. Se autorizado como Master ou administrador de sistema com escopo Regional, escolha **+ Nova Administração**, selecione a Regional correta e informe os dados exigidos. Na listagem, **Detalhes** e **Editar** permitem conferir/atualizar o vínculo e a situação, desde que autorizados.

### 5.3. Setores

Na tela **Gestão Territorial — Setores**, filtre primeiro por **Regional** e então por **Administração**. Ao trocar a Regional, o filtro de Administração é limpo para evitar associação incorreta.

Se autorizado como Master ou administrador de sistema Regional, em **+ Novo Setor** selecione a Regional e uma Administração **pertencente a ela**, depois informe os demais campos. Para registros existentes, use **Detalhes** ou **Editar**. O vínculo administrativo é obrigatório para um Setor válido.

### 5.4. Casas de Oração

Na tela de Casas de Oração, utilize **Filtrar por Setor**. Se autorizado como Master ou administrador de sistema Regional, selecione **+ Nova Casa de Oração**, escolha o **Setor** correto e preencha os dados institucionais. O formulário também permite editar registros existentes e sua situação ativa/inativa, mediante autorização.

Uma Casa de Oração pertence a um Setor. A pesquisa por nome semelhante não substitui a conferência do vínculo e do código institucional.

## 6. Conciliação e riscos comuns

| Situação | Verificação recomendada |
|---|---|
| Local não encontrado | Buscar por nome, endereço ou CEP; conferir acesso e atualização da lista |
| CEP não reconhecido | Preencher endereço manualmente e verificar com fonte institucional |
| Espaço não aparece | Conferir se o Local selecionado é o correto e se o Espaço está cadastrado |
| Administração não aparece no Setor | Conferir a Regional escolhida; a lista é dependente dela |
| Casa vinculada ao Setor errado | Parar e conferir o registro antes de salvar; não criar nova Casa para contornar |
| Botão existe, mas gravação é recusada | Conferir permissão, escopo, validações e mensagem retornada pelo servidor |
| Registro inativo | Não presumir exclusão; verificar impacto sobre agendamentos e cadastros dependentes |
| Há duas denominações parecidas | Comparar código e vínculo oficial antes de criar ou alterar |

## 7. Pendências antes da publicação definitiva

- [ ] Confirmar códigos das telas e versão/build realmente publicada na Cloudflare.
- [ ] Capturar telas anonimizadas dos filtros, cadastros, detalhes e estados de erro.
- [ ] Testar com perfis Master, administradores de cada nível e consulta sem permissão de edição.
- [ ] Validar regras de inativação com dados vinculados a eventos e Locais/Espaços, sem modificar produção para testar.
- [ ] Confirmar regras específicas de criação rápida de Local/Espaço institucional e particular.
- [ ] Validar terminologia territorial com a secretaria e responsáveis pelos cadastros.
- [ ] Preparar capítulo separado para GTs, membros, vínculos ministeriais e gestão de acessos, sem ampliar M2.4 indevidamente.

## 8. Fontes da auditoria

`apps/web/src/components/locais/LocaisView.tsx`, `apps/web/src/components/regionais/RegionaisView.tsx`, `apps/web/src/components/administracoes/AdministracoesView.tsx`, `apps/web/src/components/setores/SetoresView.tsx` e `apps/web/src/components/casas/CasasView.tsx`, consultados na `main`.

Capítulos relacionados: `docs/08-operacao/manual-uso-acesso-cadastro.md`, `docs/08-operacao/manual-uso-minha-agenda-calendario.md` e `docs/08-operacao/manual-uso-gestao-eventos-convocacoes-series.md`. Os protótipos Stitch não são a fonte das regras funcionais.
