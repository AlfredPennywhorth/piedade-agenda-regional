# Central de Ajuda e ajuda contextual

Mais → Central de Ajuda abre a busca por assunto, palavras sem acentos ou código oficial. Nas telas prioritárias, Ajuda abre o artigo correspondente. Nos formulários e detalhes com código próprio, Ajuda desta tela mantém a mesma orientação do módulo. Fechar ajuda ou Escape retorna ao trabalho sem navegar, salvar ou limpar campos.

O painel usa diálogo modal nativo: foco contido, fundo indisponível e retorno ao botão de origem. Pode rolar em telas pequenas. O código da Central é AGD-SHR-006; os identificadores anteriores permanecem inalterados.

## Referências cotejadas

Conteúdo editorial resumido em `apps/web/src/components/ajuda/artigos.ts`, derivado de:

- `manual-uso-locais-espacos-territorio.md`: Regionais, Administrações, Setores, Casas e Locais/Espaços.
- `manual-uso-gt-membros-funcoes-vinculos.md`: Membros, Funções e Vínculos.
- `manual-uso-contas-acessos-permissoes-seguranca.md`: Contas/Acessos e sessões.

Conferência na implementação: `MainLayout.tsx`, `App.tsx`, componentes dos nove módulos, `apps/worker/src/security/permissoes.ts` e rotas `membros.ts` e `locais.ts`. A navegação real de Locais exige `podeGerirAgenda`, apesar de o manual de referência mencionar acesso de membros comuns. A ajuda respeita a navegação atual, sem ampliar acesso. Não incorpora pendências editoriais, dados de membros, credenciais, links temporários nem runbooks internos.

## Visibilidade

| Conteúdo | Capacidade efetiva |
|---|---|
| Como usar a ajuda | Todas as contas autenticadas |
| Estrutura Territorial | podeAdministrarEstrutura |
| Criação/edição de Regional | podeAdministrarRegionais, dentro do artigo territorial |
| Locais/Espaços | podeGerirAgenda |
| Membros e Vínculos | podeAdministrarPessoas |
| Funções | podeAdministrarFuncoes |
| Contas/Acessos | podeAdministrarAcessos |
| Instruções de sessões | podeGerenciarSessoes, dentro de Contas/Acessos |

O filtro ocorre antes da busca e da seleção de artigos. Texto estático da aplicação não contém segredos; a filtragem editorial não substitui autorização do servidor. Toda escrita continua sujeita às regras existentes de perfil e escopo.

## Validação e integração

Testes de ajuda exercitam as nove telas, busca, ausência de resultados, capacidades, retorno de foco, fechamento e preservação de campos. Integram a etapa `pnpm test` da CI existente. Nenhuma alteração de banco, API ou política de promoção. PR para develop independente de #344/#345 (reconciliação de branches) e #346 (testes do preflight); não inclui merge ou deploy.
