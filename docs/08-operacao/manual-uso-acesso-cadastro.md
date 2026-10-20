# Manual de Uso — Acesso, pré-cadastro e ativação

> **Rascunho para revisão do PO — 20/10/2026.** Base funcional: código de `main` examinado no commit [`1dc2b49121b9040aded31c6ea7f1691bf5fade5c`](https://github.com/AlfredPennywhorth/piedade-agenda-regional/commit/1dc2b49121b9040aded31c6ea7f1691bf5fade5c). A versão/build efetivamente publicada na Cloudflare e capturas de tela ainda precisam ser validados. Este capítulo não altera procedimentos institucionais, permissões ou o sistema.

## 1. Antes do primeiro acesso: responsabilidades

O acesso à Agenda Regional São Paulo não começa diretamente na tela de login. Primeiro, um **administrador autorizado** verifica se a pessoa está cadastrada como membro, se os dados necessários estão corretos e se a conta pode ser habilitada. Depois é gerado um **link individual de ativação**, que o próprio titular utiliza para definir seu PIN.

As operações são distintas:

| Etapa | Responsável | Tela / código | Resultado |
|---|---|---|---|
| Localizar ou concluir cadastro | Administrador com acesso a Membros | Membros — `AGD-ADM-010`; finalização de pré-cadastro `AGD-ADM-048`; cadastro manual `AGD-ADM-035` | Membro existente e dados conferidos |
| Preparar acesso e gerar link | Administrador autorizado a administrar acessos | Contas e Acessos — `AGD-ADM-015` | Link temporário para titular |
| Ativar conta | Próprio membro | Ativação — `AGD-SHR-003` | PIN pessoal criado |
| Entrar posteriormente | Próprio membro | Login — `AGD-SHR-002` | Sessão autenticada |

**Importante:** a visualização de uma tela, a criação de um membro e a administração de contas dependem de permissões distintas. A aplicação oculta ações sem autorização; o backend também verifica as permissões.

## 2. Administrador — localizar e finalizar pré-cadastro ministerial

1. Entre com sua própria conta e abra **Mais → Membros**, caso a opção esteja disponível.
2. Consulte a listagem e pesquise a pessoa pelo nome, carteirinha ou Casa de Oração, evitando cadastro duplicado.
3. Ao cadastrar um membro, o formulário oferece dois caminhos: **Finalizar pré-cadastro ministerial** e **Novo membro manual**.
4. Para finalizar um pré-cadastro já existente, escolha **Finalizar pré-cadastro ministerial** e pesquise o nome (ao menos duas letras).
5. Confira o resultado apresentado, incluindo nome, referência de Casa e dados ministeriais disponíveis. Não selecione registro sinalizado como **Já vinculado**.
6. Selecione o pré-cadastro correspondente à pessoa correta.
7. Confirme a Casa de Oração e preencha **Código da Carteirinha** e **Celular**. Esses três dados são exigidos na finalização.
8. Acione **Finalizar pré-cadastro** e aguarde a confirmação de que o membro foi criado.
9. Volte à listagem para conferir que o cadastro aparece antes de seguir para a ativação.

O pré-cadastro ministerial aqui descrito **já existe no sistema** antes dessa etapa: não é criado do zero pela pesquisa. A finalização é a operação que o vincula ao cadastro de Membros. Se a pessoa não constar dos resultados, não escolha outro registro; consulte o responsável pelo cadastro e avalie, conforme autorização, a alternativa de cadastro manual.

### 2.1. Cadastro manual

Se não houver pré-cadastro aproveitável e o procedimento institucional permitir, o administrador pode selecionar **Novo membro manual** no mesmo formulário. Confira nome, carteirinha, Casa de Oração, celular e demais campos indicados na tela, e salve somente após checar se não existe membro equivalente. Não utilize o cadastro manual para contornar erro ou divergência de um pré-cadastro ministerial existente.

**Ponto de validação com o PO:** condições institucionais em que o cadastro manual é permitido e a origem/atualização do pré-cadastro ministerial.

## 3. Administrador — gerar e encaminhar o link de ativação

1. Abra **Mais → Acessos** (Contas e Acessos, `AGD-ADM-015`). Esse módulo só aparece para quem possui autorização.
2. Pesquise o membro por **nome, celular ou carteirinha**.
3. Confira se o resultado corresponde à pessoa correta, incluindo celular e código de carteirinha.
4. Se a pessoa **ainda não possui conta de acesso**, clique em **Gerar ativação**.
5. Aguarde a geração do **link temporário** e confira a data/hora de validade exibida.
6. Use **Copiar link** ou **Enviar pelo WhatsApp**, quando houver celular válido, para encaminhá-lo **somente ao titular**.
7. Oriente a pessoa a realizar a ativação antes do vencimento.

O botão **Gerar ativação** é exibido quando o membro não possui conta de acesso. Para contas existentes, o sistema oferece outras ações conforme status e permissões. **Exceção importante — ativação pendente:** a geração do primeiro link já pode criar uma conta em status `PENDENTE_ATIVACAO`. Se esse link expirar ou for perdido antes da conclusão, **Gerar ativação** não aparece mais. Nessa condição, o administrador autorizado pode selecionar **Redefinir PIN** para emitir um novo link individual de conclusão da ativação. Confira a identidade e o celular do titular antes de reemitir e encaminhe o link somente a ele. Essa operação não significa que o membro já definiu um PIN.

**Segurança:** o link é individual, temporário e de uso único. Não publique em grupos, não encaminhe a terceiros e não solicite que o administrador escolha ou conheça o PIN do membro.

## 4. Membro — ativar sua conta pela primeira vez

1. Abra o link individual recebido do administrador.
2. Na tela **Ativar conta de acesso** (`AGD-SHR-003`), informe o **Código da carteirinha**.
3. Informe o **Celular** previamente cadastrado.
4. Crie um **PIN pessoal de seis dígitos** e repita-o em **Confirmar PIN**.
5. Selecione **Ativar e entrar**.
6. Se houver mensagem de erro, confira os dados e procure o administrador responsável; não compartilhe PIN nem link em mensagens de suporte.
7. Após entrar, abra **Mais → Meu Cadastro** para conferir os dados institucionais e o celular.

A carteira e o celular informados no primeiro acesso devem corresponder aos dados cadastrados para a conta. A tela permite **Voltar para o login** quando a ativação tiver sido aberta indevidamente.

## 5. Membro — acessar nos dias seguintes

1. Abra a URL oficial: https://piedade-agenda-regional.pages.dev/.
2. Na tela **Entrar** (`AGD-SHR-002`), informe o **Celular** cadastrado.
3. Informe o **PIN pessoal de seis dígitos**.
4. Toque em **Entrar**.
5. Para encerrar o acesso, use **Sair**.

Em **Meu Cadastro** (`AGD-SHR-001`), o membro pode consultar nome, carteirinha, data de ordenação, Casa de Oração e status da conta. Esses dados institucionais não são editáveis nessa tela. A pessoa pode **Atualizar celular**, mediante PIN atual, ou **Alterar PIN**; a alteração do PIN encerra as sessões e exige novo login.

## 6. Esqueceu o PIN ou não conseguiu ativar?

### 6.1. Solicitar recuperação

1. Na tela **Entrar**, clique em **Esqueci meu PIN**.
2. Na tela **Recuperar PIN** (`AGD-SHR-004`), informe o celular cadastrado e envie a solicitação.
3. Aguarde a atuação do administrador responsável. Não pressuponha que um novo PIN ou link seja enviado automaticamente.

### 6.2. Administrador — redefinir PIN

1. Abra **Contas e Acessos** e localize a conta correta.
2. Confira se há indicação de **Recuperação de PIN solicitada**.
3. Para uma conta existente elegível, selecione **Redefinir PIN** e confirme a operação.
4. A redefinição encerra as sessões existentes. Copie ou encaminhe somente ao titular o link individual temporário exibido.
5. O membro abre esse link e conclui o procedimento de definição do novo PIN.

### 6.3. Ocorrências comuns

| Situação | Orientação |
|---|---|
| Pessoa não aparece em Membros | Conferir pesquisa, escopo administrativo e existência de pré-cadastro; não criar duplicidade |
| Pré-cadastro aparece como **Já vinculado** | Localizar o membro já criado |
| Carteirinha ou celular não coincide | Corrigir os dados pelo fluxo administrativo autorizado antes de nova tentativa |
| Membro não vê menu administrativo | Verificar permissões; ausência de menu não implica defeito |
| Link inicial expirou ou foi perdido com conta `PENDENTE_ATIVACAO` | Administrador autorizado deve confirmar identidade e usar **Redefinir PIN** para gerar novo link; não reutilizar o anterior |
| PIN esquecido | Usar **Esqueci meu PIN** e seguir a recuperação supervisionada |
| Conta bloqueada ou desativada | Encaminhar ao administrador com permissão para avaliar o status; não contornar o bloqueio |

## 7. Regras de segurança e suporte

- Nunca compartilhe PIN, tokens de sessão ou links individuais com outras pessoas.
- Administradores não devem solicitar o PIN ao titular.
- Ao relatar um erro, anote a **tela/código AGD**, a ação realizada, a mensagem recebida e o ambiente/versão exibidos. Não inclua dados pessoais desnecessários em chamados.
- Um clique de geração de link não equivale ao envio confirmado de uma mensagem: o administrador deve conferir o compartilhamento com o titular.
- As permissões reais são verificadas na API. Este manual não concede novos acessos.

## 8. Pendências antes da publicação definitiva

- [ ] Confirmar o SHA e o build efetivamente implantados em produção; remover qualquer referência de versão não validada.
- [ ] Conferir visualmente as telas com perfis autorizados, sem capturar dados pessoais reais.
- [ ] Confirmar com o PO a origem dos pré-cadastros ministeriais e quando usar o cadastro manual.
- [ ] Validar a condição exata de elegibilidade para geração/regeração do link na API de produção.
- [ ] Registrar capturas reais dos códigos `AGD-ADM-010`, `AGD-ADM-048`, `AGD-ADM-015` e `AGD-SHR-002/003/004`.
- [ ] Revisar instruções com ao menos um administrador e um usuário que tenha feito a ativação.

## 9. Fontes auditadas

- `apps/web/src/components/membros/MembrosView.tsx` (`main`).
- `apps/web/src/components/acessos/ContasAcessoView.tsx` (`main`).
- `apps/web/src/components/auth/AuthView.tsx` (`main`).
- `apps/web/src/components/perfil/PerfilView.tsx` (`main`).
- `apps/web/src/App.tsx` e `apps/web/src/components/layout/MainLayout.tsx` (`main`).
- `docs/inventario-codigos-telas.md` (`main`).
- `docs/08-operacao/manual-usuarios.md` (`develop`), versão inicial a consolidar na etapa seguinte.
