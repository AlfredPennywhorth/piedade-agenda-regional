# Inventário de códigos de tela — Agenda Regional SP

Fonte canônica atual: `apps/web/src/components/layout/MainLayout.tsx` (abas) e `App.tsx` (fluxos públicos). **Não renumerar códigos já publicados.**

## Telas principais (implantadas anteriormente)

| Código | Tela | Contexto |
|---|---|---|
| AGD-MOB-001 | Minha Agenda | Aba agenda |
| AGD-ADM-001 | Eventos | Aba eventos |
| AGD-ADM-002 | Séries | Aba series |
| AGD-MOB-002 | Calendário | Aba calendario |
| AGD-MOB-003 | Avisos | Aba avisos |
| AGD-SHR-001 | Meu Cadastro | Aba cadastro |
| AGD-MOB-004 | Portaria | Aba portaria |
| AGD-ADM-003 | Relatórios | Aba relatorios |
| AGD-ADM-004 | Auditoria | Aba auditoria |
| AGD-ADM-005 | Regionais | Aba regionais |
| AGD-ADM-006 | Administrações | Aba administracoes |
| AGD-ADM-007 | Setores | Aba setores |
| AGD-ADM-008 | Casas de Oração | Aba casas |
| AGD-ADM-009 | Grupos de Trabalho | Aba grupos-trabalho |
| AGD-ADM-010 | Membros | Aba membros |
| AGD-ADM-011 | Funções | Aba funcoes |
| AGD-ADM-012 | Vínculos funcionais | Aba vinculos-funcionais |
| AGD-ADM-013 | Locais | Aba locais |
| AGD-ADM-014 | Convocações | Aba convocacoes |
| AGD-ADM-015 | Contas e acessos | Aba acessos |
| AGD-MOB-005 | Operador de portaria temporário | Tela pública em App |
| AGD-MOB-006 | Cadastro de convidado | Tela pública em App |

## Subtelas — Eventos (primeira fatia da #247)

| Código | Subtela | Ação/estado | Pai |
|---|---|---|---|
| AGD-ADM-016 | Novo Evento | Criar | AGD-ADM-001 |
| AGD-ADM-017 | Editar Evento | Editar | AGD-ADM-001 |
| AGD-ADM-018 | Detalhes de Evento | Ver e administrar participantes nominais | AGD-ADM-001 |
| AGD-ADM-019 | Criar Local inline | Criar | AGD-ADM-016/017 |
| AGD-ADM-020 | Criar Espaço inline | Criar | AGD-ADM-016/017 |
| AGD-ADM-021 | Escolher abrangência da edição recorrente | Assistente | AGD-ADM-017 |
| AGD-ADM-022 | Confirmar alteração apenas desta ocorrência | Confirmação | AGD-ADM-021 |
| AGD-ADM-023 | Confirmar alteração desta e próximas ocorrências | Confirmação | AGD-ADM-021 |

## A completar

Subtelas de Séries, Convocações, Administração, Portaria, Relatórios, Meu Cadastro e demais módulos; diálogos de confirmação, fluxos públicos adicionais e variantes de componentes compartilhados. Inventariar código, rota/aba, superfície pai, perfil autorizado, ação, componente e estados antes de declarar #247 concluída.

## Subtelas — Séries e Convocações (segunda fatia da #247)

| Código | Subtela | Ação/estado | Pai |
|---|---|---|---|
| AGD-ADM-024 | Nova Série | Criar | AGD-ADM-002 |
| AGD-ADM-025 | Editar recorrência (formulário compartilhado) | Editar | AGD-ADM-002 ou AGD-ADM-001 |
| AGD-ADM-026 | Detalhes da Série | Consultar | AGD-ADM-002 |
| AGD-ADM-027 | Confirmar edição da Série | Confirmação | AGD-ADM-025 |
| AGD-ADM-028 | Inativar Série | Confirmação | AGD-ADM-002 |
| AGD-ADM-029 | Criar Local no formulário compartilhado de recorrência | Criar inline | AGD-ADM-024/025 |
| AGD-ADM-030 | Criar Espaço no formulário compartilhado de recorrência | Criar inline | AGD-ADM-024/025 |
| AGD-ADM-031 | Nova Convocação | Criar | AGD-ADM-014 |
| AGD-ADM-032 | Editar Rascunho de Convocação | Editar | AGD-ADM-014 |
| AGD-ADM-033 | Publicar Convocação | Confirmação | AGD-ADM-014 |
| AGD-ADM-034 | Cancelar Convocação | Confirmação | AGD-ADM-014 |

Nota: a numeração mantém todos os códigos de telas publicados previamente. Os identificadores aparecem discretamente na superfície secundária correspondente, além do código da aba pai.

### Regra de identidade funcional

Os códigos identificam a **operação/superfície**, não a trilha de navegação. O mesmo `SerieFormModal` ao editar uma recorrência em Séries **ou** em Eventos mantém `AGD-ADM-025`, e seus diálogos internos de criação de Local/Espaço mantêm `AGD-ADM-029/030`. A origem pode ser registrada separadamente como contexto, sem gerar códigos novos. Criar e Editar permanecem distintos (`024`/`025`). Não confundir com os formulários inline de Eventos (`019`/`020`), que são implementações diferentes e exigem análise funcional própria antes de eventual unificação.

## Subtelas — cadastros administrativos (terceira fatia da #247)

Os identificadores abaixo aplicam-se aos cartões de criação/edição (não modais) e ao modal de detalhes de Grupo de Trabalho. Permanecem visíveis em viewport móvel; o código da aba pai não é substituído.

| Código | Operação | Tela pai |
|---|---|---|
| AGD-ADM-035 | Membros — cadastrar manualmente | AGD-ADM-010 |
| AGD-ADM-036 | Membros — editar | AGD-ADM-010 |
| AGD-ADM-048 | Membros — localizar e finalizar pré-cadastro ministerial | AGD-ADM-010 |
| AGD-ADM-037 | Regionais — cadastrar | AGD-ADM-005 |
| AGD-ADM-038 | Regionais — editar | AGD-ADM-005 |
| AGD-ADM-039 | Administrações — cadastrar | AGD-ADM-006 |
| AGD-ADM-040 | Administrações — editar | AGD-ADM-006 |
| AGD-ADM-041 | Setores — cadastrar | AGD-ADM-007 |
| AGD-ADM-042 | Setores — editar | AGD-ADM-007 |
| AGD-ADM-043 | Casas de Oração — cadastrar | AGD-ADM-008 |
| AGD-ADM-044 | Casas de Oração — editar | AGD-ADM-008 |
| AGD-ADM-045 | Grupos de Trabalho — cadastrar | AGD-ADM-009 |
| AGD-ADM-046 | Grupos de Trabalho — editar | AGD-ADM-009 |
| AGD-ADM-047 | Grupos de Trabalho — detalhes | AGD-ADM-009 |

**Pendências:** mapear estados próprios de pré-cadastro de Membros, inativação/exclusão e seus diálogos, fluxos adicionais e demais módulos. Não declarar a issue #247 concluída com esta PR.


O formulário de Membros possui operações distintas: `AGD-ADM-035` no cadastro manual, `AGD-ADM-036` na edição e `AGD-ADM-048` na finalização de pré-cadastro. Os códigos acompanham a escolha do modo; a identificação não depende da rota de origem.
