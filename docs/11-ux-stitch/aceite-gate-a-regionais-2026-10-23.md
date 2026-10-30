# Gate A Stitch — ficha de aceite visual: Regionais

**Data:** 23/10/2026  
**Estado atualizado em 30/10/2026:** referências visuais aprovadas expressamente pelo PO, com as ressalvas abaixo. A homologação da implementação na aplicação completa permanece independente. Nenhuma implementação React, mudança de backend, migração, deploy ou merge é autorizada por esta ficha.

## Superfícies

AGD-ADM-005 (listagem desktop/mobile), AGD-ADM-037 (cadastro), AGD-ADM-038 (edição).

## Referências já versionadas

Pasta: `docs/11-ux-stitch/prototipos/lote-1/regionais-administracoes/`. Consultar o README e as referências de cada código antes do aceite. Originais do Stitch são **referência estética**, não código da aplicação. Preservar seus bytes/hashes e rastreabilidade; conferir divergências de origem ainda registradas no handoff.

## Modelo real e restrições

Nome obrigatório, código opcional, ativo/inativo. Carregar registros reais e respeitar capabilities; não inventar filtros, status nem exportações.

Conferir identidade das quatro referências e suas variantes; layout desktop/mobile, formulários, ações reais, estados de carregamento/erro/vazio, contraste, foco e retorno após edição.

Respeitar cabeçalho azul institucional, versão/ambiente/build reais somente no rodapé, nomenclatura canônica, zoom, acessibilidade e ícones sem cruzes. Não reproduzir dados fictícios, textos orientativos que pertencem ao Manual de Uso, simulações de salvamento, dependências/CDN do HTML, opções, filtros ou ações não implementadas.

## Checkpoint de aceite

- [ ] Identidade, origem e variante final de cada referência verificada.
- [x] Referências visuais aprovadas pelo PO em 30/10/2026 com ressalvas explicitadas; prévias isoladas não homologam a aplicação completa.
- [ ] Campos, ações, permissões, filtros e fluxos conferidos contra o produto real.
- [ ] Decisões sobre rótulos, estados e divergências registradas.


**Etapa posterior, fora do Gate A:** solicitar autorização independente para implementar em React/Tailwind (Gate B) somente após o aceite final.

**Status do Gate A global:** aberto. Esta ficha evita tempo perdido na preparação, **sem antecipar aceite ou implementação visual**. Nada em `main` sem autorização de produção.

## Aprovação das referências pelo PO — 30/10/2026

O PO declarou: **“aprovo as referências, os cabeçalhos não apareceram nos novos modelos”**. Em seguida autorizou: **“pode seguir sem regerar as telas para aprovação”**.

**Abrangência:** AGD-ADM-005 (desktop/mobile), AGD-ADM-037 e AGD-ADM-038. As referências apresentadas são os HTMLs versionados na pasta deste sublote, confrontados com os componentes de `develop` em `0e65f9fd0988b83a8b0604e42f84afa49a3454fd`. Não é necessário gerar novas telas nem solicitar repetição deste aceite estético.

### Cabeçalho institucional

As prévias de “componente atual” renderizaram somente o conteúdo isolado de Regionais/Administrações, com dados de demonstração, sem gravação e sem o `MainLayout` (cabeçalho global e ajuda). Não eram capturas do Beta nem novos modelos completos. A ausência do cabeçalho nessas prévias não constitui autorização para removê-lo.

Na aplicação real, `App.tsx` envolve as duas telas em `MainLayout`, cujo cabeçalho institucional já existe. Preservar cabeçalho azul, identidade/logotipo institucional e navegação canônica na implementação; não duplicar cabeçalhos nos componentes. Validar a composição completa em desktop/mobile no Gate B, sem nova geração para aceite. Versão, ambiente e build reais permanecem somente no rodapé.

### Ressalvas da comparação com o produto

- Listagem: preservar Nome, Código, Status e ações reais; cards mobile sem rolagem horizontal. Não introduzir busca, filtros novos, paginação, contagens de congregações, descrições ou menu adicional do protótipo.
- Cadastro/edição: Nome obrigatório (2–255 caracteres), Código opcional (até 50) e Regional Ativa, conforme schema atual. Não adicionar Unidade Federativa nem textos ou alegações fictícias de homologação/exportação. Preservar escrita restrita ao Master e consultas por escopo.
- Tema escuro usa tokens globais. Conferir nomes longos, zoom, foco/teclado, retorno ao registro, estados de carregamento/erro/vazio e ações acessíveis na aplicação completa; a renderização local não comprova esses gates nem a homologação Beta.
- Preservar sem alteração as dívidas independentes #425, #426, #431 e #417.

**Governança:** este registro formaliza a aprovação das referências e a dispensa de regeração. Não encerra por inferência o Gate A global ou a homologação funcional e não autoriza merge dos PRs #363/#364, implementação React, deploy ou alteração de D1; essas etapas mantêm autorização independente.
