# Gate A — Locais e Espaços

Referências versionadas: `prototipos/lote-1/locais-espacos/originais/`, com manifesto SHA-256.

- AGD-ADM-013: listagem desktop/mobile.
- AGD-ADM-055: cadastro de Local.
- AGD-ADM-056: edição.
- AGD-ADM-057: detalhes.
- AGD-ADM-058: Espaços do Local.

Conferir vínculo e autoria, escopos institucionais e particulares, permissões por ação e registro, campos e filtros reais, links Maps/Waze, ordenação, foco ao editar Espaço e mobile sem rolagem horizontal. A exceção de adicionar Espaço ao Local institucional SETOR de autoria do usuário comum exige **todas** as condições da função `podeCriarEspacoNoLocalDeAutoria` em `apps/worker/src/routes/espacos-locais.ts`: Local, membro, Casa de Oração e Setor ativos, vínculo de autoria válido e Setor de origem atual do membro igual ao Setor do Local. Não habilitar ação com base apenas na autoria e no escopo; não conceder edição irrestrita. Consultar `handoff-locais-espacos.md` para a matriz completa. Não copiar dados fictícios, opções ou código HTML/JS do Stitch.

A direção visual teve **aceite condicionado em 15/10/2026**. Para o **aceite final do Gate A**, aplicar integralmente `matriz-fechamento-gate-a-lote-1-2026-10-22.md` e `handoff-locais-espacos.md`: rastreabilidade dos originais, variantes, ressalvas, permissões, tema claro/escuro, acessibilidade e zoom, estados carregamento/erro/vazio, cabeçalho e rodapé padronizados e iconografia segura. Em AGD-ADM-057, verificar expressamente a pendência de equivalência da origem do protótipo.

Status: aguarda conferência final e aceite expresso do PO. Implementação React e deploy não autorizados por esta documentação.
