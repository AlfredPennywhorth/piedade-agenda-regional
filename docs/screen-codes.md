# Inventário de códigos de tela

Os códigos abaixo são estáveis e devem ser usados por QA, suporte e manutenção para identificar a superfície onde ocorreu um problema.

| Código | Nome funcional | Contexto | Rota / navegação | Componente principal |
|---|---|---|---|---|
| AGD-MOB-001 | Minha Agenda | Usuário / mobile-first | aba `agenda` | `AgendaView` |
| AGD-MOB-002 | Calendário | Usuário / mobile-first | aba `calendario` | `CalendarioView` |
| AGD-SHR-001 | Meu Cadastro | Responsivo dual | aba `cadastro` | `PerfilView` |
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
| AGD-MOB-003 | Avisos | Mobile-first | aba `avisos` | `NotificacoesControl` |
| AGD-MOB-004 | Portaria autenticada | Mobile-first | aba `portaria` | `PortariaView` |
| AGD-SHR-002 | Login | Responsivo dual | fluxo anônimo | `AuthView` |
| AGD-SHR-003 | Ativação de conta | Responsivo dual | `AuthView` com token | `AuthView` |
| AGD-SHR-004 | Recuperação de PIN | Responsivo dual | fluxo anônimo | `AuthView` |
| AGD-MOB-006 | Cadastro de Convidado | Mobile-first / público | `/c`, `/convidado` | `CadastroConvidadoView` |
| AGD-MOB-005 | Portaria Temporária | Mobile-first / público | `/portaria-operador`, `/o/:token` | `PortariaOperadorTemporarioView` |
| AGD-SHR-005 | Ciência de responsabilidade regional | Responsivo dual | gate autenticado | `ResponsabilidadeRegionalGate` |

## Regras

- Não reutilizar um código para outra superfície.
- Redesign visual não altera o código da tela.
- Novas telas devem receber código antes do merge.
- Modais recebem código próprio apenas quando forem tratados como superfície independente de suporte/QA.
