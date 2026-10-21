# Google Stitch — aceite visual condicionado: Casas de Oração e menu Mais

**Decisão expressa do PO:** 15/10/2026. **Aprovada a direção visual das cinco propostas**, condicionada às correções abaixo. **Não autoriza implementação**, merge de UI, alteração de permissões ou deploy. A aprovação de Casas de Oração não encerra o Gate A integral do lote 1.

| Superfície | Código canônico | Resultado visual | Condição |
|---|---|---|---|
| Casas de Oração — lista desktop | `AGD-ADM-008` | Aprovada a direção | Filtros reais, tabela sem rolagem horizontal da página, manter ações e dados reais |
| Casas de Oração — lista mobile | `AGD-ADM-008` | Aprovada a direção | Cards com dados/ações; permitir quebra de nomes completos em quantas linhas forem necessárias, sem `truncate` ou overflow (nomes podem ter até 255 caracteres) |
| Cadastrar Casa | `AGD-ADM-043` | Aprovada a direção | Apenas Setor*, Nome*, Código opcional, Ativa, Cancelar/Salvar |
| Editar Casa | `AGD-ADM-044` | Aprovada a direção | Formulário dedicado sem voltar ao topo; mesmas informações, Cancelar/Atualizar; retornar ao contexto anterior |
| Mais — mobile | Código conforme inventário; **não inventar** | Aprovada a direção | Grupos Agenda, Administração, Pessoas e Acessos, Conta retráteis; itens conforme capability; "Casas de Oração" por extenso |

## Correções obrigatórias e rastreabilidade

1. **Iconografia:** proibição absoluta de cruzes/crucifixos/ícones de templo com cruz ou símbolos católicos como identidade CCB. Conferir todas as superfícies. Substituir `church` por ícones neutros verificados; ver `DESIGN.md`.
2. **Identidade e metadados:** uniformizar azul do cabeçalho entre telas e temas; versão, ambiente e build **somente no rodapé**, de forma dinâmica e acessível no mobile sem cobrir barra de navegação. Não utilizar valores estáticos dos HTMLs Stitch.
3. **Acessibilidade:** remover `user-scalable=no`; testar zoom, foco, contraste, teclado e larguras 360/390/430/768/1280/1440. Não ocultar nomes longos usando `truncate`.
4. **Fidelidade funcional:** excluir homologação cadastral, sincronização simulada, títulos/atribuições ministeriais inventados, campos e metadados falsos (`REF-SIG`, última alteração fictícia, capacidades, escalas, endereços, históricos, protocolos, regras de nomenclatura ou dependências de calendários não confirmadas). Textos de ajuda devem corresponder aos comportamentos reais.
5. **Menu Mais:** implementar agrupamentos recolhíveis (preferir inicialmente recolhidos e expandir apenas o grupo em uso), respeitar capabilities para itens inteiros e condições internas. Buscar módulos é proposta adicional: não tratar como existente; depende de validação funcional antes de implementar. Não acrescentar atalhos/categorias/descrições não confirmados.
6. **Lista:** preservar filtro Setor, contagem, Nome, Setor, Código, Status e ações Detalhes/Editar; não introduzir paginação, sincronização, novos filtros ou rotas `#/agd-adm-044` inventadas. Distinguir código institucional de identificador técnico de rota.
7. **Operação editar:** ação precisa abrir fluxo dedicado imediatamente, sem rolagem manual ao topo. Preservar filtro, posição e contexto ao cancelar ou salvar, conforme viabilidade técnica aprovada; não assumir API ou navegação nova.
8. **Salvar:** HTML do Stitch contém apenas simulações locais. Qualquer confirmação de sucesso na implementação depende de resposta real do backend, validação e testes.
9. **Temas:** seguir tokens compartilhados do `DESIGN.md` para claro, escuro e automático; variantes não autorizam codificação isolada por tela.

## Gates seguintes

- **Agora:** registrar documentação e revisão Codex/CI **somente documental**.
- **Antes de implementação:** inventariar estados mobile de cadastro/edição e conferir o aceite final por código e permissões, no fluxo de Gate A aplicável ao sublote.
- **Depois de autorização específica para codificar:** PR React/Tailwind independente em `develop`, revisão/CI, smoke Beta por capacidade/viewport e liberação expressa. Nunca incorporar o HTML do Stitch diretamente.
- **Próximo trabalho Stitch:** Locais e Espaços, mantendo o Design System e a regra religiosa.
