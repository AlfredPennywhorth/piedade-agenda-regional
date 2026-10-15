# Stitch — Locais e Espaços: aceite visual condicionado

**Decisão expressa do Product Owner — 15/10/2026:** aprovada a **direção visual** das seis propostas do sublote **Locais e Espaços**, condicionada a todos os ajustes abaixo. Esta decisão não homologa HTML, fluxos simulados, permissões, APIs ou comportamento em dispositivo real; **não autoriza implementar em develop/Beta ou main/produção**, nem encerra o Gate A integral do lote 1.

| Código canônico | Superfície/variante | Parecer visual |
|---|---|---|
| `AGD-ADM-013` | Gestão de Locais — desktop | Aceite condicionado: tabela legível, pesquisa e ações Detalhes/Ver Espaços/Editar |
| `AGD-ADM-013` | Gestão de Locais — mobile | Aceite condicionado: cards sem rolagem horizontal e três ações acessíveis |
| `AGD-ADM-055` | Novo Local | Aceite condicionado: Identificação/Escopo, Endereço e Geolocalização/Navegação |
| `AGD-ADM-056` | Editar Local | Aceite condicionado: formulário dedicado e sem rolagem interna concorrente |
| `AGD-ADM-057` | Detalhes do Local | Aceite condicionado: nome, endereço, coordenadas, links Google Maps/Waze, status |
| `AGD-ADM-058` | Espaços do Local | Aceite condicionado: criação e edição no **mesmo código**, sem superfície nova |

## Proveniência das propostas avaliadas — rastreio de arquivos

O PO enviou **cinco arquivos HTML como anexos de conversa** e **um HTML colado diretamente na conversa**, na rodada de 15/10/2026. As impressões SHA-256 abaixo identificam **bytes exatos** dos anexos recebidos (não são hashes de commits GitHub, nem significam que os arquivos foram versionados neste repositório). Conservar os anexos originais; qualquer regeneração pelo Stitch precisa de nova avaliação. A vinculação a URLs/IDs permanentes do projeto Stitch ainda deverá ser completada antes de encerrar o gate de rastreabilidade.

| Superfície | Arquivo de origem recebido | SHA-256 do arquivo original |
|---|---|---|
| AGD-ADM-013 desktop | `Texto colado(20261015-194638).txt` | `afb62db71e25858df4a86eb1d64f9205c900d4b94be583f7cfe3534d010cd8c8` |
| AGD-ADM-013 mobile | `Texto colado (2)(8).txt` | `beea02fb2fff47c0f07f5a8483728e67c281dbbc2a8108d77cb5d328c08a6e72` |
| AGD-ADM-056 edição | `Texto colado (3)(7).txt` | `f93ec5978a9d78479fd10a925e7eb03105a3f59eb5c9656f1dabbc5e2b40b144` |
| AGD-ADM-055 cadastro | `Texto colado (4)(5).txt` | `cc55730d667cda86a56df1178a670cdb4a2531b92b1b31eeb3c41feb240dae0c` |
| AGD-ADM-058 Espaços | `Texto colado (5)(4).txt` | `13d689dbb0ac2b59efd89ffaf0838d85fb8913e2a0519456219692d8d8de98c6` |
| AGD-ADM-057 detalhes | HTML integral fornecido novamente pelo PO na conversa em 15/10/2026, título `AGD-ADM-057 - Detalhes do Local`; cópia local de referência `agd-adm-057.html` | `4ffb09061992900bcff57190548c900b1e48329487acfb364dacfdb5d326d992` (hash da transcrição em arquivo UTF-8 com LF; não equivale a exportação imutável do Stitch) |

**Situação de rastreabilidade:** as **seis propostas agora estão identificadas por SHA-256**, mas o P2 só estará **inteiramente resolvido** após arquivar os artefatos exatos em um endereço GitHub imutável (commit/blobs) ou registrar IDs de versão do Stitch. Hashes e nomes em conversa não constituem, por si, hospedagem recuperável. A referência AGD-ADM-057 é uma transcrição textual do conteúdo fornecido pelo PO, sem garantia de equivalência byte a byte ao eventual arquivo exportado. Não declarar o gate de rastreabilidade encerrado antes de validar os artefatos.

## Correções obrigatórias antes de qualquer implementação

1. **Escopo e autorizações.** No cadastro, remover opções inventadas de “Setorial Capital”, “Setorial Zona Leste”, “Região Metropolitana” etc.; selecionar apenas valores suportados pelos enums, APIs e permissões atuais. Na edição usual de Local já classificado, não criar seletor de escopo inexistente na captura. **Exceção legada obrigatória:** em `LocaisView.tsx`, para usuário Master editando Local institucional legado ainda sem escopo, preservar o seletor `Classificar local legado — escopo institucional`; `routes/locais.ts` aceita enviar escopo somente nessa condição. Proteger por perfil e condição do registro, não generalizar o seletor a todas as edições. Preservar distinção entre Local, Espaço e Casa de Oração.
**Matriz de ações por origem/autoria (AGD-ADM-055/058):** o membro comum autenticado e ativo, com Casa de Oração de origem e Setor ativos, pode criar Local institucional **somente** no Setor de origem da sua Casa (`POST /locais`); a API deriva/valida o vínculo real, sem atribuir perfil gestor. Para o **Local institucional de sua autoria**, ativo, de escopo SETOR, enquanto persistirem autor, Casa e Setor válidos e o Setor de origem coincidir, pode **adicionar** Espaço (`POST /espacos-locais`), mas não recebe permissão de **editar** Local (`PATCH /locais/:id`) nem Espaço (`PATCH /espacos-locais/:id`). Gestores/Master mantêm ações conforme autorização territorial. Locais particulares próprios seguem rotas/permissões separadas. A UI deve avaliar visibilidade **por ação e registro** (criar Local, adicionar Espaço, editar Local, editar Espaço), nunca ocultar ou liberar todas em bloco. Referência: `apps/worker/src/routes/locais.ts` e `apps/worker/src/routes/espacos-locais.ts`, inclusive `podeCriarEspacoNoLocalDeAutoria`. **Nota histórica:** a matriz de `docs/09-decisoes-adr/permissoes-territoriais-locais.md` ainda contém vedação genérica de criar Espaços institucionais para USUARIO_COMUM; o código atual contém a exceção específica de autoria e deverá prevalecer na verificação funcional. Não ampliar a exceção a PATCH. 

2. **Navegação.** Não criar menus “Visão Geral”, “Agendamentos” e atalhos fora do produto; preservar Minha Agenda, Eventos, Calendário, Convocações e Mais, com visibilidade condicional por capabilities.
3. **Cores e temas.** Substituir azul `#002B5C` e outras tonalidades divergentes por tokens semânticos únicos de `docs/11-ux-stitch/DESIGN.md`; mesma identidade de cabeçalho em todas as telas e variantes. Preparar claro/escuro/automático sem copiar Tailwind CDN do protótipo para produção.
4. **Metadados.** Ambiente, versão e build reais apenas no rodapé, não inventar versões, perfis nem unidades como “Administração Geral” ou “Regional Grande São Paulo”.
5. **Campos preservados.** Cadastro: Escopo institucional*, Nome*, CEP, Bairro, Endereço*, Número*, Complemento, Referência, Cidade*, UF*, Latitude, Longitude, URL Google Maps, URL Waze, Local Ativo, Cancelar/Salvar. Edição: preservar campos reais da captura e Cancelar/Salvar; escopo normalmente oculto, **exceto** seletor de classificação para Master em Local institucional legado sem escopo. Detalhes: nome, endereço, coordenadas, Google Maps/Waze, status. Espaços: Nome*, Capacidade, Descrição, ativo, listagem Espaço/Capacidade/Status, Adicionar, Editar, Cancelar edição/Atualizar.
6. **Formato e dados.** Coordenadas devem respeitar formato/validação da API existente (a referência mostra ponto decimal; Stitch usou vírgula em edição). Não transportar URLs, endereços ou dados de exemplo como constantes; **preservar a ordenação alfabética dos Locais físicos prevista na issue #242 e em `docs/10-planejamento-s13/s13-stitch-handoff.md`**; não inventar contadores, critérios de ordenação adicionais, filtros adicionais ou estatísticas. Pesquisa deve continuar compatível com nome, endereço, bairro, cidade, UF e CEP reais.
7. **UX mobile.** Sem rolagem horizontal da página; nomes e endereços compridos não devem ser ocultados por `truncate`; garantir áreas de toque, zoom e áreas seguras. Rodapé técnico não cobre navegação inferior. Botão de “filtrar” extra da listagem mobile exige validação funcional e não é aprovado como novo controle.
8. **Edição de Espaços.** Ao clicar Editar, garantir que o formulário fique visível, com foco coerente inclusive quando selecionado no final de uma lista longa. Reutilizar `AGD-ADM-058` com estado de edição, sem alterar API/rotas ou presumir que eventos simulados no HTML salvam dados.
9. **Segurança e identidade CCB.** Proibido utilizar cruzes, crucifixos, `church` ou símbolos religiosos inadequados. Usar ícones neutros validados. Preservar validações, proteção por perfil e navegação já existentes.
10. **Acessibilidade/qualidade.** Testes de teclado e foco, zoom, contrastes WCAG AA e larguras 360/390/430/768/1280/1440; estados loading/erro/vazio, fechar/cancelar sem perder contexto, feedback apenas após confirmação da API. Verificar responsividade desktop/mobile reais.

## Gates e sequência

- **Esta PR:** documentação de aceite condicionado apenas; revisão Codex e CI antes de qualquer merge documental.
- **Antes da implementação:** verificar referência de cada proposta Stitch, telas e subestados, confirmar permissões/escopos e obter autorização **específica** do PO conforme Gate A aplicável.
- **Se autorizada posteriormente:** PR React/Tailwind independente, CI, revisão, smoke Beta por perfis e somente depois decisão de release. Nada altera a produção por este registro.
