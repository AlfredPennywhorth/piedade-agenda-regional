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
