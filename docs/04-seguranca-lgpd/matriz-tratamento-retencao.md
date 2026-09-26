# Matriz técnica de tratamento e retenção de dados

> Documento técnico de governança. Não substitui validação jurídica do controlador.
> Status: S13.06 — pré-produção.

## Princípios adotados

- Finalidade e necessidade determinam quais dados podem ser tratados.
- Não existe retenção permanente por padrão.
- Quando a finalidade termina, o dado deve ser eliminado ou conservado apenas quando houver fundamento aplicável.
- Consentimento não é presumido como base padrão.
- A ciência de responsabilidade do PMO é registro de governança e não consentimento LGPD.
- O contexto da aplicação pode revelar vínculo com organização religiosa; por isso, a hipótese legal aplicável deve ser validada considerando também o regime de dados pessoais sensíveis.

## Matriz

| Categoria | Dados/tabelas principais | Finalidade técnica | Retenção técnica atual | Evento de término | Destino previsto | Base legal |
|---|---|---|---|---|---|---|
| Cadastro institucional | `membros`, vínculos, Casa/Setor/Administração/Regional | identificar o membro e aplicar escopo institucional | enquanto cadastro estiver ativo; histórico ainda sem prazo homologado | desligamento/inativação + término de necessidades administrativas | inativação; eliminação/anonimização posterior conforme política | **PENDENTE DE VALIDAÇÃO DO CONTROLADOR/JURÍDICO** |
| Pré-cadastro ministerial | `pre_cadastros_ministeriais` | localizar e finalizar cadastro institucional | sem purge automático | vinculação a membro, inativação da origem ou perda de finalidade | definir eliminação/anonimização do excedente após conciliação | **PENDENTE** |
| Conta e perfis de acesso | `contas_acesso`, `acessos_conta` | autenticação e autorização | registros permanecem enquanto necessários para segurança e governança | desativação da conta e término da necessidade de trilha | revogação/inativação; prazo histórico a homologar | **PENDENTE** |
| Sessões | `sessoes` | manter sessão autenticada | expiração funcional por 12 h de inatividade ou 30 dias absolutos; registros expirados não possuem purge automático | expiração, logout, bloqueio, reset de PIN ou revogação | excluir registros expirados/revogados após janela de segurança a homologar | hipótese de segurança/autenticação a validar |
| Links de ativação/reset | `links_ativacao` | ativar ou redefinir acesso | validade funcional de 7 dias; revogação do link anterior | uso, revogação ou expiração | excluir hashes e metadados após janela de auditoria a homologar | hipótese de segurança/autenticação a validar |
| Tentativas/rate limit | `tentativas_acesso`, `rate_limits_autenticacao` | segurança, antifraude e recuperação | rate limit de login: janela técnica de 24 h; logs de tentativa sem purge automático | fim da janela de segurança / perda de finalidade | rate limit expira; logs históricos exigem prazo homologado | hipótese de segurança e prevenção a fraude a validar |
| Auditoria | `auditoria_logs`, ciências de responsabilidade | responsabilização, investigação de alteração e governança | sem purge automático | fim do período necessário à responsabilização institucional | retenção por prazo formal + eliminação/anonimização | **PENDENTE — definir prazo institucional** |
| Convocações e RSVP | convocações, destinatários, evidências, `rsvp` | organizar participação em reuniões | sem purge automático | encerramento do ciclo administrativo da reunião | histórico mínimo ou anonimização conforme finalidade | **PENDENTE** |
| Presença | `checkins`, snapshots/relatórios de presença | comprovar participação e gerar relatórios | sem purge automático | fim da finalidade administrativa do histórico | prazo institucional + anonimização/eliminação | **PENDENTE — definir prazo institucional** |
| Convidados | `convidados_evento` e credenciais de cadastro | permitir admissão de pessoa não prevista | vinculados ao evento; sem purge automático global | fechamento do evento e fim da necessidade de conferência | eliminar dados identificáveis após prazo operacional homologado | **PENDENTE — prioridade alta** |
| Portaria | operadores, credenciais temporárias, solicitações, reaberturas | controlar entrada, fechamento e retificação | credenciais revogadas no fechamento; histórico sem purge automático | fechamento definitivo e término da necessidade de auditoria | excluir credenciais temporárias após janela técnica; manter apenas trilha necessária | **PENDENTE** |
| Push | `push_subscriptions` | entrega de notificações | assinaturas ativas permanecem em uso; ao cancelar ou receber 404/410, o sistema hoje apenas marca `ativo=false` e mantém `endpoint`, `p256dh`, `auth` e `User-Agent`; não há purge automático | revogação, endpoint inválido ou desativação do usuário | implementar eliminação das credenciais/metadados inativos após prazo operacional homologado | **PENDENTE — retenção residual sem purge automático** |

## Prazos técnicos já implementados

Esses prazos são controles de funcionamento e segurança; não são, por si só, política completa de retenção:

- sessão: 12 horas de inatividade máxima;
- sessão: 30 dias de validade absoluta máxima;
- atualização de atividade da sessão: no máximo a cada 5 minutos;
- link de ativação/reset: 7 dias;
- rate limit de login: retenção técnica de 24 horas para a chave hash;
- recuperação de PIN: janela de throttle de 15 minutos.

## Pendências obrigatórias antes da política final

1. Identificar formalmente o controlador e o canal responsável por privacidade.
2. Validar a hipótese legal por finalidade, inclusive quando o contexto revelar vínculo religioso.
3. Homologar prazo de retenção para:
   - auditoria;
   - histórico de presença;
   - convidados;
   - Portaria;
   - tentativas de acesso.
4. Definir procedimento de:
   - correção;
   - acesso;
   - eliminação quando cabível;
   - anonimização;
   - resposta ao titular.
5. Somente após os prazos serem homologados, implementar rotinas automáticas de purge/anomização.

## Regra para novas funcionalidades

Nenhuma nova categoria de dado pessoal deve entrar no schema sem registrar previamente:

- finalidade;
- campos mínimos;
- titulares;
- quem pode acessar;
- hipótese legal validada;
- prazo/evento de término;
- descarte ou anonimização;
- trilha de auditoria necessária.

## Referências oficiais

- Lei nº 13.709/2018 (LGPD), especialmente arts. 7º, 11, 15 e 16:
  https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm
- ANPD — Perguntas frequentes, item sobre tempo de tratamento:
  https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes
- ANPD — materiais educativos e guias:
  https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes
