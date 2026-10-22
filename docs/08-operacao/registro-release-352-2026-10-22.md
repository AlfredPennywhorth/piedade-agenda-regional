# Registro de encerramento — Release #352

**Data da implantação e do smoke:** 22/10/2026
**Ambiente:** Produção — `main`
**PR:** [#352](https://github.com/AlfredPennywhorth/piedade-agenda-regional/pull/352)
**Commit do release:** `f8610c26a316086357a1c7997b826f5d9f27359f`
**Escopo:** Membros (paginação e filtros, busca sem acentos, tratamento de falhas), ordenação de Eventos e regressões associadas.

## Evidências de publicação
- [CI da main — #39765874846](https://github.com/AlfredPennywhorth/piedade-agenda-regional/actions/runs/39765874846) — sucesso.
- [Worker produção — #39780769044](https://github.com/AlfredPennywhorth/piedade-agenda-regional/actions/runs/39780769044) — sucesso, SHA igual.
- [Pages produção — #39780913841](https://github.com/AlfredPennywhorth/piedade-agenda-regional/actions/runs/39780913841) — sucesso, SHA igual.

## Proteção dos dados
- Banco: `piedade-agenda-db-prod`.
- Bookmark Time Travel obtido em 22/10/2026; identificador mantido no registro operacional restrito, não reproduzido neste documento público.
- Exportação SQL realizada em 22/10/2026 por Wrangler no Codespaces, arquivo `backup-agenda-prod-2026-10-22.sql` (aprox. 1006 KB).
- O PO informou ter confirmado e preservado o backup antes dos deploys. Não anexar arquivos SQL, URLs assinadas, tokens ou dados pessoais ao repositório.
- **Não houve restauração do D1.**

## Smoke funcional informado pelo PO
| Cenário | Resultado |
|---|---|
| Acesso | PASSOU |
| Membros | PASSOU |
| Pesquisa com/sem acento | PASSOU |
| Filtros | PASSOU |
| Eventos | PASSOU |
| Permissões | PASSOU |
| Minha Agenda | PASSOU |

**Resultado:** 7/7 PASSOU, 0 falhas relatadas. Homologação funcional de produção concluída no escopo acima. O smoke não substitui a observação operacional continuada.

## Pós-release
1. Observar erros de autenticação, permissões, Membros, Eventos e convocações na operação real, usando métricas/logs da Cloudflare sem divulgar dados pessoais.
2. Manter como dívida técnica a transferência de busca, ordenação, contagem e paginação de Membros para o D1, com estratégia de campo de busca normalizado e preservação das restrições de visibilidade.
3. Atualizar o Manual de Uso tomando como referência a versão efetivamente publicada. Não incorporar visualizações ainda não implementadas do Stitch.
4. Novo ajuste funcional segue fluxo separado: issue/PR → develop → CI/preflight → Beta → autorização expressa de promoção.
