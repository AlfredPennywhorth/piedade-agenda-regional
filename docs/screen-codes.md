# Inventário de códigos de tela

Os códigos abaixo são estáveis e devem ser usados por QA, suporte e manutenção para identificar a superfície onde ocorreu um problema.

| Código | Nome funcional | Contexto | Rota / navegação | Componente principal |
|---|---|---|---|---|
| AGD-MOB-001 | Minha Agenda | Usuário / mobile-first | aba `agenda` | `AgendaView` |
| AGD-MOB-002 | Calendário | Usuário / mobile-first | aba `calendario` | `CalendarioView` |
| AGD-MOB-003 | Meu Cadastro | Usuário / mobile-first | aba `cadastro` | `PerfilView` |
| AGD-ADM-001 | Gestão de Eventos | Administrativo | aba `eventos` | `EventosView` |
| AGD-ADM-002 | Séries | Administrativo | aba `series` | `SeriesView` |
| AGD-ADM-003 | Relatórios | Administrativo | aba `relatorios` | `RelatoriosView` |
| AGD-ADM-004 | Auditoria | Administrativo | aba `auditoria` | `AuditoriaView` |
| AGD-ADM-005 | Regionais | Administrativo | aba `regionais` | `RegionaisView` |
| AGD-ADM-006 | Administrações | Administrativo | aba `administracoes` | `AdministracoesView` |
| AGD-ADM-007 | Setores | Administrativo | aba `setores` | `SetoresView` |
| AGD-ADM-008 | Casas de Oração | Administrativo | aba `casas` | `CasasView` |
| AGD-ADM-009 | Grupos de Trabalho | Administrativo | aba `grupos-trabalho` | `GruposTrabalhoView` |
| AGD-ADM-010 | Membros | Administrativo | aba `membros` | `MembrosView` |
| AGD-ADM-011 | Funções | Administrativo | aba `funcoes` | `FuncoesView` |
| AGD-ADM-012 | Vínculos Funcionais | Administrativo | aba `vinculos-funcionais` | `VinculosFuncionaisView` |
| AGD-ADM-013 | Locais | Administrativo | aba `locais` | `LocaisView` |
| AGD-ADM-014 | Convocações | Administrativo | aba `convocacoes` | `ConvocacoesView` |
| AGD-ADM-015 | Contas e Acessos | Administrativo | aba `acessos` | `ContasAcessoView` |
| AGD-SHR-001 | Avisos | Compartilhado | aba `avisos` | `NotificacoesControl` |
| AGD-SHR-002 | Portaria | Compartilhado | aba `portaria` | `PortariaView` |
| AGD-SHR-003 | Autenticação / Ativação | Compartilhado | entrada autenticada | `AuthView` |
| AGD-SHR-004 | Cadastro de Convidado | Compartilhado / público | `/c`, `/convidado` | `CadastroConvidadoView` |
| AGD-SHR-005 | Portaria Temporária | Compartilhado / público | `/portaria-operador`, `/o/:token` | `PortariaOperadorTemporarioView` |

## Regras

- Não reutilizar um código para outra superfície.
- Redesign visual não altera o código da tela.
- Novas telas devem receber código antes do merge.
- Modais recebem código próprio apenas quando forem tratados como superfície independente de suporte/QA.
