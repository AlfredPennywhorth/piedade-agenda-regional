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

Os menus e as opções disponíveis variam segundo o perfil e o escopo autorizado. O Master e os administradores de níveis distintos não têm necessariamente as mesmas atribuições. O servidor confere autorização para cada operação.

- **Consultar** um cadastro não significa poder **alterá-lo**.
- Na tela de Regionais, a interface oferece explicitamente modo de **consulta** sem ações de cadastro/edição quando `podeEditar` é falso.
- Em outras telas administrativas, um botão pode estar presente, mas uma operação ainda pode ser bloqueada pelo servidor.
- Nunca use o acesso de outra pessoa para contornar uma restrição.

Antes de alterar cadastro institucional em produção, confirme o nome oficial, código, vínculo superior e efeitos sobre registros existentes. **Não crie duplicatas** para contornar erro de relacionamento.

## 3. Consultar e administrar Locais

1. No menu administrativo, abra **Locais** quando disponível.
2. Utilize **Pesquisar locais** para buscar por **nome, endereço, bairro, cidade, UF ou CEP**. O filtro também reconhece dígitos de CEP, independentemente de máscara.
3. Observe a lista com nome, endereço, cidade/UF e indicação **Ativo** ou **Inativo**.
4. Clique em **Ver** para conferir detalhes cadastrais, referência, CEP, coordenadas e links disponíveis para **Google Maps** ou **Waze**.
5. Para manter dados, selecione **Editar**, revise-os e clique em **Salvar Local**, desde que tenha autorização.

### 3.1. Cadastrar Local

1. Clique em **+ Novo Local**.
2. Selecione o escopo de cadastro dentre os **escopos autorizados** apresentados. A lista é carregada do sistema; não invente escopo alternativo.
3. Informe o nome e o endereço nos campos solicitados (logradouro, número, bairro, cidade, UF e **CEP**, quando aplicável).
4. Ao consultar o CEP, aguarde o resultado. Se não for encontrado ou o serviço estiver indisponível, a interface permite preencher o endereço manualmente.
5. Informe complemento, referência e URLs de navegação quando houver dados conferidos; não invente coordenadas ou links.
6. Confira o seletor **Local Ativo** e clique em **Salvar Local**.
7. Aguarde a confirmação; em erro, corrija o campo ou solicite suporte, evitando cadastro duplicado.

A interface impede o salvamento enquanto uma consulta de CEP ainda está em andamento. O preenchimento automático do CEP deve ser conferido com o endereço real, inclusive número e complemento.

**Local institucional x particular:** alguns fluxos de Eventos permitem criação rápida de locais particulares ou institucionais. A propriedade e o escopo autorizados são diferentes; consulte o capítulo de Eventos e não use um Local particular para representar indevidamente um espaço institucional.

### 3.2. Atualizar situação do Local

Na edição, a opção **Local Ativo** registra a situação do cadastro. Inativar não equivale a excluir o histórico de reuniões. Confirme a existência de eventos vinculados e o procedimento institucional antes de modificar a situação.

## 4. Cadastrar e editar Espaços de um Local

1. Na lista de Locais, clique em **Espaços** no local correto.
2. A janela **Espaços do Local** lista os ambientes com nome, capacidade e status.
3. Para adicionar, informe **Nome do Espaço** (obrigatório), capacidade e descrição quando aplicável.
4. Marque ou desmarque **Espaço ativo** conforme a situação verificada.
5. Clique em **+ Adicionar Espaço** e aguarde a resposta.
6. Para modificar um existente, escolha **Editar** na linha do Espaço, atualize e clique em **Atualizar Espaço**.
7. Se necessário, use **Cancelar edição** para limpar a seleção de edição sem apagar o Espaço existente.

A capacidade é opcional na interface; se for informada, deve fazer sentido para o ambiente. Espaços estão vinculados a um Local específico, portanto confira o cabeçalho antes de salvar. Uma mudança de status não deve ser apresentada como remoção física ou exclusão de histórico.

## 5. Estrutura territorial — ordem e vínculos

A estrutura deve ser cadastrada de cima para baixo:

1. **Regional**: unidade institucional superior.
2. **Administração**: vinculada à Regional.
3. **Setor**: vinculado a uma Administração da Regional selecionada.
4. **Casa de Oração**: vinculada ao Setor.

Os formulários têm ações de criação e edição, com campos de nome, código quando previsto, vínculo superior e indicador **Ativo**. Os dados devem seguir os registros institucionais oficiais; o manual não autoriza criar uma Regional ou Setor fictício para satisfazer o formulário.

### 5.1. Regionais

Na tela **Gestão Territorial — Regionais**, consulte a listagem e **Detalhes**. Quando seu perfil permitir, use **+ Nova Regional** ou **Editar**. Confira nome, eventual código e situação ativa/inativa antes de **Salvar Regional** ou **Atualizar Regional**.

**Atenção:** essa operação é particularmente sensível. O fato de existir o botão não autoriza implantação em outra Regional: essa iniciativa está registrada separadamente como **dívida pós-implantação de São Paulo** (issue #330), com banco D1 isolado e cargas próprias.

### 5.2. Administrações

Na tela **Gestão Territorial — Administrações**, utilize **Filtrar por Regional**. Para novo registro, escolha **+ Nova Administração**, selecione a Regional correta e informe os dados exigidos. Na listagem, **Detalhes** e **Editar** permitem conferir/atualizar o vínculo e a situação, desde que autorizados.

### 5.3. Setores

Na tela **Gestão Territorial — Setores**, filtre primeiro por **Regional** e então por **Administração**. Ao trocar a Regional, o filtro de Administração é limpo para evitar associação incorreta.

Em **+ Novo Setor**, selecione a Regional e uma Administração **pertencente a ela**, depois informe os demais campos. Para registros existentes, use **Detalhes** ou **Editar**. O vínculo administrativo é obrigatório para um Setor válido.

### 5.4. Casas de Oração

Na tela de Casas de Oração, utilize **Filtrar por Setor**. Para cadastrar, selecione **+ Nova Casa de Oração**, escolha o **Setor** correto e preencha os dados institucionais. O formulário também permite editar registros existentes e sua situação ativa/inativa, mediante autorização.

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
