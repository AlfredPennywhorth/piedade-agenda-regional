# Setores — protótipos com alternância integrada (prévia derivada)

Arquivos **-unificado.html** são DERIVAÇÕES para revisão visual e técnica. Os oito arquivos em `originais/` são cópias byte a byte dos downloads Stitch recebidos, preservados para rastreabilidade.

## Operação
- Abrir cada `-unificado.html` num navegador; o botão flutuante “Tema claro/escuro” alterna os dois temas NO MESMO HTML.
- O tema persiste no navegador via localStorage; sem permissão de armazenamento, o controle continua funcional na página aberta.
- Os quatro arquivos partilham o mesmo mecanismo, incluído em cada HTML para prévia independente. Nenhuma instalação é necessária; o Tailwind CDN e fontes externas dos originais exigem internet.
- Alterações de cor e ajustes de contraste usam CSS de sobreposição. O layout, os campos e scripts originais de referência foram mantidos da versão clara.
- A tela desktop 007 possui botão original de tema com lógica insuficiente; ele foi ocultado na versão derivada e substituído por controle único funcional.

## Limites importantes
- O resultado é uma PRÉVIA, não a implementação final React/Tailwind nem uma aprovação visual automática.
- Diferenças estruturais entre Stitch claro e escuro não são transferidas mecanicamente: a estrutura base é clara; cores escuras são aplicadas sobre ela.
- Conteúdo ilustrativo como setor, nome de usuário, versão, ambiente e opções não deve gerar novas regras de produto.
- No app definitivo: tokens de temas globais, identidade institucional e logotipo aprovado; cabeçalho azul #102D55; versão/build/ambiente dinâmicos SOMENTE no rodapé; evitar rolagem horizontal; não duplicar tema por tela.
- Não incluir variante defeituosa de edição com filtros duplicados.
- Não altera develop, main, banco ou deploy.

## Publicação proposta
Arquivar `originais/` como material-fonte, e os quatro derivados em subpasta `unificados-em-avaliacao/` de `docs/11-ux-stitch/prototipos/lote-1/setores/`. Submeter PR documental à `develop` e aguardar CI/Codex e aprovação explícita de merge. O Gate A integral continua aberto.

