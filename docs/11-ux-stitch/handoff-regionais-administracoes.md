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

## Decisão complementar do PO — 24/10/2026 — Regionais

**Layouts de Regionais aprovados quanto à direção visual**, com duas ressalvas expressas e bloqueadoras do aceite final:

1. **Informações extras nos protótipos:** remover ou não implementar campos, indicadores, contagens, filtros ou dados de negócio que não estejam respaldados no contrato e na base real. A implementação atual de `RegionaisView.tsx` expõe `id`, `nome`, `codigo`, `ativo` e metadados técnicos `createdAt`/`updatedAt`, mas os campos efetivos de cadastro são **nome obrigatório, código opcional e ativo/inativo**. Metadados internos não autorizam criar campos editáveis, métricas ou status artificiais. Todo conteúdo extra deve ser inventariado por tela (005, 037 e 038) e confrontado com backend antes da implementação.
2. **Responsividade da listagem AGD-ADM-005 mobile:** **não aprovada**. Alinhar a composição à proposta aprovada de Setores em mobile: cartões legíveis sem truncar nomes, informações reais, ações acessíveis, sem rolagem horizontal, sem navegação inferior sobrepondo registros, zoom/teclado operáveis. Preservar a identidade institucional e o logotipo aprovado.

A **aprovação do layout não abrange a responsividade mobile** nem a existência das informações adicionais. Somente após corrigir essas ressalvas e conferir as versões desktop/mobile, solicitar aceite final do PO. Não alterar os arquivos Stitch originais; produzir derivações identificadas, se necessário. A presente decisão **não autoriza React, migrações, mudanças na base, deploy nem produção**.

## Decisão complementar do PO — 24/10/2026 — Administrações

O PO **aprovou os layouts das telas de Administrações**, com as **mesmas ressalvas já registradas para Regionais**:

- **AGD-ADM-006** (listagem desktop/mobile), **AGD-ADM-039** (cadastro) e **AGD-ADM-040** (edição): direção visual aprovada, porém **responsividade mobile ainda não aprovada**. Ajustar a experiência mobile ao padrão visual previamente aceito para Setores (cards legíveis sem truncamento de nomes, ações reais acessíveis, sem rolagem horizontal, navegação que não encubra o último registro).
- **Não transportar informações adicionais que não existem na base ou no contrato real**: descartar indicadores, datas, quantidades, status artificiais, filtros e campos fictícios do Stitch. Campos funcionais já documentados para Administração: Regional obrigatória, nome obrigatório, código opcional e ativo/inativo; confrontar outros elementos com a API e interface real antes de especificar implementação.
- **Preservar o logotipo institucional aprovado** e identidade visual comum em ambas as temáticas.
- Aceite estético **não** autoriza alterações no banco, implementação React, merge, deploy ou liberação da produção. Registrar correções como pendências do Gate A e solicitar nova validação mobile.

## Homologação do tema escuro pelo PO — 24/10/2026

**Aprovadas as versões escuras de Regionais e de Administrações quanto a cores e layout.** Permanecem as ressalvas anteriores relativas a dados reais, filtros e responsividade mobile; este aceite não autoriza implementação/deploy nem encerra Gate A integral.
