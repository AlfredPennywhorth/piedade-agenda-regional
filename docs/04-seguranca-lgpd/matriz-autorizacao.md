# Matriz Canônica de Autorização — ACC-08

**Projeto:** Agenda Regional São Paulo  
**Status:** DRAFT PARA HOMOLOGAÇÃO PMO  
**Data:** 2026-09-21

## 1. Objetivo

Consolidar, antes da aplicação de autorização fina nas APIs e no frontend, quais perfis técnicos podem acessar cada módulo e em qual escopo.

Esta matriz distingue regras já sustentadas pelo código/regras aprovadas de pontos que ainda dependem de decisão funcional. Nenhuma linha marcada como **PENDENTE PMO** deve ser convertida em permissão de produção por inferência técnica.

## 2. Perfis técnicos existentes

- `MASTER_SISTEMA`
- `ADMINISTRADOR_SISTEMA`
- `GESTOR_AGENDA`
- `OPERADOR_PORTARIA_PERMANENTE`
- `GESTOR_RELATORIOS`
- `AUDITOR`
- `USUARIO_COMUM`

## 3. Regras transversais já consolidadas

| Regra | Situação |
|---|---|
| Toda rota institucional protegida exige sessão autenticada | APROVADO / ACC-06 |
| `MASTER_SISTEMA` é exclusivamente global | APROVADO / schema + ACC-03 |
| `ADMINISTRADOR_SISTEMA` é atribuído em escopo Regional | APROVADO / schema + ACC-03 |
| Master pode administrar contas de acesso globalmente | APROVADO / ACC-05 |
| Administrador do Sistema pode administrar contas somente dentro da(s) Regional(is) atribuída(s) | APROVADO / ACC-05 |
| Vínculo funcional não concede automaticamente permissão técnica administrativa | APROVADO / ACC-07 |
| Permissões devem ser verificadas no backend; ocultar botão no frontend não é controle de acesso | APROVADO / segurança |
| Acesso fora do escopo deve falhar fechado (`403`) | APROVADO / segregação |
| Usuário anônimo em rota protegida deve receber `401` | APROVADO / autenticação |

## 4. Matriz por módulo

Legenda:
- **C** = consultar
- **G** = gerir/criar/alterar/inativar
- **P** = operação própria/pessoal
- **—** = não autorizado
- **?** = decisão funcional ainda não homologada

| Módulo | Master | Administrador Regional | Gestor Agenda | Operador Portaria | Gestor Relatórios | Auditor | Usuário Comum | Escopo / Observação | Status |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| Autenticação / própria sessão | P | P | P | P | P | P | P | própria conta | APROVADO |
| Administração de contas de acesso | G | G | — | — | — | — | — | Master global; Admin somente sua Regional | APROVADO |
| Concessão/revogação de perfis técnicos | G | G | — | — | — | — | — | Master global; Admin não concede Master nem atua fora da Regional | APROVADO |
| Regionais | C/G | ? | — | — | — | — | — | alteração da própria estrutura Regional ainda sem regra formal para Admin | PENDENTE PMO |
| Administrações | C/G | ? | — | — | — | — | — | operação dentro da Regional é tecnicamente possível, mas não homologada | PENDENTE PMO |
| Setores | C/G | ? | — | — | — | — | — | idem | PENDENTE PMO |
| Casas de Oração | C/G | ? | — | — | — | — | — | responsável por Casa é vínculo funcional, não perfil técnico administrativo | PENDENTE PMO |
| Grupos de Trabalho | C/G | ? | ? | — | — | — | — | GTs são Regionais; regra de manutenção ainda não homologada | PENDENTE PMO |
| Membros | C/G | ? | ? | leitura mínima operacional | leitura minimizada | leitura de auditoria | própria identificação | dados pessoais exigem minimização e escopo | PENDENTE PMO |
| Funções | C/G | ? | — | — | — | — | — | catálogo institucional | PENDENTE PMO |
| Vínculos Funcionais | C/G | ? | ? | — | — | C quando necessário à auditoria | — | alteração de vínculo muda autoridade institucional | PENDENTE PMO |
| Locais | C/G | ? | ? | C operacional | C conforme relatório | — | C quando vinculado a evento visível | cadastro de local impacta eventos | PENDENTE PMO |
| Eventos | C/G | ? | G? | C operacional | C | C conforme auditoria | C conforme agenda/convocação | `GESTOR_AGENDA` existe, mas seu escopo CRUD ainda não foi formalizado | PENDENTE PMO |
| Séries recorrentes | C/G | ? | G? | — | C | C conforme auditoria | C conforme agenda | mesma dependência de Gestor Agenda | PENDENTE PMO |
| Convocações | C/G | ? | G? | C para operação do evento | C | C conforme auditoria | P própria | seleção/edição de convocados exige regra por escopo | PENDENTE PMO |
| Minha Agenda / RSVP | P | P | P | P | P | P | P | somente dados pertinentes ao próprio usuário | APROVADO |
| Portaria | C/G | ? | ? | G operacional | C consolidado quando autorizado | C auditoria | — | operação deve ficar limitada aos eventos autorizados | PARCIALMENTE APROVADO |
| Relatórios | C | C? | C? | somente necessidade operacional | C | C | somente próprios dados quando existir | celular oculto por padrão | PARCIALMENTE APROVADO |
| Auditoria | C | C? | — | — | — | C | — | auditoria já possui escopos Regional/Administração no modelo atual | PARCIALMENTE APROVADO |
| Meu Cadastro | P | P | P | P | P | P | P | dados próprios; alterações sensíveis podem exigir fluxo específico | APROVADO |

## 5. Divergências técnicas que precisam ser saneadas

### 5.1 Perfis técnicos x funções institucionais

O código atual ainda possui autorizações antigas baseadas em códigos de `funcoes` como:

- `OPERADOR_PORTARIA`;
- `GESTOR_RELATORIOS`;
- `AUDITOR_SISTEMA`.

Ao mesmo tempo, o modelo novo de contas introduziu perfis técnicos:

- `OPERADOR_PORTARIA_PERMANENTE`;
- `GESTOR_RELATORIOS`;
- `AUDITOR`.

Esses dois mecanismos não devem continuar competindo indefinidamente. O perfil técnico controla acesso ao sistema; o vínculo funcional representa a responsabilidade institucional. Quando ambos forem necessários, a regra deve exigir a combinação explicitamente, em vez de tratar um como substituto implícito do outro.

### 5.2 Cadastros institucionais

ACC-06 fecha acesso anônimo, mas autenticação não significa autorização. Até esta matriz ser homologada, nenhuma conta autenticada deve ser presumida administradora dos cadastros institucionais.

## 6. Decisões PMO necessárias antes da aplicação fina

1. O `ADMINISTRADOR_SISTEMA` pode gerir toda a estrutura institucional dentro de sua Regional ou apenas contas/acessos?
2. O `GESTOR_AGENDA` pode criar e alterar Eventos, Séries, Convocações e Locais? Em quais escopos?
3. Quem pode criar/alterar Membros, Funções e Vínculos Funcionais?
4. O Administrador Regional recebe acesso a Relatórios e Auditoria automaticamente ou precisa também dos perfis especializados?
5. Para Portaria, o perfil técnico permanente é suficiente ou o operador também precisa estar vinculado/autorizado para cada evento?
6. Qual nível de consulta institucional o `USUARIO_COMUM` deve ter além de Minha Agenda/RSVP/Meu Cadastro?

## 7. Regra de implementação após homologação

A aplicação deverá seguir três camadas:

1. **Autenticação:** sessão válida.
2. **Capacidade técnica:** perfil técnico compatível.
3. **Escopo institucional:** entidade alvo pertence a um escopo autorizado para a conta.

O frontend deve consumir as capacidades devolvidas pelo backend apenas para experiência de navegação. A decisão final permanece sempre no Worker.

## 8. Próximos passos técnicos

Após homologação desta matriz:

1. criar helpers centrais de resolução de escopo institucional;
2. aplicar autorização de leitura e escrita nas rotas;
3. retornar `403` de forma uniforme para acesso fora da competência;
4. expor capacidades consolidadas em `/auth/me`;
5. ocultar/mostrar módulos no frontend conforme capacidades;
6. adicionar testes negativos cruzados entre duas Regionais;
7. validar que nenhum endpoint permite bypass por chamada direta.
