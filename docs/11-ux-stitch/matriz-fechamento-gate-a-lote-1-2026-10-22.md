# Matriz de fechamento do Gate A — Lote 1 Stitch

**Data de consolidação:** 22/10/2026
**Natureza:** instrumento de verificação para aceite do PO. Não constitui aprovação final, autorização de React, merge de UX ou deploy.
**Fontes:** `DESIGN.md`, `gate-a-lote-1-rastreabilidade.md`, handoffs por área e inventário canônico de telas.

| Grupo | Código/tela | Aceite estético | Pendência verificável antes do Gate A | Evidência de fechamento |
|---|---|---|---|---|
| Setores | AGD-ADM-007 listagem | Condicionado | Desktop/mobile e temas; cabeçalho único; rodapé com build real; filtros/campos efetivos | Referência/hash final + captura validada |
| Setores | AGD-ADM-041 cadastro | Condicionado | Confirmar layout mobile, campos reais e foco | Variante mobile final + aceite |
| Setores | AGD-ADM-042 edição | Condicionado | Descartar variante escura com filtros duplicados; validar retorno ao contexto | Protótipo final + aceite |
| Casas | AGD-ADM-008 desktop | Condicionado | Eliminar rolagem horizontal da página; filtros reais e ações | Protótipo final + aceite |
| Casas | AGD-ADM-008 mobile | Condicionado | Cards sem truncar nomes extensos; exibir ações sem overflow | Testes visuais com nome de até 255 caracteres |
| Casas | AGD-ADM-043 cadastro | Condicionado | Apenas Setor*, Nome*, Código opcional e Ativa; Cancelar/Salvar | Conferência de campos e fluxo |
| Casas | AGD-ADM-044 edição | Condicionado | Evitar rolar ao topo para editar; preservar contexto | Fluxo de edição completo |
| Navegação | Mais mobile | Condicionado | Grupos retráteis, permissões reais, nome Casas de Oração | Navegação por perfil e captura |
| Locais/Espaços | AGD-ADM-013 lista desktop/mobile | Condicionado | Filtros, busca, tabelas/cards e autoria reais | Rastreabilidade dos originais + aceite |
| Locais/Espaços | AGD-ADM-055 novo Local | Condicionado | Campos, ações e permissões reais | Formulário fiel ao código |
| Locais/Espaços | AGD-ADM-056 edição | Condicionado | Restrições de autoria e retorno após edição | Fluxo aprovado |
| Locais/Espaços | AGD-ADM-057 detalhes | Condicionado | Origem e equivalência do arquivo Stitch ainda a comprovar | Arquivo/hash e conferência visual |
| Locais/Espaços | AGD-ADM-058 Espaços | Condicionado | Cadastro/edição e ações por permissão | Fluxo aprovado |
| Regionais | AGD-ADM-005 lista desktop/mobile | Condicionado | Mapear duas variantes e hash de origem; cabeçalho/tabela | Inventário imutável + aceite |
| Regionais | AGD-ADM-037 cadastro, 038 edição | Condicionado | Confirmar arquivo↔código, ações e permissões | Correspondência comprovada |
| Administrações | AGD-ADM-006 lista desktop/mobile | Condicionado | Mapear variantes e hash; filtros e tabelas | Inventário imutável + aceite |
| Administrações | AGD-ADM-039 cadastro, 040 edição | Condicionado | Confirmar arquivo↔código, campos e operações | Correspondência comprovada |
| GTs | AGD-ADM-009 desktop/mobile | Condicionado | Conferir variantes e estados; dados reais | Referências/hashes existentes + QA |
| GTs | AGD-ADM-045 cadastro, 046 edição, 047 detalhes | Condicionado | Validar subfluxos e ações por permissão | Protótipos finais + aceite |

## Condições globais — sem exceção

- Proibição de cruzes e iconografia religiosa inadequada; conferir pictogramas visualmente.
- Azul de cabeçalho padronizado; versão, ambiente e build reais no rodapé.
- Sem dados fictícios importados para a base ou elementos funcionais inventados.
- Desktop e mobile com dados/ações equivalentes; sem rolagem horizontal da página e sem impedir zoom.
- Contraste, foco, teclado, erros, vazio e carregamento verificados.
- Matriz de permissões e fluxos do código atual prevalece sobre o HTML do Stitch.

## Critério de decisão

Para cada linha: [ ] arquivo original rastreável; [ ] versão aplicável (desktop, mobile ou ambas); [ ] ressalvas corrigidas; [ ] confronto com produto real; [ ] aceite explícito PO registrado.

**Status geral: Gate A aberto.** O fechamento de cada item deverá ser comprovado; não se presume aceite final pela existência de um mockup. Somente após o fechamento do lote e autorização expressa poderá começar sua implementação React/Tailwind em `develop`.
