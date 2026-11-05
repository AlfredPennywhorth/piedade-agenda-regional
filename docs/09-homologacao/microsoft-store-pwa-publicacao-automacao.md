# Agenda Regional São Paulo — Microsoft Store / PWA Windows

**Estado:** planejamento e pré-validação, sem publicação. A conta de desenvolvedor foi criada, porém o produto ainda não foi reservado nem submetido. Este roteiro não autoriza publicação, merge em main ou a liberação institucional da LGPD (#452). Release seletiva #469 permanece independente.

## 1. Regras de distribuição

- O aplicativo Windows será um pacote PWA vinculado exclusivamente ao endereço HTTPS estável da **produção**: `https://main.piedade-agenda-regional.pages.dev/` (confirmar URL definitiva, manifest, identidade, direitos de domínio e política de URLs antes de empacotar).
- Não usar `beta.piedade-agenda-regional.pages.dev`, deploy preview, credenciais de teste ou dados pessoais reais nas imagens/listagem da loja.
- O PWA usa VitePWA (`apps/web/vite.config.ts`) e atualização via service worker. O conteúdo Web publicado pode atualizar sem nova submissão de pacote; alterações de identidade/pacote/metadados da Store são lançamentos próprios.
- A inclusão na Microsoft Store é uma etapa **institucional**: exigem-se titularidade e autorização para nome, marca, descrição institucional, distribuição pública, política de privacidade aprovada e suporte. A revisão institucional LGPD pendente impede dar por aprovado o conteúdo de privacidade na loja.
- Conta desenvolvedor de pessoa física não implica autorização para representar entidade religiosa; verificar se o tipo de conta e o publisher correspondem ao controlador e à entidade autorizada, conforme políticas Microsoft.

## 2. Primeira submissão (necessariamente via Partner Center)

1. [ ] Entrar no Partner Center com a conta registrada e concluir verificações cadastrais.
2. [ ] **Apps and games → New product → MSIX or PWA app**; conferir disponibilidade e reservar `Agenda Regional São Paulo` (ou denominação institucional autorizada). Reservas não utilizadas expiram após 3 meses; anotar validade.
3. [ ] Em **Product management → Product Identity** obter *Package ID*, *Publisher ID*, *Publisher display name*, e registrar apenas identificadores necessários; não compartilhar secrets.
4. [ ] Confirmar que o titular tem direito de apresentar a Agenda e o domínio na Store e que o texto da loja não implica chancela institucional ainda não concedida.
5. [ ] Validar a versão **main efetivamente publicada**: HTTPS, nome e ícones do manifesto, tela de login, experiência offline (sem prometer uso offline das convocações), atualização do service worker, navegação, Windows 10/11 e modo standalone. Executar workflow de pré-validação `store-pwa-readiness.yml` (build local, sem deploy).
6. [ ] No [PWABuilder](https://www.pwabuilder.com/) usar a URL definitiva **de produção**, revisar relatório de prontidão e gerar pacote Windows com *Package ID/Publisher ID/display name* exatos. Não empacotar o build Beta nem presumir que testes locais substituem URL pública.
7. [ ] Preparar descrição e capturas **sanitizadas** da aplicação; informar que acesso requer cadastro/convocação institucional, sem sugerir que qualquer público acessa reuniões. Providenciar acesso de teste válido para a certificação se a Microsoft solicitar (sem informações pessoais reais).
8. [ ] Revisar classificação etária, mercados, visibilidade, política de privacidade **institucionalmente aprovada**, suporte, permissões do aplicativo e conformidade com políticas de dados. **Não submeter** enquanto a liberação do aviso LGPD e representação institucional estiverem pendentes.
9. [ ] Enviar o pacote inicial via Partner Center, obter certificação e verificar instalação/atualização no Windows; registrar ID do produto, versão, URL pública da loja e data de publicação no controle de releases.

Fontes oficiais: [Publicar PWA no Microsoft Store](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/microsoft-store), [Reservar nome](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/pwa/reserve-your-apps-name), [Store CLI](https://learn.microsoft.com/en-us/windows/apps/publish/msstore-dev-cli/overview), [Políticas Microsoft Store](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies).

## 3. Automação GitHub por fases

### Fase A — agora (sem credenciais e sem ações externas)
- `.github/workflows/store-pwa-readiness.yml`: verifica build e manifesto gerados em runner temporário, e registra diagnóstico. Apenas `pull_request` para a PR de preparação ou disparo manual. Não publica no Cloudflare ou Microsoft e não lê GitHub Secrets.
- Não alterar workflows de produção nem adicionar dependência entre o deploy #469 e a Store.

### Fase B — após primeira publicação na Store
- Configurar ligação do Partner Center a um tenant Microsoft Entra, registro de aplicativo com permissões mínimas e secrets GitHub por **Environment** com revisores: `PARTNER_CENTER_TENANT_ID`, `PARTNER_CENTER_SELLER_ID`, `PARTNER_CENTER_CLIENT_ID`, `PARTNER_CENTER_CLIENT_SECRET` (ou certificado seguro).
- Preparar workflow **apenas de detecção** disparado quando `Deploy Pages — Produção` terminar com sucesso em `main`. Conferir no GitHub o workflow Worker **do mesmo SHA**, smoke aprovado, URL do aplicativo e commit realmente implantado; não confiar apenas no push ou merge. Publicar no resumo do workflow a classificação: *conteúdo Web* (sem submissão à Store) ou *mudança de pacote/identidade/metadados* (nova submissão candidata).
- Guardar identidade do pacote, manifest e metadados Windows em diretório específico versionado; detecção pela comparação de SHA/diff contra o **último pacote realmente aceito na Store** (não comparar com o commit imediatamente anterior para evitar perder mudanças acumuladas).
- Ao mudar pacote/metadados, criar solicitação de aprovação humana no GitHub (Environment protegido, preferencialmente `microsoft-store`), gerar pacote, validar assinatura/identidade e, somente após aprovação expressa, chamar Microsoft Store Developer CLI (`microsoft/microsoft-store-apppublisher`). Usar teste/consulta antes da operação de publicação e registrar submissão, certificação e eventual rejeição.
- Manter rollback de pacote Windows distinto do rollback do conteúdo Web na Cloudflare. Atualização do PWA instalado e aprovação de pacote pela Microsoft têm calendários diferentes.

### Fase C — governança permanente
- `develop` Beta nunca aciona a Store. `main` publicada e aprovada é a única origem elegível, incluindo releases seletivas.
- Sem alteração de produto/identidade/pacote, **não** criar uma submissão desnecessária. Nunca fazer submissão automática a cada push em main.
- Qualquer publicação na Microsoft depende de autorização institucional, LGPD aprovada, metadados verdadeiros e evidências de conformidade.
- Registrar a licença/termos da distribuição, versão de pacote, SHA de produção, data de certificação e responsável.

## 4. Bloqueios atuais

| Condição | Estado |
| --- | --- |
| Conta Microsoft de desenvolvedor | Criada (informado pelo PMO) |
| Nome reservado e Product Identity | Pendente de ação no Partner Center |
| Endereço de produção definitivo e manifest Windows | A validar |
| Titularidade institucional/nome/marca e política de privacidade | Pendente de aprovação |
| Primeiro pacote e certificação Store | Não realizados |
| Tokens/credenciais API da Store | Não criar ainda |
| CI/checks GitHub PWA | Preparação neste PR |
| Release seletiva #469 | Independente, sem autorização de merge/deploy |

**Gate atual: PREPARAÇÃO.** Nenhum pacote submetido, nenhum segredo criado, nenhum deploy disparado.
