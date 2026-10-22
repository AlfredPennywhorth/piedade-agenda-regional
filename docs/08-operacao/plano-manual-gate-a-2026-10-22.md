# Plano de execução — Manual de Uso + fechamento Gate A do Stitch

**Situação em 22/10/2026:** planejamento e revisão editorial; sem autorização para implementar UX no React, mesclar em main ou publicar.

## Trilha A — Manual da versão de produção
Fonte: release #352, SHA `f8610c26`; capítulos existentes M2.1–M2.8 em `docs/08-operacao/`. A PR #353 consolida registro do release e complementos de Membros/Eventos.

| Passo | Entrega verificável | Aceite |
|---|---|---|
| A1 | Revisão das oito seções à luz do código e comportamento da produção | Rótulos, permissões e fluxos corretos, sem funcionalidades futuras |
| A2 | Índice e capítulos harmonizados; resumo do release #352 | Todos os links e códigos AGD rastreáveis |
| A3 | Capturas reais anonimizadas de desktop/mobile nas jornadas críticas | Sem dados pessoais e sem imagens do Stitch tratadas como produção |
| A4 | Material final de distribuição e procedimento de revisão por versão | Aprovação editorial do PO |

**Ordem recomendada:** acesso/ativação, Minha Agenda/Calendário, Eventos/Convocações, Membros e permissões, demais módulos.

## Trilha B — Fechamento do Gate A visual, lote 1
Referências: `docs/11-ux-stitch/DESIGN.md`, `gate-a-lote-1-rastreabilidade.md` e handoffs de Setores, Casas, Locais/Espaços, Regionais/Administrações, GTs.

| Subárea | Aceite atual | Itens para encerrar Gate A |
|---|---|---|
| Setores | Direção visual aprovada com ressalvas | Rastrear versões finais; verificar cadastro/edição no mobile, contraste e tokens |
| Casas + Mais | Direção visual aprovada com ressalvas | Filtros reais, nomes longos em cards, tela de edição sem rolar ao topo, permissões e ícones |
| Locais / Espaços | Seis propostas com aceite visual condicionado | Concluir rastreabilidade de originais e conferir autoria/permissões, ações e responsividade |
| Regionais / Administrações | Oito propostas com aceite condicionado | Relacionar cada arquivo/hash à tela e fechar ressalvas |
| GTs | Cinco propostas com aceite condicionado | Verificar subestados, campos/ações e variantes de viewport |

### Matriz obrigatória para encerramento
Para cada código e variante: código AGD; tela/subestado; artefato original e hash; desktop/mobile; tema; decisão PO e ressalvas; equivalência com código funcional; critérios de acessibilidade; evidência de aprovação final.

**Gate A fechado** só com cobertura, rastreabilidade e aceite expresso do PO para o conjunto. Aceite estético condicionado ≠ implementação autorizada. O Gate B (React/Tailwind, CI, Beta, smoke) começa apenas depois de autorização específica.

## Controle de escopo
Nenhum protótipo HTML gerado pelo Stitch será incorporado diretamente. Não inventar campos, permissões ou ícones religiosos incompatíveis. Padronizar azul do cabeçalho e colocar build/versão dinâmicos no rodapé. Manter `main` intacta.

## Próxima decisão do PO
Após concluir inventário e checklist das ressalvas, submeter o fechamento de Gate A do lote 1 por código e, separadamente, pedir autorização para iniciar implementação em `develop`.
