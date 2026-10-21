# Casas de Oração — Decisão visual e atualização de referências (19/10/2026)

## Deliberação do Product Owner

- **AGD-ADM-008 desktop:** versões A e B são idênticas, verificado SHA-256; manter versão já arquivada.
- **AGD-ADM-008 mobile:** manter versão A já arquivada; paginação é necessária como referência visual.
- **AGD-ADM-043 cadastro:** usar versão B, mais enxuta, sem painel lateral e conteúdo demonstrativo não solicitado.
- **AGD-ADM-044 edição:** usar versão B, removendo blocos demonstrativos e textos excessivos.

## Escopo do pacote

Este pacote contém somente os HTMLs B que devem substituir os correspondentes em `docs/11-ux-stitch/prototipos/lote-1/casas-de-oracao/` na branch documental proposta. Os arquivos são cópias exatas dos downloads do Google Stitch e devem permanecer sem edição; as versões anteriores ficam recuperáveis por meio do Git.

## Correções pendentes de UX

- Substituir no cabeçalho o texto fictício **“Operador Eclesiástico Regional”** pelo perfil/nível de acesso efetivo, respeitando permissões e o espaço disponível.
- Corrigir quebra de linha e truncamento de **“Agenda Regional SP”** e **“Congregação Cristã no Brasil”** no cabeçalho da AGD-ADM-043.
- Aplicar o **logotipo institucional já aprovado** (não copiar o ícone do Stitch).
- Nenhum elemento com cruz deve ser introduzido; preferir ícones institucionais neutros.
- Versão, build e ambiente devem vir dinamicamente da aplicação e constar somente no rodapé.
- Não implementar textos fictícios, campos, indicadores ou comportamentos não existentes na aplicação.

## Controle de mudanças

- Atualizar apenas as referências visuais **043** e **044**.
- Manter os arquivos **008 desktop** e **008 mobile** sem alteração.
- Não incluir o protótipo **Mais** na pasta de Casas de Oração; identificação ainda pendente.
- Validar CI e Codex na PR antes de qualquer merge; merge exige autorização separada do PO.
- **Não autoriza implementação React/Tailwind, migrações nem deploy**. O Gate A integral permanece aberto.

Ver `MANIFESTO-SHA256.json` para validação dos arquivos deste pacote.
