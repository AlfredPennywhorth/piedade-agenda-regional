# Protótipos — Casas de Oração

## 1. Objetivo

Esta pasta reúne os protótipos visuais desenvolvidos no Google Stitch para o módulo de Gestão Territorial — Casas de Oração, integrante da Agenda Piedade Regional São Paulo.

Os arquivos são preservados como referências visuais para a futura implementação das melhorias de interface, respeitando os critérios de aceite visual condicionado do Product Owner (PO).

O arquivamento não representa autorização para implementar, alterar funcionalidades ou realizar deploy.

## 2. Inventário dos protótipos

| Código | Arquivo | Descrição |
|---|---|---|
| AGD-ADM-008 | AGD-ADM-008-desktop.html | Listagem de Casas de Oração — desktop |
| AGD-ADM-008 | AGD-ADM-008-mobile.html | Listagem de Casas de Oração — mobile |
| AGD-ADM-043 | AGD-ADM-043-cadastro.html | Formulário de cadastro de Casa de Oração |
| AGD-ADM-044 | AGD-ADM-044-edicao.html | Formulário de edição de Casa de Oração |

**Total:** quatro protótipos distintos.

Uma cópia duplicada do formulário AGD-ADM-044 foi identificada e excluída do conjunto destinado ao arquivamento.

## 3. Diretrizes para implementação futura

A implementação deverá observar os seguintes critérios:

- Preservar as funcionalidades, os campos e as regras de negócio existentes na aplicação.
- Respeitar a hierarquia territorial: Regional → Administração → Setor → Casa de Oração.
- Respeitar as permissões e os níveis de acesso dos usuários.
- Utilizar React, Tailwind CSS e os componentes compartilhados do projeto.
- Manter a identidade visual institucional e a fonte Inter.
- Adaptar a interface para desktop e dispositivos móveis, evitando rolagem horizontal desnecessária.
- Priorizar legibilidade, acessibilidade e facilidade de navegação.
- Preservar os tokens de tema claro e escuro compartilhados.
- Exibir versão, build e ambiente dinamicamente, exclusivamente no rodapé.
- Não incorporar dados demonstrativos ou funcionalidades inventadas pelo Google Stitch.
- Não copiar diretamente scripts e interações demonstrativas dos HTMLs.

## 4. Ressalvas e validações

Os protótipos constituem referências de apresentação visual, não especificações funcionais definitivas.

Antes da implementação, deverão ser confrontados com:

1. O inventário oficial de telas.
2. As funcionalidades efetivamente existentes.
3. A matriz vigente de permissões.
4. As regras de negócio de Casas de Oração.
5. As diretrizes consolidadas de UX do projeto.

A presença de dados fictícios, indicadores, estatísticas, campos complementares ou referências institucionais nos protótipos não autoriza sua implementação.

## 5. Rastreabilidade

Documentos de referência:

- `docs/11-ux-stitch/DESIGN.md`
- `docs/11-ux-stitch/gate-a-lote-1-rastreabilidade.md`
- `docs/inventario-codigos-telas.md`
- Documentação de aceite visual correspondente a Setores e Casas de Oração.

A verificação dos arquivos deverá utilizar hashes SHA-256 e os identificadores imutáveis dos commits GitHub.

Os arquivos originais devem permanecer preservados, sem alterações de conteúdo durante o arquivamento.

## 6. Pendências identificadas

- Confirmar a completude dos protótipos de Setores.
- Validar o código AGD-ADM-041, que aparece em um protótipo de navegação denominado "Mais" e também como referência secundária em um arquivo de Casas de Oração.
- Conferir os quatro protótipos de Casas de Oração com o inventário e o aceite visual condicionado.
- Atualizar a rastreabilidade do Gate A após a incorporação dos arquivos na branch `develop`.

O protótipo do menu "Mais" deve permanecer separado desta pasta até a confirmação de seu código oficial.

## 7. Situação do arquivamento

| Etapa | Situação |
|---|---|
| Identificação dos quatro protótipos | Concluída |
| Identificação de duplicatas | Concluída |
| Padronização dos nomes | Concluída |
| Conferência com o inventário oficial | Pendente |
| Arquivamento no GitHub | Pendente |
| Validação de integridade após arquivamento | Pendente |
| Encerramento do Gate A integral | Pendente |
| Autorização de implementação | Não concedida |

**Classificação:** documentação de referência visual, sujeita às ressalvas do aceite condicionado.

**Importante:** estes arquivos não devem ser tratados como código de produção nem substituir as especificações funcionais da aplicação.
