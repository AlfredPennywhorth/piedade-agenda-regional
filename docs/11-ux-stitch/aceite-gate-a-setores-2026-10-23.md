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

## Reconciliação do Gate A — 30/10/2026 (retomada pós-Pontos de Atendimento)

**Estado de referência:** comparação estática com `apps/web/src/components/setores/SetoresView.tsx` na `develop` (`752427f1`). Este registro atualiza observações antigas sem equivaler a homologação Beta, aprovação do Gate A ou deploy.

### Já observado no código atual

- A listagem usa **cards responsivos** em `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`, sem a antiga tabela `master-table-scroll` descrita neste documento em 23/10. Cards incluem Nome, Administração (nome resolvido), Código, Status e ações Detalhes/Editar; nomes longos usam quebra de linha.
- Os Detalhes exibem **nome da Administração**, não o identificador UUID (referência #361).
- Os filtros Regional e Administração estão em cascata. Formulários possuem código de tela `AGD-ADM-041`/`AGD-ADM-042`, campos reais e ações de Cancelar/Salvar/Atualizar. A edição possui `scrollIntoView` até o formulário.
- Não copiar o HTML Stitch no React; as referências visuais são **os layouts originais aprovados em 24/10** sob `prototipos/lote-1/setores/originais/{claro,escuro}/`, não os unificados em avaliação.

### Ainda é preciso comprovar / ajustar

1. Capturas **reais do Beta** em mobile (320/360/390/430), tablet e desktop, sem rolagem horizontal nem elementos sobrepostos, inclusive modal Detalhes, select de Administração e edição.
2. Confrontar os formulários Cadastro/Edição com os **originais** claros e escuros, preservando logo institucional e rejeitando variante escura com filtros duplicados. Separar dívida de tema escuro global do aceite da tela efetiva.
3. Verificar acesso por perfil, nomes longos, zoom, foco/teclado, scroll até o formulário e retorno ao registro após cancelar/salvar.
4. Confirmar se versão/build e ajuda/contexto atendem à diretriz transversal de layout sem regressões.
5. Reavaliar a Issue #371, fechada no GitHub, **sem inferir** que todas as ressalvas foram homologadas; as implementações visíveis no código resolvem apenas parte das observações históricas.

### Próximo gate

Registrar checklist visual das telas `AGD-ADM-007`, `AGD-ADM-041` e `AGD-ADM-042` no Beta com resultados e evidências; abrir PR **de implementação React separada** apenas para divergências demonstradas (não refazer cards/UUID já corrigidos). Não tocar produção nem alterar dados de teste do usuário sem autorização.

## Aceite final do PO — 30/10/2026

O PO confirmou expressamente: **“as telas 007, 041 e 042 estão aprovadas”**.

- **AGD-ADM-007 — Listagem de Setores:** aprovada.
- **AGD-ADM-041 — Cadastro de Setor:** aprovada.
- **AGD-ADM-042 — Edição de Setor:** aprovada.

**Decisão:** Gate A do sublote Setores aprovado; utilizar layouts originais claros/escuros anteriormente validados, com logotipo institucional preservado. A implementação React atual já contém cards responsivos, filtros em cascata e nome da Administração no modal. Não criar nova PR de redesenho destas telas sem novo defeito comprovado. As dívidas transversais ou de outros módulos continuam independentes.

**Governança:** aceite visual não é autorização de merge, deploy ou alteração no D1. Beta e produção só são alterados no fluxo de liberação estabelecido.
