# Capturas reais — Manual de Uso da Agenda Regional São Paulo

Esta pasta guarda **imagens reais e anonimizadas da aplicação**, para a issue #170. Não utilizar exportações do Stitch como evidência da aplicação. As imagens entram apenas após conferência do PO.

## Organização
- `acesso/` — capturas do módulo correspondente
- `minha-agenda/` — capturas do módulo correspondente
- `eventos-convocacoes/` — capturas do módulo correspondente
- `membros/` — capturas do módulo correspondente
- `estrutura-territorial/` — capturas do módulo correspondente
- `portaria/` — capturas do módulo correspondente
- `relatorios/` — capturas do módulo correspondente
- `administracao/` — capturas do módulo correspondente

## Nome dos arquivos
Padrão: `AGD-XXX-000_descricao-desktop_beta_YYYY-MM-DD.png` ou `AGD-XXX-000_descricao-mobile_beta_YYYY-MM-DD.png`. Adapte o código AGD ao código **real** da tela; não crie código fictício. O sufixo identifica ambiente e data de conferência, não a versão do aplicativo.

## Fluxo de coleta
1. Capturar a tela real da aplicação no ambiente correto (Beta ou produção), com perfil de testes autorizado.
2. **Antes de enviar ao GitHub**, anonimizar ou substituir qualquer nome, telefone, carteirinha, PIN, QR/link de acesso, identificadores pessoais, endereço particular e dados reais de convocação/presença. Não incluir segredos, cookies ou tokens.
3. Verificar dimensões e legibilidade em desktop e celular, evitando cortes de botões e rolagem horizontal indevida.
4. Registrar no PR o ambiente, a versão/build exibidos **quando disponíveis**, a data da captura, o perfil de teste, o código da tela, o capítulo destinatário e quem aprovou. Não inventar número de versão.
5. Adicionar a imagem à subpasta correspondente e referenciá-la no capítulo Markdown por caminho relativo. Exemplo: `![Tela de Setores — exemplo anonimizado](imagens-manual/estrutura-territorial/AGD-ADM-007_setores-mobile_beta_2026-10-27.png)`.
6. Submeter PR, validar redaction/anônimização, conteúdo e aceite do PO antes de merge e eventual distribuição.

## Restrições
- Nunca fazer commit da captura original contendo dados sensíveis, mesmo que depois seja removida: o histórico Git preserva versões.
- Os arquivos `.gitkeep` apenas mantêm a estrutura de diretórios no Git; ainda **não são evidências capturadas**.
- Não publicar automaticamente no site nem considerar os manuais definitivos. A `main` e a aplicação permanecem inalteradas.
