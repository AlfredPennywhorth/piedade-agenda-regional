# MVP-AGENDA-01 — levantamento técnico da governança da Agenda

## Escopo revisado

Rotas analisadas:
- `/api/v1/eventos`;
- `/api/v1/convocacoes`;
- helpers atuais de permissões e capacidades.

## Estado atual confirmado

As rotas de Eventos e Convocações usam `authMiddleware`, portanto exigem sessão autenticada.

Porém, no estado atual:
- criação de evento não verifica `GESTOR_AGENDA` nem escopo autorizado;
- edição de evento não verifica `GESTOR_AGENDA` nem escopo autorizado;
- criação/edição de convocação não verifica perfil/escopo;
- associação/remoção de funções da convocação não verifica perfil/escopo;
- publicação/cancelamento de convocação não verifica perfil/escopo;
- leitura geral de eventos/convocações também não está filtrada por escopo técnico.

Na prática, autenticação e autorização de Agenda ainda estão desacopladas.

## Baseline institucional já disponível

O modelo de acesso já possui:
- perfil técnico `GESTOR_AGENDA`;
- escopos `REGIONAL`, `ADMINISTRACAO`, `SETOR`, `CASA` e `GRUPO_TRABALHO`;
- resolução de Regional por escopo;
- Master global;
- contexto consolidado de acessos da conta.

Portanto, o hardening pode reutilizar a fundação ACC sem criar um segundo modelo de permissões.

## Implementação proposta

Criar helper único, por exemplo:

`podeGerenciarAgendaNoEscopo(db, contexto, escopoTipo, escopoId)`

Regras mínimas:
1. Master global: autorizado;
2. `GESTOR_AGENDA`: autorizado somente quando o acesso ativo corresponde ao escopo da operação;
3. nenhum outro perfil técnico recebe escrita por herança implícita;
4. criação, edição, publicação e cancelamento retornam `403 FORBIDDEN` fora do escopo;
5. mudança de escopo em PATCH deve validar o escopo final, não somente o original;
6. Convocação herda a autorização do Evento associado;
7. operações continuam auditadas.

## Questões que precisam de deliberação antes da implementação definitiva

### Herança territorial

Definir se um `GESTOR_AGENDA` em:
- Regional pode gerir Administrações, Setores e Casas subordinadas;
- Administração pode gerir Setores e Casas subordinadas;
- Setor pode gerir Casas subordinadas;

ou se a regra será correspondência estrita de escopo.

O modelo atual de Relatórios usa correspondência estrita para `GESTOR_RELATORIOS`. A Agenda não deve presumir uma regra diferente sem decisão explícita.

### Leitura da Agenda

Definir se:
- todo usuário autenticado pode visualizar eventos pertinentes à própria agenda; e
- apenas a escrita fica restrita ao Gestor;

ou se a listagem administrativa também deve ser limitada por escopo.

## Testes de caracterização

Foi adicionado `agenda-governanca.todo.spec.ts` com os cenários de autorização que devem virar testes executáveis quando a regra de herança territorial for ratificada.

## Risco

Este gap deve ser fechado antes de uma Beta com usuários reais com múltiplos perfis, pois no estado atual uma conta autenticada consegue atingir rotas de escrita da Agenda sem comprovar `GESTOR_AGENDA`.

## Relação com PR #54

Nenhuma dependência funcional. A PR #54 pode ser homologada e mergeada separadamente.
