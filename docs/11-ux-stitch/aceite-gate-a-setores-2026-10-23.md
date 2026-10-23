# Gate A Stitch — ficha de decisão visual: Setores (Lote 1)

**Data:** 23/10/2026
**Status:** em avaliação; **não** constitui aceite final do PO nem autorização para redesenho React.
**Base:** `handoff-setores.md`, `matriz-fechamento-gate-a-lote-1-2026-10-22.md`, protótipos do sublote e `apps/web/src/components/setores/SetoresView.tsx` da develop.

## Referências canônicas para decisão

Os oito HTMLs de `prototipos/lote-1/setores/originais` são evidência histórica. As quatro versões de `unificados-em-avaliacao/` são prévias para avaliação (não fontes copiáveis). `MANIFESTO-SHA256.json` registra hashes de todos os 12 arquivos.

| Tela | Referência a avaliar | Aceite ainda necessário |
|---|---|---|
| AGD-ADM-007 listagem | `unificados-em-avaliacao/AGD-ADM-007-desktop-unificado.html` + `AGD-ADM-007-mobile-unificado.html` | layout claro/escuro, filtros reais, legibilidade e ações desktop/mobile |
| AGD-ADM-041 cadastro | `unificados-em-avaliacao/AGD-ADM-041-cadastro-unificado.html` | formulário real e variante mobile com foco e navegação por teclado |
| AGD-ADM-042 edição | `unificados-em-avaliacao/AGD-ADM-042-edicao-unificado.html` | sem filtros duplicados e edição com retorno ao contexto |

## Confronto com o produto real

No componente atual existem:
- Filtros em cascata **Regional → Administração** (sem busca textual e sem paginação).
- Lista com **Nome, Administração, Código, Status e ações Detalhes/Editar**, mais **Novo Setor**.
- Formulários de criação/edição com **Regional, Administração, Nome do Setor, Código opcional, Setor Ativo** e ações Cancelar/Salvar ou Atualizar.
- Consulta/gravação em APIs atuais (`/setores`, `/administracoes`, `/regionais`), validação por schemas compartilhados.

Divergências a tratar no Gate B, **somente depois de autorizado**:
- A lista usa uma tabela com rolagem interna (`master-table-scroll`) mesmo em dispositivos móveis; protótipo prevê cards mobile. Não copiar conteúdo fictício.
- A abertura do formulário de edição ocorre em uma seção acima da listagem; o retorno ao item de origem não é garantido em lista extensa.
- A renderização condicional por perfil deve obedecer às permissões existentes, não aos botões ilustrativos.
- As referências não autorizam busca/paginação, gráficos/mapas, indicadores de sincronização, opções fictícias ou textos orientativos: orientações pertencem ao Manual de Uso.
- Condições globais: cabeçalho azul consistente; versão/ambiente/build reais no **rodapé**; evitar scroll horizontal da página, preservar zoom, contraste e foco; não reproduzir iconografia religiosa inadequada.

## Protocolo de aceite do PO (Gate A)

Para cada código 007/041/042, verificar (1) versão/variante escolhida, (2) layout desktop/mobile, (3) aderência aos campos e permissões atuais, (4) divergências expressamente descartadas, (5) contraste/zoom e ausência de elementos fictícios.

**Pendente:** aceite explícito das referências finais por tela. A direção visual condicionada de 15/10 não equivale a conclusão do Gate A. Após o aceite, solicitar autorização específica de implementação React/Tailwind e executar QA Beta (Gate B), sem tocar `main`.

**Nota de operação:** a correção isolada de UUID nos Detalhes de Setor (#361) já foi integrada à develop; ela não depende de aceite das referências nem fecha o Gate A.
