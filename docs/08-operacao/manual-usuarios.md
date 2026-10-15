# Manual operacional — Agenda Regional São Paulo

> Versão inicial para usuários da produção v1.1.0 (build 6741936). Os nomes de botões e permissões podem variar por perfil. Este documento não substitui orientação institucional.

## Acesso e primeiros passos

1. Acesse https://piedade-agenda-regional.pages.dev/.
2. No primeiro acesso, utilize o fluxo de ativação disponibilizado pelo administrador. Nos acessos seguintes, autentique-se pelo mecanismo de celular/PIN.
3. Confira **Meu Cadastro**. Caso encontre dados institucionais incorretos, solicite ajuste ao administrador responsável. Não compartilhe PIN ou links de ativação.
4. Em **Minha Agenda**, consulte os eventos e convocações pertinentes ao seu perfil. Eventos e opções de administração podem estar ocultos por permissão.

## Secretaria — preparação de reuniões oficiais

1. Antes de registrar uma reunião, confirme se a Casa de Oração, o Setor, o Local e o Espaço corretos já constam do sistema.
2. Em **Locais** (AGD-ADM-013), procure o endereço existente antes de criar outro. Cadastre novo Local apenas no escopo que seu perfil autorizar.
3. Na gestão de **Espaços** do Local, confirme se já existe, por exemplo, o espaço *Templo*. Usuário comum pode cadastrar Espaços apenas nos Locais institucionais novos de sua própria autoria, segundo as restrições territoriais. Os Locais antigos são administrados por perfil autorizado, como Master.
4. Em **Eventos** (AGD-ADM-001), escolha o escopo, a data/hora, o Local e o Espaço pertinentes. Confira os dados antes de salvar.
5. Para reuniões recorrentes, use **Séries** (AGD-ADM-002). Antes de alterar uma série existente, verifique o efeito sobre suas ocorrências e convocações.
6. Em **Convocações** (AGD-ADM-014), confirme funções, pessoas convocadas, horários e status antes da divulgação.
7. Abra **Calendário** e **Minha Agenda** para verificar como o registro aparece aos usuários autorizados.

**Atenção:** a criação de Local/Espaço não equivale à publicação de uma reunião. Não recrie um cadastro antigo apenas para obter autoria; procure o Master.

## Trilhas por perfil (orientação operacional)

| Perfil / função de uso | Trilha inicial |
|---|---|
| Usuário comum | Ativação → Meu Cadastro → Minha Agenda/Calendário → responder convocações |
| Secretaria / gestor de agenda | Conferir estrutura → Locais/Espaços → Eventos/Séries → Convocações → conferência |
| Administração Regional | Gestão dos registros dentro de seu escopo autorizado → correções. **Relatórios somente com permissão adicional específica** (por exemplo, GESTOR_RELATORIOS, vínculo equivalente ou condição de organizador que autorize a consulta). |
| Operador de Portaria | Acessar Portaria com autorização → conferir evento → executar recepção conforme fluxo da tela |
| Gestor de Relatórios | Selecionar período e escopo → consultar indicadores → exportar apenas dados autorizados |
| Auditor | Consultar trilhas de auditoria autorizadas sem alterar registros |
| Master do Sistema | Administrar cadastros e acessos, corrigir registros legados, acompanhar segurança e operações |

A autorização efetiva é determinada pelo backend e pelos vínculos do usuário; o quadro não concede permissões.

## Verificação e suporte

- Ao relatar erro, informe **ambiente**, **versão/build**, **código da tela**, ação realizada e mensagem mostrada. Evite enviar dados pessoais ou PIN.
- Antes de repetir uma operação que parece ter falhado, atualize a listagem e confira se o registro já foi criado.
- A URL oficial é https://piedade-agenda-regional.pages.dev/ (sem prefixo `main`).
- Antes de cargas grandes, confirme com o administrador que há backup válido do D1 e procedimento de recuperação.

## Pontos que exigem validação com usuários antes da publicação como manual definitivo

Capturas de tela, instruções exatas de ativação/recuperação do PIN, passos de check-in de Portaria, perfis administrativos efetivamente delegados e regras de convocação por escopo. Não presumir que todas as opções estão visíveis para todos os usuários.
