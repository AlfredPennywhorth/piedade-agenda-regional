# Stitch — Regionais e Administrações: aceite visual condicionado

**Decisão expressa do PO — 16/10/2026.** O Product Owner aprovou a aparência do último lote de **oito propostas**, condicionado à preservação da interface nativa e às ressalvas documentadas. Aceite estético não homologa HTML/JavaScript demonstrativo, backend, dados, permissões, responsividade executada nem autoriza implementação ou deploy.

| Código | Proposta recebida | Decisão |
|---|---|---|
| `AGD-ADM-005` | Regionais — listagem desktop | Aprovada visualmente com ressalvas |
| `AGD-ADM-005` | Regionais — listagem mobile | Aprovada visualmente com ressalvas |
| `AGD-ADM-037` | Nova Regional | Aprovada visualmente com ressalvas |
| `AGD-ADM-038` | Editar Regional | Aprovada visualmente com ressalvas |
| `AGD-ADM-006` | Administrações — listagem desktop | Aprovada visualmente com ressalvas |
| `AGD-ADM-006` | Administrações — listagem mobile | Aprovada visualmente com ressalvas |
| `AGD-ADM-039` | Nova Administração | Aprovada visualmente com ressalvas |
| `AGD-ADM-040` | Editar Administração | Aprovada visualmente com ressalvas |

## Precedência funcional e ressalvas
- Fonte funcional: `develop`, `docs/inventario-codigos-telas.md`, componentes reais e permissões de API. Prints nativos enviados pelo PO precedem quaisquer dados, textos ou ações inventados pelo Stitch.
- **Regionais:** nome obrigatório; código opcional; ativo/inativo. **Administrações:** Regional obrigatória, nome obrigatório, código opcional, ativo/inativo. Preservar ações e acesso conforme capabilities reais.
- Exemplos fictícios de dados de usuário (nomes de registros, códigos de negócio, datas, totais) são apenas *placeholders visuais*: nunca semear, publicar ou usar como requisitos. Regional São Paulo é a única Regional inicialmente confirmada na base deste projeto; opções de seletores reais vêm da API, não de arrays HTML do Stitch.
- **Não desconsiderar** invenções que alterem **rótulos, títulos, legendas nativas**, opções/semântica de filtros, campos, regras, fluxos, permissões ou ações. Rejeitar status adicional «Em Homologação», códigos de tela inventados, obrigatoriedade fictícia, alegações de homologação/sincronização/validade jurídica sem base e botões novos de exportação/auditoria.
- Simulações JS (cancelar, salvar, recarregar e estados) não são base técnica da aplicação. Corrigir comportamentos reais na implementação autorizada, usando React existente, sem copiar scripts/CDN/HTML literalmente.
- Preservar navegação canônica, código AGD da operação, contraste, zoom, quebra de textos, cartões mobile sem rolagem horizontal; environment/version/build dinâmicos **somente no rodapé**.
- Tema escuro deve reutilizar os tokens globais da primeira remessa e `docs/11-ux-stitch/DESIGN.md`, **sem exigir duplicação de cada tela no Stitch**.

## Rastreabilidade
Os oito HTML foram apresentados no histórico desta conversa em 16/10/2026, após envio dos prints nativos. **Arquivamento imutável dos originais de Regionais/Administrações e hashes ainda precisa ser confirmado**: este handoff não afirma que os binários de protótipo estejam versionados nesta PR.

**Gate:** direção visual aceita com condições; Gate A integral do lote 1 não encerrado; nenhuma implementação, deploy, merge ou release autorizados por este documento.
