# Gate A — aceite visual e início do Gate B (24/10/2026)

Decisão do PO: aprovadas as referências visuais das seis telas da rodada cromática: AGD-ADM-047, 057, 008 mobile, 013 desktop, 055 e 058. O aceite final da AGD-ADM-013 refere-se à imagem de correção de contraste de texto escuro sobre tabela clara. As outras cinco telas já haviam sido aceitas na conversa. Este aceite visual **não** aprova automaticamente funcionalidades, responsividade, fidelidade de dados ou conversão integral do lote.

## Gate B — sequência segura

1. Implementar por componente React existente, sem copiar HTML Stitch e mantendo identidade institucional.
2. Preservar permissões, chamadas API, fluxos, filtros, dados, comportamento e acessibilidade.
3. Lote inicial: somente AGD-ADM-013 em `LocaisView.tsx`, com contraste e botão primário; não altera regras, formulários ou endpoints.
4. Antes de outros módulos: CI, Codex, smoke Beta desktop/mobile e aceite funcional do PO.
5. Implementar subsequentes AGD-ADM-055/057/058, AGD-ADM-047 e AGD-ADM-008 em PRs separados para reduzir risco.
6. `main` e produção dependem de aprovação explícita do PO.

A aprovação do Gate A refere-se à direção visual destas seis referências, não ao encerramento automático de outros itens condicionados da matriz do lote 1.
