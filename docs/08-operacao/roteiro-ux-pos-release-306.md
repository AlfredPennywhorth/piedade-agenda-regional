# Plano de execução UX pós-release #306

**Estado:** planejamento, sem implementação de componentes, alterações de permissões ou deploy. Referência funcional: produção v1.1.0 build `6741936`, homologada 8/8. Base de trabalho: `develop`.

## Fontes canônicas

1. [Handoff S13 / Stitch](../10-planejamento-s13/s13-stitch-handoff.md): desenhar a nova UX a partir do produto funcional, não dos mockups antigos.
2. [Inventário de códigos](../inventario-codigos-telas.md): preservar códigos publicados, inclusive `AGD-ADM-016–059` e `AGD-SHR-001–005`.
3. [Auditoria pré-UX](./auditoria-codigos-telas-pre-ux.md): levantar cobertura preliminar antes do Stitch; concluir cobertura exaustiva e testes visuais após implementação, sem reinventariar códigos existentes.
4. [Manual de usuários](./manual-usuarios.md): fluxos e permissões como referência operacional; corrigir texto conforme o código, não o contrário.

## Google Stitch — etapa central, obrigatória e anterior à implementação

O redesign **do zero** no Google Stitch é a etapa principal desta rodada, conforme `docs/10-planejamento-s13/s13-stitch-handoff.md`. Não reaproveitar mockups antigos como padrão obrigatório. Após identificar telas e códigos, enviar ao Stitch briefings por jornada com fluxos reais, permissões, problemas observados e requisitos mobile/desktop. Avaliar e aprovar propostas visuais **antes** de programar a nova interface.

**Metas transversais de UX:** eliminar rolagem horizontal desnecessária, especialmente nas tabelas Master; tornar cabeçalhos e identificadores visíveis durante a navegação; substituir listas extensas por filtros, pesquisa e seletores em cascata; destacar ações primárias, feedback e erros; melhorar legibilidade, contraste, acessibilidade e adaptação responsiva. Em telas genuinamente tabulares, preferir tabelas responsivas com colunas prioritárias e alternativas em cards, sem omitir dados ou ações.

**Fluxo por lote e gates obrigatórios:** inventário preliminar/códigos existentes (#247, sem exigir fechamento exaustivo) → briefing Stitch → alternativas desktop e mobile → **aprovação explícita do PO registrada por lote e códigos de tela** → somente então implementação React/Tailwind em `develop` (S13.03) → revisão Codex/Copilot e CI → smoke Beta → auditoria final de códigos/visibilidade da #247 para as telas implementadas → autorização expressa de release. Reprovação ou ausência de aprovação do PO bloqueia implementação e Beta, mas não bloqueia a elaboração de propostas no Stitch. Nenhuma alteração de regras de negócio ou de permissões decorrente apenas do layout.

## Ordem e gates

| Fase | Escopo | Issues | Gate de conclusão |
|---|---|---|---|
| 0 — Pré-Stitch (parcial) | Mapear superfícies conhecidas, códigos existentes, perfis, estados e lacunas evidentes, sem impedir o desenho de superfícies ainda não concluídas | #247 | Inventário preliminar rastreável; pendências exaustivas documentadas, sem exigir encerramento da #247 |
| 1 — Stitch / Cadastros | Redesenhar Locais/Espaços, Casas, formulários e organização de informações; seleção Casa por Setor, Locais ordenados e organizador padrão | #242, #258, #241 | **Gate A:** proposta Stitch mobile/desktop e aprovação explícita do PO registrada antes de qualquer código; **Gate B:** somente após Gate A, implementação, CI/revisão e smoke Beta com Master, gestor e usuário comum |
| 2 — Stitch / Agenda e Eventos | Redesenhar Minha Agenda, Calendário, Eventos, Séries e Convocações; jornada Evento → Convocação → Funções; filtro geográfico em cascata e criação inline | #231, #278 | **Gate A:** aprovação explícita do PO para propostas Stitch mobile/desktop; **Gate B:** só após aprovação, implementação e testes de fluxos, RSVP, conflitos e séries em Beta |
| 3 — Stitch / Administração | Redesenhar contas, membros, vínculos Função → Membros, relatórios e telas amplas Master; tratar rolagem horizontal e mensagens de erro | #257, #241, #252 | **Gate A:** aprovação explícita do PO para Stitch desktop/mobile; **Gate B:** somente depois, implementação, smoke administrativo e acessibilidade |
| 4 — Arquitetura | Rotas navegáveis e lazy loading, após estabilização da navegação e análise de regressão | #276 | PR pequena, teste de permissão e navegação; rollback claro |
| 5 — Pós-UX | Botão seguro para backup do D1; avaliar relatórios de utilização de Locais/Espaços e arquitetura externa em ciclos independentes | #315, #300, #261 | Segurança, LGPD, restauração isolada e smoke específico |

## Regras de preservação

- **Nem `develop`/Beta nem produção recebem implementação de UX antes da aprovação explícita pelo PO das propostas Stitch de cada lote.** Produção ainda depende de CI/revisão, homologação Beta, auditoria final aplicável e autorização de release.
- Priorizar telas mobile de operação e desktop administrativo sem introduzir permissões novas; verificar capabilities no backend.
- Nenhuma alteração de schema/migration apenas por aparência. Mudança funcional requer issue e testes dedicados.
- O `preflight` e o gate Worker → Pages para mesmo SHA já existem; não duplicar controles da #184.
- Manter `main` estável para os cadastros dos secretários. Usar `https://piedade-agenda-regional.pages.dev/` como URL oficial.
- Capturas finais do manual apenas depois da aprovação das telas no Stitch.
- O redesenho visual deve abranger **todas as superfícies inventariadas**, em ondas, e não somente as issues funcionais listadas; registrar cobertura Stitch por código de tela e situação de aprovação.

## Próxima ação concreta

Executar a **auditoria preliminar da fase 0 (#247), sem exigir o fechamento da issue**, e produzir o primeiro briefing para o **Google Stitch** sobre a jornada de cadastros, com alternativas visuais mobile/desktop que priorizem legibilidade e eliminação da rolagem horizontal. Solicitar e registrar aprovação **explícita do PO** por lote/códigos antes de implementar qualquer componente, inclusive em Beta. Completar a auditoria exaustiva e os testes de visibilidade da #247 após a implementação aprovada.
