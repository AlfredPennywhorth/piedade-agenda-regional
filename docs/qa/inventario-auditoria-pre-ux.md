# Auditoria documental inicial de códigos — issue #247

Fonte canônica: [inventario-codigos-telas.md](../inventario-codigos-telas.md). **Não renumerar os códigos existentes.**

## Verificações iniciais
- O inventário já contém telas principais e códigos **AGD-ADM-016–059** de subtelas e formulários, que não devem ser renumerados.
- Códigos compartilhados **já publicados e registrados/reservados no inventário canônico**: **AGD-SHR-002 Login**, **AGD-SHR-003 Ativação**, **AGD-SHR-004 Recuperação de PIN** (`AuthView.tsx`) e **AGD-SHR-005 Ciência/responsabilidade regional** (`ResponsabilidadeRegionalGate.tsx`).
- Convenções existentes: `AGD-MOB-###`, `AGD-ADM-###`, `AGD-SHR-###`.
- O inventário canônico ainda indica lacunas de cobertura em variantes de Séries, Convocações, Administração, Portaria, Relatórios, Meu Cadastro e diálogos compartilhados; conferir apenas superfícies **ainda não catalogadas** após confrontar componente e inventário.
- Não considerar a issue #247 concluída até rastrear todos os modais, formulários CRUD, confirmações e estados de operação a partir dos componentes reais.

## Plano de auditoria antes do Stitch
1. Inventariar rotas e abas a partir de `apps/web/src/App.tsx` e `apps/web/src/components/layout/MainLayout.tsx`.
2. Percorrer os componentes por módulo; relacionar cada superfície à tela-pai, ação CRUD e perfil.
3. Reservar código único para cada contexto realmente distinto, sem reutilizar código porque existe componente React compartilhado.
4. Comparar inventário com elementos visíveis no desktop e mobile.
5. Incluir teste de unicidade e smoke de visibilidade de código antes do redesenho.
6. Validar cobertura com os responsáveis por UX e operação.

**Escopo desta rodada:** auditoria e preparação documental; nenhuma alteração visual nem atribuição fictícia de códigos.
