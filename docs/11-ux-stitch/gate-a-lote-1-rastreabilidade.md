# Rastreabilidade — Gate A do lote 1 (cadastros territoriais)

**Estado:** aceites visuais condicionados registrados; **Gate A integral ainda não concluído**. Não autoriza implementação, deploy ou mudança funcional.

## Verificação do repositório em 16/10/2026 (atualizada para a PR #328 em 19/10/2026)

- PR #320 (Locais/Espaços): **mesclada** na develop em 15/10/2026 (merge `2898566`); já não é pendência de merge.
- PR #321 (Regionais/Administrações/GTs): **mesclada** na develop (merge `68be8ad`).
- Handoffs presentes: Setores, Casas, Locais/Espaços, Regionais/Administrações e Grupos de Trabalho.
- O arquivamento de HTMLs originais está **em andamento por sublote**, não universalmente concluído. **Locais/Espaços:** seis arquivos versionados na branch da PR #328, aguardando merge em `develop`; outras superfícies exigem validação específica. Não equiparar anexos de conversa a artefatos versionados.
- Regionais/Administrações: oito propostas aprovadas com ressalvas; identificar hashes e consolidar correspondência de cada arquivo de origem antes de declarar Gate A.
- Locais/Espaços: as seis propostas estão recuperáveis como HTML no commit `567dc4f1ad6871238e71fa7c552d63918055b9f8` da PR #328, sob `docs/11-ux-stitch/prototipos/lote-1/locais-espacos/originais/`, com manifesto SHA-256. Ainda aguardam integração à `develop` e validação final do Gate A. Para `AGD-ADM-057`, o hash do arquivo agora versionado atesta os bytes recebidos pelo GitHub, **não** sua equivalência byte a byte à transcrição anterior ou a uma exportação original do Stitch.
- Setores e Casas: detalhar e recuperar fontes finais aprovadas, variantes mobile onde aplicáveis e estado dos subfluxos.

## Grupos de Trabalho: inventário da remessa final do Stitch

| Código e variante | Arquivo original recebido | SHA-256 dos bytes do anexo |
|---|---|---|
| `AGD-ADM-009` desktop | `Texto colado(20261016-123715).txt` | `6d60f61aed51898b79e2793e9e903dee8754ac8e9e1b810c6d01360ad7dadbe3` |
| `AGD-ADM-009` mobile | `Texto colado (4)(10).txt` | `4135a63cfdd5182f3ec9e3bf708348a5bafe261c729b3bbb01be2129278dceed` |
| `AGD-ADM-045` cadastro | `Texto colado (5)(9).txt` | `dca0de545b3c1fc1d441bf8e785f7467e1283c9e2c56cc1fdc071e94eac4ea94` |
| `AGD-ADM-046` edição | `Texto colado (2)(20261016-123748).txt` | `4c37e2e35a0b592caf497cb08b1bc7cae4159c7dd6288486bf986ffd54926066` |
| `AGD-ADM-047` detalhes | `Texto colado (3)(20261016-123808).txt` | `14356a95cb1218f09bcaf56f9638735c3d97dd7a24c2435e6e43937af2290289` |

**Custódia de GTs:** os cinco HTMLs de Grupos de Trabalho citados na tabela acima estão versionados em `docs/11-ux-stitch/prototipos/lote-1/grupos-trabalho/`, com hashes SHA-256 conferidos na revisão da release. Não existe manifesto separado nesse diretório; a própria tabela registra os hashes. **Isso não conclui o Gate A integral**, que ainda depende das verificações visuais e dos demais sublotes. Não é necessário reimportar esses cinco HTMLs por ZIP.

## Critério do PO para mockups (16/10/2026)

Exemplos inventados de informações cadastráveis pelo usuário não bloqueiam aceite **estético**. Invenção de **rótulos, títulos, legendas nativas, campos, opções de filtro, permissões e fluxos** exige adequação ao produto real. Tema escuro usa tokens compartilhados da primeira remessa, sem duplicação de telas por geração do Stitch.

## Próxima barreira

1. Arquivar protótipos originais em repositório, com hashes e origem imutável.
2. Conferir matriz de códigos `AGD-ADM-005/006/007/008/009/013` e suas subtelas aprovadas; não inferir aceite funcional.
3. Verificar lacunas de subestados mobile/desktop a partir dos componentes reais; solicitar PO apenas se houver novo comportamento ou alteração visual material.
4. Encerrar Gate A **somente após** rastreabilidade e cobertura; autorização de implementação React/Tailwind será decisão independente do PO.

## Checklist consolidado de aceite (22/10/2026)

Consultar a [Matriz de fechamento do Gate A — Lote 1](matriz-fechamento-gate-a-lote-1-2026-10-22.md) para códigos, variantes, ressalvas e critérios de evidência por tela. A matriz não altera os aceites condicionados anteriores nem encerra o Gate A.

## Atualização de evidências — Casas e menu Mais (22/10/2026)

Os seis HTMLs de Casas de Oração (quatro protótipos principais e duas variantes comparativas) **já constam na `develop`**. O documento de origem da pasta contém pendências históricas de arquivamento que não representam o estado atual do GitHub. A escolha das versões B de cadastro e edição foi registrada pelo PO em 19/10. Há uma divergência a resolver sobre paginação na referência mobile versus o escopo funcional atual. Consultar [auditoria preliminar de Casas e Mais](auditoria-gate-a-casas-mais-2026-10-22.md) antes de concluir o Gate A.
