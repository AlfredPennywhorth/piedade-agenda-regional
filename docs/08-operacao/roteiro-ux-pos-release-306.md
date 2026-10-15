# Plano de execução UX pós-release #306

**Estado:** planejamento, sem implementação de componentes, alterações de permissões ou deploy. Referência funcional: produção v1.1.0 build `6741936`, homologada 8/8. Base de trabalho: `develop`.

## Fontes canônicas

1. [Handoff S13 / Stitch](../10-planejamento-s13/s13-stitch-handoff.md): desenhar a nova UX a partir do produto funcional, não dos mockups antigos.
2. [Inventário de códigos](../inventario-codigos-telas.md): preservar códigos publicados, inclusive `AGD-ADM-016–059` e `AGD-SHR-001–005`.
3. [Auditoria pré-UX](./auditoria-codigos-telas-pre-ux.md): concluir cobertura das superfícies, sem reinventariar códigos existentes.
4. [Manual de usuários](./manual-usuarios.md): fluxos e permissões como referência operacional; corrigir texto conforme o código, não o contrário.

## Ordem e gates

| Fase | Escopo | Issues | Gate de conclusão |
|---|---|---|---|
| 0 — Pré-UX | Rastrear telas, subtelas, modais, confirmações, estados CRUD, parent/role e códigos visíveis desktop/mobile; teste de unicidade | #247 | Inventário completo e aprovado; sem código duplicado nem renumeração |
| 1 — Jornada de cadastro | Locais/Espaços, seleção Casa por Setor, ordenação de Locais, organizador inicial autenticado e permissões por escopo | #242, #258 | Smoke beta com Master, gestor e usuário comum; não alterar autorização |
| 2 — Eventos e convocação | Fluxo contínuo Evento → Convocação → Funções; escopo geográfico em cascata; série/evento e criação inline | #231, #278 | Fluxos completos, confirmação de RSVP, conflito e série em beta |
| 3 — Administração | Vínculos Função → Membros, rolagem horizontal/desktop Master, mensagem de erro em cancelamento concorrente | #257, #241, #252 | Smoke administrativo e acessibilidade mobile/desktop |
| 4 — Arquitetura | Rotas navegáveis e lazy loading, após estabilização da navegação e análise de regressão | #276 | PR pequena, teste de permissão e navegação; rollback claro |
| 5 — Pós-UX | Botão seguro para backup do D1; avaliar relatórios de utilização de Locais/Espaços e arquitetura externa em ciclos independentes | #315, #300, #261 | Segurança, LGPD, restauração isolada e smoke específico |

## Regras de preservação

- Produção não recebe código de UX até aprovação dos protótipos, CI/revisão, homologação Beta e autorização de release.
- Priorizar telas mobile de operação e desktop administrativo sem introduzir permissões novas; verificar capabilities no backend.
- Nenhuma alteração de schema/migration apenas por aparência. Mudança funcional requer issue e testes dedicados.
- O `preflight` e o gate Worker → Pages para mesmo SHA já existem; não duplicar controles da #184.
- Manter `main` estável para os cadastros dos secretários. Usar `https://piedade-agenda-regional.pages.dev/` como URL oficial.
- Capturas finais do manual apenas depois da aprovação das telas no Stitch.

## Próxima ação concreta

Concluir o gate **fase 0 (#247)**, começando pelo confronto do inventário atual com componentes de Séries, Convocações, Portaria, Relatórios e Meu Cadastro. Registrar apenas lacunas reais; executar teste de unicidade e visibilidade antes de submeter qualquer tela ao Stitch.
