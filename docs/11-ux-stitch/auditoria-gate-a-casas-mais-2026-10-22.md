# Auditoria preliminar Gate A — Casas de Oração e menu Mais

**Data:** 22/10/2026. **Base:** `develop` após merge documental #353. **Natureza:** documentação e rastreabilidade, não aceite final.

## Achados confirmados no repositório

1. **Casas de Oração:** a pasta `docs/11-ux-stitch/prototipos/lote-1/casas-de-oracao/` já contém `AGD-ADM-008-desktop.html`, `AGD-ADM-008-mobile.html`, `AGD-ADM-043-cadastro.html`, `AGD-ADM-044-edicao.html` e duas variantes `-referencia-main`. Logo, a pendência genérica “arquivar protótipos de Casas” na rastreabilidade anterior está desatualizada. Ainda faltam conferência integral de hashes/aceites e estados funcionais.
2. **Escolha do PO em 19/10:** conforme `DECISAO-VISUAL.md`, 008 desktop A/B idênticas, 008 mobile mantém A, 043 e 044 adotam versão B enxuta. O manifesto identifica SHA-256 das versões B e variantes principais de comparação; os arquivos 008 exigem referência imutável igualmente reconciliada.
3. **Menu Mais:** o README do pacote de Casas expressamente determina que seu protótipo fique separado até confirmar o código oficial. Não usar `AGD-ADM-041` como código de Mais: é código canônico do cadastro de Setor.
4. **Confronto funcional parcial:** em `apps/web/src/components/casas/CasasView.tsx`, os campos efetivos são `setorId`, `nome`, `codigo`, `ativo`; o filtro de Setor é aplicado no cliente; há ações de cadastro, edição e detalhes; sucesso de gravação depende de resposta da API. Não há evidência de que paginação do Stitch seja funcional neste componente. Portanto, a escolha visual de paginação em 008 mobile exige decisão funcional separada.
5. **Limites da auditoria:** a presença de HTMLs versionados não confirma identidade com a exportação original, fidelidade visual final, acessibilidade ou comportamento correto após implementação.

## Pendências concretas antes do aceite do PO

| ID | Superfície | Verificação exigida | Resultado atual |
|---|---|---|---|
| C1 | AGD-ADM-008 desktop | Conferir filtros, tabela sem rolagem horizontal da página, ações Detalhes/Editar e header | Pendente QA visual |
| C2 | AGD-ADM-008 mobile | Quebra de nomes longos, cards, ações e acessibilidade em 360/390/430 px | Pendente QA visual |
| C3 | AGD-ADM-043 cadastro B | Apenas Setor, Nome, Código opcional, Ativa e ações reais; corrigir cabeçalho/logo e dados fictícios | Pendente QA visual |
| C4 | AGD-ADM-044 edição B | Abrir a edição sem rolagem forçada ao topo, manter contexto e controles | Pendente QA visual e fluxo |
| C5 | Menu Mais mobile | Identificar referência e código canônico; grupos recolhíveis; itens segundo capabilities; sem busca inventada | Pendente evidência do protótipo |
| C6 | Transversal | Hash/origem, tokens compartilhados, ícones sem cruz, rodapé dinâmico, teclado/foco/zoom | Pendente QA transversal |
| C7 | AGD-ADM-008 mobile | Resolver divergência: decisão visual registra paginação, enquanto o handoff exige não introduzir paginação funcional | **Decisão de produto necessária** |

**Nota sobre C7:** paginação pode permanecer como ilustração no artefato arquivado, mas não deve ser implementada como função nova por mera referência Stitch. Exige definição e testes em PR funcional separada, se desejada.

## Recomendação

Tratar C1–C6 como checklist de correção e conferência final dos artefatos, com demonstração por variante e decisão expressa do PO. Escalar C7 para decisão funcional antes do Gate B. O **Gate A do lote 1 permanece aberto** e a autorização de implementação é independente.
