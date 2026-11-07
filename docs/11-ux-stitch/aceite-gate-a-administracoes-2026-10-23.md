# Gate A — Administrações

Referências versionadas: `prototipos/lote-1/regionais-administracoes/`.

- AGD-ADM-006: listagem desktop/mobile.
- AGD-ADM-039: cadastro.
- AGD-ADM-040: edição.

Confirmar variantes e origem, filtros e permissões reais, regional obrigatória, nome obrigatório, código opcional, ativo/inativo, responsividade, contraste, foco e retorno da edição. Não transportar dados de demonstração ou HTML do Stitch.

Status atualizado em 30/10/2026: referências visuais aprovadas expressamente pelo PO, após o aceite condicionado de 16/10/2026; preservar as ressalvas abaixo. A homologação da implementação na aplicação completa permanece independente. Implementação React e deploy não autorizados por esta documentação.

## Aprovação das referências pelo PO — 30/10/2026

O PO declarou: **“aprovo as referências, os cabeçalhos não apareceram nos novos modelos”**. Em seguida autorizou: **“pode seguir sem regerar as telas para aprovação”**.

**Abrangência:** AGD-ADM-006 (desktop/mobile), AGD-ADM-039 e AGD-ADM-040. As referências apresentadas são os HTMLs versionados na pasta deste sublote, confrontados com os componentes de `develop` em `0e65f9fd0988b83a8b0604e42f84afa49a3454fd`. Não é necessário gerar novas telas nem solicitar repetição deste aceite estético.

### Cabeçalho institucional

As prévias de “componente atual” renderizaram somente o conteúdo isolado de Regionais/Administrações, com dados de demonstração, sem gravação e sem o `MainLayout` (cabeçalho global e ajuda). Não eram capturas do Beta nem novos modelos completos. A ausência do cabeçalho nessas prévias não constitui autorização para removê-lo.

Na aplicação real, `App.tsx` envolve as duas telas em `MainLayout`, cujo cabeçalho institucional já existe. Preservar cabeçalho azul, identidade/logotipo institucional e navegação canônica na implementação; não duplicar cabeçalhos nos componentes. Validar a composição completa em desktop/mobile no Gate B, sem nova geração para aceite. Versão, ambiente e build reais permanecem somente no rodapé.

### Ressalvas da comparação com o produto

- Listagem: preservar filtro por Regional e Nome, Regional, Código, Status, Detalhes/Editar; cards mobile sem rolagem horizontal. Não introduzir menu ou descrições fictícias. Nos detalhes, priorizar nome da Regional em vez de expor código técnico.
- Cadastro/edição: Regional obrigatória da API, Nome obrigatório (2–255 caracteres), Código opcional (até 50) e Administração Ativa. Não copiar limite ilustrativo de 80 caracteres, siglários, alegações financeiras/de homologação ou regras de governança inventadas. Preservar autorização e validação de escopo atual.
- Tema escuro usa tokens globais. Conferir nomes longos, zoom, foco/teclado, retorno ao registro, estados de carregamento/erro/vazio e ações acessíveis na aplicação completa; a renderização local não comprova esses gates nem a homologação Beta.
- Preservar sem alteração as dívidas independentes #425, #426, #431 e #417.

**Governança:** este registro formaliza a aprovação das referências e a dispensa de regeração. Não encerra por inferência o Gate A global ou a homologação funcional e não autoriza merge dos PRs #363/#364, implementação React, deploy ou alteração de D1; essas etapas mantêm autorização independente.
