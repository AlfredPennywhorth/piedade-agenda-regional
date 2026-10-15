# Plano de execução UX pós-release #306

**Estado:** planejamento, sem implementação de componentes, alterações de permissões ou deploy. Referência funcional: produção v1.1.0 build `6741936`, homologada 8/8. Base de trabalho: `develop`.

## Fontes canônicas

1. [Handoff S13 / Stitch](../10-planejamento-s13/s13-stitch-handoff.md): desenhar a nova UX a partir do produto funcional, não dos mockups antigos.
2. [Inventário de códigos](../inventario-codigos-telas.md): preservar códigos publicados, inclusive `AGD-ADM-016–059` e `AGD-SHR-001–005`.
3. [Auditoria pré-UX](./auditoria-codigos-telas-pre-ux.md): levantar cobertura preliminar antes do Stitch; concluir cobertura exaustiva e testes visuais após implementação, sem reinventariar códigos existentes.
4. [Manual de usuários](./manual-usuarios.md): fluxos e permissões como referência operacional; corrigir texto conforme o código, não o contrário.

## Google Stitch — etapa central, obrigatória e anterior à implementação

O redesign **do zero** no Google Stitch é a etapa principal desta rodada, conforme `docs/10-planejamento-s13/s13-stitch-handoff.md`. Não reaproveitar mockups antigos como padrão obrigatório. Após identificar telas e códigos, enviar ao Stitch briefings por jornada com fluxos reais, permissões, problemas observados e requisitos mobile/desktop. O **PO (Product Owner, responsável pelo produto)** deve aprovar explicitamente cada lote de propostas visuais, com registro da decisão e dos códigos de tela, **antes** de programar a nova interface. Revisão por gestor técnico ou responsável pelo lote não substitui o aceite do PO.

**Metas transversais de UX:** eliminar rolagem horizontal desnecessária, especialmente nas tabelas Master; tornar cabeçalhos e identificadores visíveis durante a navegação; substituir listas extensas por filtros, pesquisa e seletores em cascata; destacar ações primárias, feedback e erros; melhorar legibilidade, contraste, acessibilidade e adaptação responsiva. Em telas genuinamente tabulares, preferir tabelas responsivas com colunas prioritárias e alternativas em cards, sem omitir dados ou ações.

**Fluxo por lote e gates obrigatórios:** inventário preliminar/códigos existentes (#247, sem exigir fechamento exaustivo) → briefing Stitch → alternativas desktop e mobile → **aprovação explícita do PO registrada por lote e códigos de tela** → somente então implementação React/Tailwind em `develop` (S13.03) → revisão Codex/Copilot e CI → smoke Beta → auditoria final de códigos/visibilidade da #247 para as telas implementadas → autorização expressa de release. Reprovação ou ausência de aprovação do PO bloqueia implementação e Beta, mas não bloqueia a elaboração de propostas no Stitch. Nenhuma alteração de regras de negócio ou de permissões decorrente apenas do layout.

## Ordem e gates

**Regra de aceite por lote:** o Gate A é a proposta Stitch (mobile/desktop segundo classificação canônica), inventário rastreável e **aprovação explícita do PO**, registrada por lote e código. Sem Gate A, não começa S13.03, nem qualquer mudança de UX em `develop`/Beta. O Gate B ocorre **depois** da implementação aprovada: CI, revisão, smoke Beta e verificação dos estados e permissões. A aprovação de um lote não autoriza os demais.

| Fase / lote Stitch | Superfícies canônicas incluídas (cobertura obrigatória) | Issues / foco | Gates |
|---|---|---|---|
| 0 — Inventário preliminar | Todas as superfícies da matriz S13 e seus códigos já existentes; modais/estados conhecidos e lacunas | #247 | Mapa preliminar rastreável; não exigir conclusão exaustiva da #247 para iniciar Stitch |
| 1 — Cadastros e estrutura | **Regionais, Administrações, Setores, Casas, Grupos de Trabalho, Locais** (incluindo Espaços e formulários/subfluxos correspondentes) | #242, #258, #241; cascatas, ordenação e tabelas | Gate A: aceite PO de todas as superfícies deste lote; Gate B: CI/revisão e smoke Beta por perfis |
| 2 — Agenda e convocações | **Minha Agenda, Calendário, Eventos, Séries, Convocações** (incluindo detalhe, RSVP, conflitos, QR e subfluxos existentes) | #231, #278; jornada Evento → Convocação → Funções | Gate A: aceite PO deste lote; Gate B: CI/revisão, testes de fluxos e smoke Beta |
| 3 — Pessoas, acessos e gestão | **Membros, Funções, Vínculos, Acessos, Relatórios, Auditoria, Alerta global de recuperação de PIN** | #257, #241, #252; Master, tabelas e autorização interna | Gate A: aceite PO deste lote; Gate B: CI/revisão, smoke administrativo, acessibilidade e capabilities |
| 4 — Operação e públicos | **Avisos, Portaria autenticada, Portaria temporária, Cadastro de convidado** | Preferências, QR, check-in, fluxos por token e estados excepcionais | Gate A: aceite PO deste lote; Gate B: CI/revisão e smoke mobile, tokens e permissões |
| 5 — Conta e gates de sessão | **Meu Cadastro, Login, Ativação de conta, Recuperação de PIN, Ciência de responsabilidade regional** | Segurança e clareza de autenticação, PIN e ciência obrigatória | Gate A: aceite PO deste lote; Gate B: CI/revisão, smoke responsivo, bloqueios e recuperação |
| 6 — Arquitetura | Rotas navegáveis e lazy loading, **após** estabilização dos lotes e análise de regressão | #276 | PR independente, testes de navegação/permissão e rollback claro; não contornar Gate A de alterações visuais |
| 7 — Pós-UX | Backup seguro do D1; relatórios de utilização de Locais/Espaços e arquitetura externa em ciclos independentes | #315, #300, #261 | Segurança, LGPD, restauração isolada e smoke específico; mudança visual adicional exige Gate A próprio |

**Conferência de cobertura:** os lotes 1–5 atribuem, sem duplicidade, todas as **27 superfícies** listadas na matriz canônica de `s13-stitch-handoff.md`: 6 de estrutura, 5 de agenda, 7 de administração/pessoas, 4 de operação e 5 de conta/sessão. Subtelas, modais, confirmações, estados de carregamento/erro/vazio/acesso negado, navegação e interações condicionais acompanham a superfície-mãe; superfícies independentes descobertas na #247 recebem código estável, lote e Gate A do PO antes de implementação. A evolução de Avisos (`PARCIAL`) não autoriza criar funcionalidades fora do escopo funcional aprovado.

**Controle de aprovação e encerramento:** registrar para cada superfície `código existente | nome | lote | protótipo mobile/desktop | estados/subfluxos | decisão do PO e referência | CI/revisão | smoke Beta | auditoria final #247`. Nenhum lote pode ser marcado como aprovado apenas por aceite técnico. A passagem à fase 6 ou a um release global de UX requer os Gates A e B de **todos os lotes 1–5**; releases parciais, se autorizados explicitamente pelo PO, devem declarar quais lotes aprovados estão incluídos e não presumir cobertura dos restantes.

## Regras de preservação

- **Nem `develop`/Beta nem produção recebem implementação de UX antes da aprovação explícita pelo PO das propostas Stitch de cada lote.** Produção ainda depende de CI/revisão, homologação Beta, auditoria final aplicável e autorização de release.
- Priorizar telas mobile de operação e desktop administrativo sem introduzir permissões novas; verificar capabilities no backend.
- Nenhuma alteração de schema/migration apenas por aparência. Mudança funcional requer issue e testes dedicados.
- O `preflight` e o gate Worker → Pages para mesmo SHA já existem; não duplicar controles da #184.
- Manter `main` estável para os cadastros dos secretários. Usar `https://piedade-agenda-regional.pages.dev/` como URL oficial.
- Capturas finais do manual apenas depois da aprovação das telas no Stitch.
- O redesenho visual deve abranger **todas as superfícies inventariadas**, em ondas, e não somente as issues funcionais listadas; registrar cobertura Stitch por código de tela e situação de aprovação.

## Próxima ação concreta

Executar a **auditoria preliminar da fase 0 (#247), sem exigir o fechamento da issue**, e produzir o primeiro briefing para o **Google Stitch** sobre a jornada de cadastros, com alternativas visuais mobile/desktop que priorizem legibilidade e eliminação da rolagem horizontal. Solicitar e registrar aprovação **explícita do PO, único aprovador obrigatório da proposta UX**, por lote/códigos antes de implementar qualquer componente, inclusive em Beta. Completar a auditoria exaustiva e os testes de visibilidade da #247 após a implementação aprovada.
