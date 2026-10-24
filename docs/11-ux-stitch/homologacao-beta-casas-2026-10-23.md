# Homologação Beta de Casas de Oração — 23/10/2026

**Status:** aprovado pelo PO após deploy Beta da PR #359 (commit `61fe2b3a`).

## Escopo aprovado

- Menu Mais: rótulo **Casas de Oração** (#358).
- Dispositivo móvel na horizontal: cards sem sobreposição com cabeçalho (#357).
- Paginação mobile, botões Anterior/Próxima (#356).
- Edição no **mobile**: retorno ao card de origem na listagem (#356). No desktop, o retorno à linha original ainda não foi homologado e permanece pendente de ajuste/QA.
- Detalhes: nome do Setor exibido sem UUID técnico (#359).

A confirmação do PO encerra as ressalvas desta rodada de Beta; não equivale a teste exaustivo de todos os perfis/telas.

## Gates preservados

- **Gate A Stitch Lote 1 permanece aberto:** o aceite dos ajustes de Casas na Beta não aprova automaticamente todas as referências/protótipos.
- **Próximo subgrupo do Gate A: Setores**, confrontar as referências finais AGD-ADM-007 (listagem desktop/mobile), AGD-ADM-041 (cadastro) e AGD-ADM-042 (edição) com o sistema e a matriz de permissões.
- Conferir especialmente: filtros reais, cabeçalho único, ambiente/versão/build reais no rodapé, layout mobile, campos/foco, ausência de filtros duplicados e retorno ao contexto.
- Na sequência: Locais/Espaços, Regionais/Administrações, Grupos de Trabalho e condições globais. **Antes de fechar o Gate A global, retomar explicitamente Casas de Oração e Menu Mais** para verificar as referências finais, rastreabilidade, permissões e grupos retráteis; o aceite Beta desta rodada não encerra essas pendências.
- **S1:** iniciar somente após o Gate A, conforme plano existente. Não copiar código Stitch nem modificar `main` sem autorização expressa.
