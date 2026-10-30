# Gate B — Regionais e Administrações

## Decisão e escopo

Em 30/10/2026, o PO aprovou as referências de AGD-ADM-005/037/038 e AGD-ADM-006/039/040 e dispensou nova geração de telas para aprovação. O registro está nos PRs documentais #363 (commit `9c049c3`) e #364 (`69c28a6`). Após esclarecer que a PR de implementação ainda não existia, o PO autorizou prosseguir com o desenvolvimento e a abertura de uma PR independente para `develop`.

Esta entrega não depende do merge dos PRs documentais e não os integra. Não autoriza merge, deploy, mudança em `main` ou alteração de D1. As dívidas #425, #426, #431 e #417 permanecem independentes e sem alteração.

## Implementação

- **005/006:** os mesmos registros são apresentados como cards em telas estreitas e tabela em desktop, sem duplicar ações ou dados no DOM. Nomes e códigos longos quebram linha; Detalhes/Editar mantêm alvos de toque de pelo menos 44px.
- **006:** filtro por Regional ocupa a largura disponível, sem excedê-la com opções extensas. Mantém filtro e contagem reais. Detalhes exibem o nome da Regional, com alternativa amigável caso ela não esteja disponível, sem expor o UUID.
- **037/038/039/040:** campos e validações existentes preservados; controles e ações se reorganizam no mobile. Abertura direciona foco ao primeiro campo após carregar os dados e fechamento/salvamento retorna ao acionador correspondente, inclusive após recarregar a lista.
- **Detalhes:** diálogo nativo com título acessível, Escape, contenção de foco e altura limitada; textos longos quebram e conteúdo extenso rola verticalmente. A ajuda contextual permanece disponível.
- **Composição completa:** os componentes continuam sob o `MainLayout` existente, preservando cabeçalho azul, logotipo, navegação, identificação real da aplicação e ajuda. Nenhum cabeçalho duplicado foi criado nos componentes.
- Não foram adicionados busca, filtros/status novos, paginação, contagens de congregações, menu extra, Unidade Federativa ou textos fictícios do Stitch. Não há mudança de API, schemas, banco ou permissões (escrita de Regionais continua restrita ao Master; Administrações mantém o escopo autorizado).

## Verificação

Os testes de navegador usam os componentes reais dentro de `MainLayout`, com API interceptada e dados fictícios de até 255 caracteres, sem operações em Beta/produção. Cobrem larguras 320, 360, 390, 430, 768 e 1280, cabeçalho/logotipo, listas, criação/edição, detalhes, carregamento/erro/vazio, preservação de payload/filtro, retorno de foco e consulta sem edição de Regionais.

Essas verificações locais e a CI não substituem a homologação de permissões/dados reais no Beta, que depende de liberação posterior. Não é necessário repetir o aceite estético já registrado.
