# Plano de validação editorial e capturas — Manual de Uso (#170)

**Estado:** plano para homologação do PO. Não corresponde a aceite de capítulos, telas ou material de distribuição. Fonte: capítulos em `docs/08-operacao` e diretório de imagens criado na PR #412.

## Passos que podem ocorrer sem interação do PO
1. Conferir links Markdown entre `manual-usuarios.md` e os oito capítulos.
2. Identificar instruções com campos condicionais, como períodos de participação no RSVP (corrigido pela PR #410).
3. Preparar o inventário de capturas por jornada, com código AGD, perfil, ambiente, viewport e versão a registrar na coleta.
4. Rever textos e alternativas acessíveis, sem incluir capturas do Stitch nem dados reais.

## Matriz inicial de capturas a coletar

| Jornada | Tela ou situação recomendada | Pasta | Requer homologação com perfil |
|---|---|---|---|
| Acesso | Login e Meu Cadastro sem dados pessoais | `acesso/` | Usuário Comum |
| Minha Agenda | Lista/calendário, detalhes e resposta de convocação | `minha-agenda/` | Usuário Comum convocado |
| Eventos | Criação, detalhes, série e convocação | `eventos-convocacoes/` | Gestor de Agenda |
| Membros | Consulta, inclusão e vínculos funcionais | `membros/` | Administrador autorizado |
| Território | Listagem de Setores, detalhes, cadastro e edição | `estrutura-territorial/` | Gestor territorial |
| Locais | Listagem e gestão de Local/Espaço | `estrutura-territorial/` | Gestor territorial |
| Portaria | Recepção/QR, conferência manual, fechamento | `portaria/` | Operador e gestor de Portaria |
| Relatórios | Relatório de presença e filtros | `relatorios/` | Gestor de Relatórios |
| Administração | Contas e Acessos e permissões | `administracao/` | Administrador/Master |
| Auditoria | Consulta de trilha autorizada, sem dados pessoais | `administracao/` | Auditor |

## Campos de controle para cada imagem
- Código da tela/subtela (AGD), jornada, nome do arquivo, legenda e texto alternativo.
- Ambiente (Beta ou produção), versão/build consultado, data da captura, perfil de teste, desktop/mobile.
- Revisão de privacidade: sem PIN, celular, carteirinha, nome real, token, QR de ativação, informações confidenciais.
- Resultado: pendente, rejeitado, aprovado pelo PO; referência ao capítulo e ao commit da imagem.

## Critérios de fechamento documental
- [ ] Conferência do texto de cada capítulo na versão efetivamente utilizada.
- [ ] Cobertura das trilhas de perfis, permissões e principais mensagens de erro.
- [ ] Capturas reais anonimizadas e legendadas nas pastas da PR #412.
- [ ] Referências de build e data de revisão editorial preenchidas.
- [ ] Aprovação expressa do PO para distribuição.

**Dependência:** a coleta e a homologação de imagens reais dependem de acesso às telas, perfil de teste autorizado e versão estável. Não incluir dados pessoais no repositório. Não fechar #170 com este plano.
