# Manual de Uso — Contas, Acessos, Permissões e Segurança (M2.6)

> **Rascunho para revisão do PO — 20/10/2026.** Base de leitura: implementação na `develop` das telas de acesso, perfil e administração. É necessária validação de versão publicada, telas reais e perfis antes de distribuir aos usuários. **Somente documentação; não concede ou altera permissões.**

## 1. Objetivo e relação com M2.1

O capítulo [Acesso, pré-cadastro e ativação](manual-uso-acesso-cadastro.md) explica como preparar o cadastro, enviar o link individual, ativar a conta, entrar e solicitar recuperação de PIN.

Este capítulo M2.6 aborda a **rotina do administrador** após o cadastro: localizar contas, identificar situações pendentes, administrar acessos por perfil/escopo, gerar links de redefinição, bloquear/desbloquear contas e encerrar sessões. **Cadastro de Membro, Conta de Acesso, Perfil Técnico e Vínculo Funcional são registros distintos.**

## 2. Quem pode usar

A aba **Contas e Acessos** é exibida mediante a capacidade `podeAdministrarAcessos`. As ações administrativas também são validadas na API e dependem do âmbito autorizado. A gestão individual de sessões na tela exige ainda `podeGerenciarSessoes`; não conclua que todo administrador de acessos pode visualizar e revogar sessões separadamente.

O perfil **Master do Sistema** tem escopo `GLOBAL`. A seleção de outros perfis e níveis depende das opções autorizadas no formulário e das regras da API. Uma autorização concedida para uma Casa, Setor, Administração ou Regional não deve ser interpretada como acesso irrestrito a outras unidades.

**Atenção:** atribuição de uma função reservada por vínculo funcional também pode dar acesso à Portaria, a Relatórios ou à Auditoria, independentemente da administração manual de perfis nesta tela. Veja [GTs, Membros, Funções e Vínculos](manual-uso-gt-membros-funcoes-vinculos.md), especialmente os avisos sobre códigos reservados, revogação em massa e validação pelo Master.

## 3. Localizar uma conta e interpretar a situação

1. Abra **Mais → Acessos**, se o menu estiver disponível para sua conta.
2. Use a busca por **nome, celular ou carteirinha**. Confirme identidade e Casa de Oração antes de qualquer alteração.
3. Utilize os filtros territoriais da interface para restringir **Regional → Administração → Setor → Casa**; ao mudar um nível, confira as opções dependentes.
4. Quando necessário, refine por **status da conta** e **perfil**.
5. Antes de decidir uma ação, confira o status exibido e eventuais solicitações de recuperação.

A interface pode indicar **Sem conta**, **Sem perfil ativo**, **Pendente de ativação**, **Ativa**, **Bloqueada**, **Desativada** e **Recuperação de PIN pendente**. Essas situações não são sinônimas: uma conta pendente pode já existir, mas o titular ainda não concluiu o PIN; uma conta ativa pode não ter o perfil técnico esperado.

**Não crie outro Membro ou outra Conta para contornar uma pendência**, nem envie link ao celular de terceiros. Divergências de identidade ou vínculos territoriais precisam ser corrigidas no procedimento autorizado.

## 4. Gerar ativação e redefinir PIN

### 4.1. Conta sem ativação

1. Identifique o membro sem conta pelo cadastro correto.
2. Se a ação **Gerar ativação** estiver disponível, acione-a.
3. Copie o link temporário ou utilize a opção de envio via WhatsApp quando houver celular válido.
4. Confira a **validade indicada na tela**; encaminhe o link individual **somente ao titular** e oriente-o a criar seu PIN pessoal.

Um link gerado **não significa mensagem enviada**. Links são individuais, temporários e de uso único. Nunca copie um PIN para o administrador.

### 4.2. Conta já existente ou ativação pendente

A emissão do primeiro link pode criar uma conta em `PENDENTE_ATIVACAO`. Se o link se perder ou expirar, **Gerar ativação** pode não aparecer novamente. Nessa condição, verifique a identidade do titular e use **Redefinir PIN**, se a ação estiver disponível e for permitida para o estado da conta. O novo link também deve ser entregue apenas ao titular.

Em uma conta ativada, **Redefinir PIN** solicita confirmação administrativa e **encerra as sessões atuais**. O titular precisará concluir o procedimento pelo link recebido; o administrador não define nem conhece o novo PIN.

Quando o titular usa **Esqueci meu PIN**, a interface pública informa apenas que a solicitação foi recebida, sem revelar se o celular está cadastrado. O administrador deve localizar a pessoa e avaliar a indicação **Recuperação de PIN solicitada**; **não presuma envio automático de mensagem ou PIN**.

## 5. Administração de perfis e escopos

1. Em **Contas e Acessos**, selecione a pessoa correta e abra a opção de gerenciar os seus acessos/perfis.
2. Consulte os **perfis ativos** já concedidos; confira também o escopo nominal e institucional antes de acrescentar algo.
3. No formulário, selecione o **perfil**, o **nível de escopo** permitido e a **unidade correspondente** quando não for global.
4. Verifique se a ação é necessária e autorizada, especialmente para funções administrativas ou de auditoria.
5. Confirme a operação e revise a listagem para verificar o resultado.
6. Para remover um perfil, use **Revogar** somente após confirmar a pessoa, o perfil, o escopo e o impacto operacional.

**Restrições relevantes da interface:** o nível `GLOBAL` é reservado ao `MASTER_SISTEMA`; os demais perfis têm escolhas de escopo condicionadas pela configuração. O formulário evita selecionar unidades homônimas sem identificação inequívoca (por exemplo, falta de código institucional). Não contorne esse bloqueio escolhendo uma unidade apenas pelo nome; regularize a identificação com o responsável pela estrutura.

A tela distingue o perfil padrão `USUARIO_COMUM` dos perfis administrativos. A ausência de botão de revogação de um perfil padrão não deve ser interpretada como falha nem justifica alterar registros diretamente no banco.

**Revogar um perfil não é o mesmo que revogar sessões.** Avalie separadamente se há necessidade de encerrar sessões em situações de desligamento de função ou incidente. Nunca conceda `MASTER_SISTEMA` apenas para resolver falta de acesso a uma operação específica.

## 6. Bloqueio e desbloqueio de contas

- **Bloquear:** confirme a pessoa selecionada e a operação. A interface informa que a conta é bloqueada e suas sessões revogadas. Use em caso de necessidade administrativa ou de segurança, com justificativa e comunicação ao responsável.
- **Desbloquear:** quando disponível para conta bloqueada, exige confirmação e não deve ser usado sem resolver previamente a razão do bloqueio.
- **Desativada:** é situação distinta de bloqueada. Não oriente o uso de **Desbloquear** como solução automática para contas desativadas.

Depois de alterar o status, atualize a consulta e confirme a situação efetiva. Não utilize contas compartilhadas para contornar o bloqueio.

## 7. Sessões de acesso

O sistema permite **revogar todas as sessões** de uma conta pelas ações administrativas elegíveis. Em perfis que possuem também `podeGerenciarSessoes`, a interface pode oferecer **Sessões ativas**, exibindo dispositivo identificado, criação, último uso e opção de **Revogar esta sessão**.

1. Identifique o titular e confirme a legitimidade da solicitação.
2. Para encerramento completo, use **Revogar todas as sessões**, confirme e informe que novos acessos poderão exigir login.
3. Para revogação específica, quando autorizada, abra **Sessões ativas**, identifique o dispositivo e confirme **Revogar esta sessão**.
4. Confira o resultado e registre a providência conforme o procedimento de suporte.

A listagem de dispositivos pode exibir **Dispositivo não identificado** ou último uso indisponível; não atribua titularidade a um dispositivo apenas pelo rótulo técnico.

## 8. Segurança e proteção de dados

- Valide **identidade, celular e escopo** antes de gerar link, redefinir PIN, conceder perfil, bloquear conta ou revogar sessão.
- Não divulgue PINs, links temporários, tokens, carteirinhas ou listagens de membros em grupos públicos. Use canais institucionais apropriados.
- Não copie dados pessoais para tickets públicos, capturas do manual ou comentários abertos em GitHub.
- Links de ativação/redefinição devem ser utilizados apenas pelo titular e têm validade apresentada na interface.
- A autorização deve observar **menor privilégio**: perfil e escopo estritamente necessários.
- Ao investigar acesso indevido, confira **perfis técnicos e vínculos funcionais com códigos reservados**; verificar apenas a aba de Acessos não garante cobertura de todas as permissões efetivas.

## 9. Problemas frequentes

| Ocorrência | Encaminhamento |
|---|---|
| Pessoa não aparece na busca | Verificar escopo dos filtros, Casa, carteirinha e cadastro de Membro |
| Conta está pendente e link expirou | Verificar identidade e elegibilidade de **Redefinir PIN**; não reutilizar o link |
| Recuperação de PIN solicitada | Validar titular e executar a redefinição assistida |
| Não aparece controle de sessões individuais | Verificar capacidade `podeGerenciarSessoes` |
| Perfil desejado ou unidade não aparece | Conferir autorização administrativa e escopo permitido; não forçar via cadastro paralelo |
| Unidade homônima bloqueada | Solicitar desambiguação institucional/código da unidade |
| Conta bloqueada | Avaliar justificativa; desbloqueio depende de autorização e correção da causa |
| Usuário segue sem acesso após alterar perfil | Verificar conta, perfil ativo, escopo, vínculo funcional reservado e sessão atual |

## 10. Pendências para validação editorial e homologação

- [ ] Confirmar versão/build de produção e validar telas com dados fictícios ou anonimizados.
- [ ] Verificar autorização real na API para conceder/revogar perfis e para revogar sessões, inclusive proteção do Master.
- [ ] Validar os estados e opções de status por perfil, e diferenças entre bloqueio e desativação.
- [ ] Conferir se a nomenclatura da interface corresponde aos textos deste manual.
- [ ] Confirmar procedimentos institucionais para autorização, registro e comunicação de mudanças de acesso.
- [ ] Verificar com perfis reais autorizados a experiência de filtros, escopos homônimos e recuperação de PIN, sem exposição de dados pessoais.
- [ ] Conferir impactos de mudanças territoriais e das funções reservadas no capítulo M2.5.

## 11. Fontes técnicas

- `apps/web/src/App.tsx`
- `apps/web/src/components/acessos/ContasAcessoView.tsx`
- `apps/web/src/components/acessos/GerenciarAcessosPanel.tsx`
- `apps/web/src/components/auth/AuthView.tsx`
- `apps/web/src/components/perfil/PerfilView.tsx`
- `apps/worker/src/security/permissoes.ts`
- `docs/08-operacao/manual-uso-acesso-cadastro.md`

Estas instruções descrevem a implementação consultada e **não autorizam mudança de política nem ações fora do perfil do operador**.
