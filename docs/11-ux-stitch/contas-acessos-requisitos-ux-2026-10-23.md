# AGD-ADM-015 — Contas e Acessos: revisão UX

**Status:** demanda registrada para desenho, validação Gate A e implementação independente. **Código confirmado pelo PO:** AGD-ADM-015 (Contas e Acessos).

## Necessidade do PO (23/10/2026)

Redesenhar Contas e Acessos com:
1. **Filtros geográficos em cascata:** Regional → Administração → Setor → Casa de Oração, com seleção dependente, opção “Todos” por nível e limpeza dos descendentes.
2. **Filtro por Grupo de Trabalho:** selecionar GT e localizar pessoas integrantes daquele grupo (relação de participação efetiva); permitir “Todos” e, se necessário, a interseção com território de origem. Não confundir GT com escopo territorial ou com perfil `ADMIN_GT`.
3. **Filtro por tipo de acesso:** perfil/papel associado à pessoa, incluindo “Sem perfil ativo”; manter separadamente o **status da conta** (sem conta, ativa, pendente, bloqueada, desativada, recuperação PIN).
4. **Ordenação por nome:** ordem alfabética pt-BR A→Z como padrão, reversão Z→A disponível. Preservar alerta de recuperação de PIN visível sem alterar silenciosamente a ordenação escolhida.

## Confronto com implementação atual

Arquivo: `apps/web/src/components/acessos/ContasAcessoView.tsx`.

- Já existem busca por nome/celular/carteirinha, filtros geográficos cascata, `perfilFiltro`, `statusFiltro` e botão limpar filtros.
- Não foi identificado filtro por **participação em GT** em `ContasAcessoView`.
- A listagem reordena por `recuperacaoPinPendente`, e não pelo nome.
- `ContaAdministrada` contém dados territoriais, `acessos` e status, mas **não expõe participação em GT**. Confirmar fonte/API com autorização antes de propor contrato. Não buscar todos os participantes fora do escopo de acesso e não derivar participação a partir de perfil.
- A lista `contasExibidas` preserva itens com operações/feedback em andamento. Qualquer ordenação precisa manter feedback visível e não ocasionar perda de contexto.

## Critérios de aceite UX e funcional

- Organização visual com busca destacada, filtros geográficos agrupados, GT e tipo de acesso visíveis, status distinto e contagem de resultados.
- Filtros combináveis (interseção) e independentes quando aplicável; GT não é subtipo de Setor, Casa ou Administração.
- Lista ordenada corretamente em `pt-BR`, inclusive acentos, nomes iguais (desempate estável por identificador) e acesso por teclado.
- Filtragem e opções limitadas aos membros/GTs que o usuário já tem permissão de consultar; **a API deve aplicar restrições, não apenas o frontend**.
- Estados carregando, vazio, erro, sem resultados; reset acessível; mobile sem scroll horizontal; sem nomes truncados, com ações existentes preservadas e sem links/PIN expostos indevidamente.
- Avaliar necessidade de paginação/performance para centenas de contas antes de implementar.
- Sem uso de código Stitch diretamente: HTML é referência; implementação real React/Tailwind em PR separada após aceite visual.
- Cobertura de testes para cascata territorial, GT x território, tipo de acesso, status, nomes e permissões.


## Agrupamento e controle do volume — solicitação complementar do PO

A lista de contas **não deve ser uma sequência extensa de cards com rolagem contínua**. Preparar grupos recolhíveis/expansíveis com cabeçalho, contagem e estado aberto/fechado. Agrupamento inicial proposto: por **letra inicial do nome (A–Z)**, coerente com a ordenação nominal pedida; oferecer agrupamento alternativo por **Administração, Setor ou GT**, conforme viabilidade e sem confundir participação em GT com território de origem. Uma pessoa vinculada a vários GTs poderá aparecer em mais de um grupo de GT, com contagem de pessoas distintas no total.

- Cabeçalho dos grupos deve permitir abrir/fechar de forma acessível; preferir grupos fechados inicialmente em conjuntos extensos.
- Aplicar busca e filtros **antes** de formar os grupos; esconder grupos vazios e apresentar contadores de resultados.
- Dentro de cada grupo, ordenar nome em pt-BR, A–Z (padrão) ou Z–A; controlar volume com **paginação ou botão “Mostrar mais” em lotes** para impedir rolagem infinita mesmo com um único grupo grande.
- Em dispositivos móveis, cada conta usa card compacto, com ações secundárias recolhíveis; no desktop, avaliar linhas/tabela sem rolagem horizontal.
- Ao editar acessos, gerar link ou receber retorno de recuperação de PIN, manter a pessoa identificável/visível e preservar grupo, filtros e posição; não exibir tokens temporários ao navegar por outros registros.
- Registrar testes para grupos com muitos itens, letras acentuadas, mesma pessoa em vários GTs e estados de filtro/expansão.

**Referência indicada pelo PO:** tela de Funções. A inspeção de `FuncoesView.tsx` na `develop` identificou uma tabela com `funcoes.map(...)` (sem agrupamento ou paginação explícitos nesse componente). Portanto, reproduzir a **intenção de organização** informada pelo PO, mas confirmar a referência visual exata antes de afirmar paridade funcional com Funções.

## Atualização do PWA — observação do PO

Em 23/10/2026, o PO observou que o navegador abriu uma versão anterior e só exibiu filtros já existentes após atualizar manualmente a página. Registrar demanda independente: verificar comportamento da atualização automática em primeiro acesso, reinstalação/aba suspensa, controle do service worker, cache de `index.html` e retorno de operações sensíveis; exigir teste real na Beta antes de autorizar produção. Identificação relatada da produção: `v1.1.0 · build f8610c2`, **ainda sem confirmação de implantação do gatilho de atualização nesse build**.

## Gate

**Gate A aberto** para esta tela; não há protótipo Stitch aprovado, nem autorização para redesign funcional nesta PR. Proposta de tela desktop/mobile e verificação do código definitivo são próximas tarefas.
