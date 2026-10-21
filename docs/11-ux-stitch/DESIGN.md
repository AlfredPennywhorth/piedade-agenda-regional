# Agenda Regional São Paulo — DESIGN.md (Stitch UX 2026)

**Estado:** referência visual v1; direção visual de Setores e direção visual condicionada de Casas de Oração/menu Mais aprovadas pelo PO em 15/10/2026. **Não é implementação, aceite funcional nem liberação automática do Gate A do lote 1.**

## Origem e precedência
1. Código em `develop` e inventário `docs/inventario-codigos-telas.md`: campos, ações, permissões, menus, estados e códigos oficiais.
2. Capturas da Agenda Beta: referência de fluxo e conteúdo atual, sem dados pessoais.
3. SIGA da CCB **desktop**: inspiração visual institucional apenas. Nunca usar o SIGA mobile como referência de UX, nem copiar seus menus, código ou comportamento.
4. Stitch anterior: banco opcional de ideias; não é padrão obrigatório.

## Identidade
- Estilo institucional sóbrio, limpo e legível; tipografia Inter (fallback sans-serif).
- Um **único componente compartilhado de cabeçalho** e a mesma cor de fundo em todas as telas/temas. Evitar variações de azul entre listagem/cadastro/edição.
- Cabeçalho: marca e nome da aplicação, identidade do usuário e ação de sair quando cabíveis. **Sem versão/build/ambiente no cabeçalho.**
- Rodapé técnico: ambiente, versão e build **dinâmicos**, não valores de exemplo. Código AGD da tela deve ser discreto e respeitar a regra de exibição aprovada no inventário. No mobile, o rodapé fica acessível sem cobrir a barra de navegação inferior, não fixo sobre o conteúdo.
- Navegação inferior canônica: Minha Agenda, Eventos (condicional), Calendário, Convocações (condicional), Mais. Preservar capabilities.

## Regra absoluta de iconografia religiosa (CCB)

**Proibido** utilizar cruzes, crucifixos ou imagens/ícones de igreja ou templo com cruz, bem como símbolos associados à Igreja Católica como representação da Congregação Cristã no Brasil. Válido para menus, formulários, mapas, ilustrações, imagens, estados vazios, logos e ambos os temas em todos os módulos. Não utilizar Material Symbols `church` nem equivalente iconográfico com cruz. Preferir símbolos neutros como `domain`, `apartment`, `location_city`, `place` ou `location_on`, após verificar visualmente que o desenho não inclui cruz. Dúvidas exigem avaliação do PO; não assumir que um nome genérico de ícone garante conformidade.

## Tokens de partida — propostas, não valores definitivos
| Uso | Claro | Escuro |
|---|---|---|
| Cabeçalho institucional | `#102D55` | `#102D55` (mesma identidade; testar contraste) |
| Ação primária | `#2563EB` | `#2563EB` |
| Fundo | `#F8FAFC` | `#0F172A` |
| Superfície de card | `#FFFFFF` | `#1E293B` |
| Texto principal | `#0F172A` | `#F8FAFC` |

Usar tokens semânticos (header, action, background, surface, text, border, success, warning, error, focus), não cores hardcoded por componente. Conferir WCAG AA por combinação real, estados de foco e contraste; paleta acima não é certificação.

## Temas e responsividade
- Claro, escuro, automático (`prefers-color-scheme`) com preferência persistente somente na implementação aprovada e sem flash de tema incorreto.
- Desktop: tabela e filtros com uso adequado do espaço; mobile: cards equivalentes aos dados e ações, sem rolagem horizontal da **página**.
- Testar 360, 390, 430, 768, 1280 e 1440 px, zoom do navegador e barra PWA; jamais impedir zoom com `user-scalable=no`.
- Manter alvos de toque confortáveis, foco visível, labels vinculadas aos campos, mensagens e estados de erro/vazio/carregamento.
- Não acrescentar ícones de sincronização, badges, estatísticas, mapas, filtros, navegação ou textos normativos não confirmados.

## Processo e aprovação
Tela atual e código funcional → briefing específico → variante Stitch desktop/mobile e temas → **aceite expresso do PO por código de tela** → adaptação ao React/Vite/Tailwind existente → CI/revisão → smoke Beta por perfil e viewport → autorização de release. Não colar HTML estático/CDN do Stitch na aplicação. Aprovação conceitual do design system não libera automaticamente outros lotes nem o Gate A integral da fase 1.
