# Gate A Stitch — ficha de aceite visual: Regionais

**Data:** 23/10/2026  
**Estado:** preparação documental para revisão do PO; **aceite final pendente**. Nenhuma implementação React, mudança de backend, migração, deploy ou merge é autorizada por esta ficha.

## Superfícies

AGD-ADM-005 (listagem desktop/mobile), AGD-ADM-037 (cadastro), AGD-ADM-038 (edição).

## Referências já versionadas

Pasta: `docs/11-ux-stitch/prototipos/lote-1/regionais-administracoes/`. Consultar o README e as referências de cada código antes do aceite. Originais do Stitch são **referência estética**, não código da aplicação. Preservar seus bytes/hashes e rastreabilidade; conferir divergências de origem ainda registradas no handoff.

## Modelo real e restrições

Nome obrigatório, código opcional, ativo/inativo. Carregar registros reais e respeitar capabilities; não inventar filtros, status nem exportações.

Conferir identidade das quatro referências e suas variantes; layout desktop/mobile, formulários, ações reais, estados de erro/vazio, contraste, foco e retorno após edição.

Respeitar cabeçalho azul institucional, versão/ambiente/build reais somente no rodapé, nomenclatura canônica, zoom, acessibilidade e ícones sem cruzes. Não reproduzir dados fictícios, textos orientativos que pertencem ao Manual de Uso, simulações de salvamento, dependências/CDN do HTML, opções, filtros ou ações não implementadas.

## Checkpoint de aceite

- [ ] Identidade, origem e variante final de cada referência verificada.
- [ ] Aparência desktop e mobile aprovada pelo PO com ressalvas explicitadas.
- [ ] Campos, ações, permissões, filtros e fluxos conferidos contra o produto real.
- [ ] Decisões sobre rótulos, estados e divergências registradas.
- [ ] Autorização **separada** para implementar em React/Tailwind (Gate B).

**Status do Gate A global:** aberto. Esta ficha evita tempo perdido na preparação, **sem antecipar aceite ou implementação visual**. Nada em `main` sem autorização de produção.
