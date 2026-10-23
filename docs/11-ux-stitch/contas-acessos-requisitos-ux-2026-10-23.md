# AGD-ADM-059 (provisório) — Contas e Acessos: revisão UX

**Status:** demanda registrada para desenho, validação Gate A e implementação independente. **Código 059 provisório:** conferir contra inventário canônico antes de publicação definitiva.

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

## Gate

**Gate A aberto** para esta tela; não há protótipo Stitch aprovado, nem autorização para redesign funcional nesta PR. Proposta de tela desktop/mobile e verificação do código definitivo são próximas tarefas.
