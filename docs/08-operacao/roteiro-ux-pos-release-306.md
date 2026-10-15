# Plano de execução UX pós-release #306

**Estado:** planejamento, sem implementação de componentes, alterações de permissões ou deploy. Referência funcional: produção v1.1.0 build `6741936`, homologada 8/8. Base de trabalho: `develop`.

## Fontes canônicas

1. [Handoff S13 / Stitch](../10-planejamento-s13/s13-stitch-handoff.md): desenhar a nova UX a partir do produto funcional, não dos mockups antigos.
2. [Inventário de códigos](../inventario-codigos-telas.md): preservar códigos publicados, inclusive `AGD-ADM-016–059` e `AGD-SHR-001–005`.
3. [Auditoria pré-UX](./auditoria-codigos-telas-pre-ux.md): concluir cobertura das superfícies, sem reinventariar códigos existentes.
4. [Manual de usuários](./manual-usuarios.md): fluxos e permissões como referência operacional; corrigir texto conforme o código, não o contrário.

## Google Stitch — etapa central, obrigatória e anterior à implementação

O redesign **do zero** no Google Stitch é a etapa principal desta rodada, conforme `docs/10-planejamento-s13/s13-stitch-handoff.md`. Não reaproveitar mockups antigos como padrão obrigatório. Após identificar telas e códigos, enviar ao Stitch briefings por jornada com fluxos reais, permissões, problemas observados e requisitos mobile/desktop. Avaliar e aprovar propostas visuais **antes** de programar a nova interface.

**Metas transversais de UX:** eliminar rolagem horizontal desnecessária, especialmente nas tabelas Master; tornar cabeçalhos e identificadores visíveis durante a navegação; substituir listas extensas por filtros, pesquisa e seletores em cascata; destacar ações primárias, feedback e erros; melhorar legibilidade, contraste, acessibilidade e adaptação responsiva. Em telas genuinamente tabulares, preferir tabelas responsivas com colunas prioritárias e alternativas em cards, sem omitir dados ou ações.

**Fluxo por lote:** inventário/código → briefing Stitch → alternativas desktop e mobile → aprovação do responsável → implementação React/Tailwind em `develop` → revisão Codex/Copilot e CI → smoke Beta → autorização de release. Nenhuma alteração de regras de negócio ou de permissões decorrente apenas do layout.

## Ordem e gates

| Fase | Escopo | Issues | Gate de conclusão |
|---|---|---|---|
| 0 — Pré-Stitch | Rastrear telas, subtelas, modais, confirmações, estados CRUD, pai/perfil e códigos visíveis desktop/mobile; teste de unicidade | #247 | Inventário completo e aprovado; sem código duplicado nem renumeração |
| 1 — Stitch / Cadastros | Redesenhar Locais/Espaços, Casas, formulários e organização de informações; seleção Casa por Setor, Locais ordenados e organizador padrão | #242, #258, #241 | Aprovação **visual Stitch** mobile e desktop, depois smoke Beta com Master, gestor e usuário comum |
| 2 — Stitch / Agenda e Eventos | Redesenhar Minha Agenda, Calendário, Eventos, Séries e Convocações; jornada Evento → Convocação → Funções; filtro geográfico em cascata e criação inline | #231, #278 | Aprovação visual Stitch mobile/desktop e fluxos completos, RSVP, conflitos e séries em Beta |
| 3 — Stitch / Administração | Redesenhar contas, membros, vínculos Função → Membros, relatórios e telas amplas Master; tratar rolagem horizontal e mensagens de erro | #257, #241, #252 | Aprovação visual Stitch para desktop/mobile, smoke administrativo e acessibilidade |
| 4 — Arquitetura | Rotas navegáveis e lazy loading, após estabilização da navegação e análise de regressão | #276 | PR pequena, teste de permissão e navegação; rollback claro |
| 5 — Pós-UX | Botão seguro para backup do D1; avaliar relatórios de utilização de Locais/Espaços e arquitetura externa em ciclos independentes | #315, #300, #261 | Segurança, LGPD, restauração isolada e smoke específico |

## Regras de preservação

- Produção não recebe código de UX até aprovação dos protótipos, CI/revisão, homologação Beta e autorização de release.
- Priorizar telas mobile de operação e desktop administrativo sem introduzir permissões novas; verificar capabilities no backend.
- Nenhuma alteração de schema/migration apenas por aparência. Mudança funcional requer issue e testes dedicados.
- O `preflight` e o gate Worker → Pages para mesmo SHA já existem; não duplicar controles da #184.
- Manter `main` estável para os cadastros dos secretários. Usar `https://piedade-agenda-regional.pages.dev/` como URL oficial.
- Capturas finais do manual apenas depois da aprovação das telas no Stitch.
- O redesenho visual deve abranger **todas as superfícies inventariadas**, em ondas, e não somente as issues funcionais listadas; registrar cobertura Stitch por código de tela e situação de aprovação.

## Próxima ação concreta

Concluir o gate **fase 0 (#247)** e produzir o primeiro briefing para o **Google Stitch** sobre a jornada de cadastros, com alternativas visuais mobile/desktop que priorizem legibilidade e eliminação da rolagem horizontal. Registrar aprovações por código de tela antes de implementar componentes.
