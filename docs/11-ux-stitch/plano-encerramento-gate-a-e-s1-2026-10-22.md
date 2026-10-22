# Encaminhamento do PO — Gate A antes do Hardening S1

**Data:** 22/10/2026  
**Deliberação:** priorizar o encerramento do Gate A Stitch; iniciar a etapa de segurança S1 **somente na sequência**. Esta ordem não equivale a aceite final de telas, autorização de implementação React ou deploy.

## Pacotes de aceitação visual

| Subgrupo | Arquivos localizados na develop | Necessário para aceite final |
|---|---|---|
| Casas de Oração | 008 desktop/mobile, 043/044, duas variantes comparativas | Aplicar decisões visuais de 19/10; resolver zoom bloqueado, seis nomes truncados, cabeçalho e edição sem rolar ao topo como requisitos de implementação; distinguir testes do protótipo de testes pós-React |
| Menu Mais | Código do protótipo ainda não confirmado | Vincular origem e código canônico; revisar grupos retráteis e capabilities reais |
| Setores | Pacote de originais e unificados | Confirmar variantes finais 007/041/042, eliminar filtros fictícios/duplicados |
| Locais/Espaços | Pasta `originais` + manifesto | Confrontar 013/055/056/057/058 com fluxo real; documentar ressalva de equivalência da origem 057 |
| Regionais/Administrações | Oito HTMLs 005/006/037/038/039/040 | Fechar identificação por código, origem e aprovação de variantes |
| Grupos de Trabalho | Cinco HTMLs 009/045/046/047 | Revalidar ações por perfil, subfluxos e variantes |

## Regra de aceite

**Gate A é aceite visual da referência**, não prova de funcionamento da implementação. Para cada superfície: (1) identificar arquivo/código/variante final; (2) registrar diferenças entre referência e produto que não poderão ser copiadas; (3) registrar a correção esperada; (4) obter aceite explícito do PO. A QA de viewports 360/390/430, zoom 200%, nomes de 255 caracteres e ausência de rolagem horizontal será exigida no **Gate B (Beta)**, após a implementação autorizada; não pedir ao PO testes em telas que ainda não existem.

**Decisão funcional em aberto:** a referência mobile 008 contém paginação, mas o componente atual não a implementa. Não introduzir função por cópia do Stitch; submeter decisão de paginação separadamente.

## Sequência de execução

1. Fechar referência visual e matriz de ressalvas por subgrupo, sem alterar originais.
2. Registrar termo de aceite explícito do PO, por tela ou por lote, e encerrar Gate A **apenas se todas as exigências estiverem satisfeitas**.
3. Abrir backlog de implementação visual (Gate B), preservando testes funcionais e produção; o início do React requer autorização própria.
4. Na sequência, iniciar hardening **S1** em PRs independentes: proteção complementar por origem no login (além do rate limiting por identificador homologado na S13.01) e proteção de portaria com atenção a NAT e falsos bloqueios; limites de body por rota; CI/GitHub Actions com privilégio mínimo; bootstrap Master sob controle e recuperação documentada.
5. Fazer todas as alterações em `develop`; nada para `main` ou deploy de produção sem liberação explícita.

## Critérios mínimos da S1

- Limitações por origem **e credencial/evento**, evitando confiar cegamente em cabeçalhos enviados pelo cliente e prevendo rede compartilhada.
- Respostas HTTP 429 e `Retry-After`, testes de limites/reinício de janela e de usuários legítimos.
- Limites de tamanho compatíveis com payloads efetivos; não bloquear upload legítimo.
- Mudanças de bootstrap com procedimento de recuperação ensaiado e sem segredo registrado em logs.
- `permissions` mínimos no CI; ações externas por SHA verificado; CI verde.
- Smoke Beta completo de login, ativação, Portaria, perfis, PWA, auditoria e regressões antes de considerar produção.

**Estado:** Gate A aberto, hardening S1 complementar planejado e não iniciado; a S13.01 de autenticação e sessão já foi homologada, incluindo rate limiting por identificador com D1, HTTP 429 e Retry-After. A S1 proposta deve evitar duplicação e focar IP/origem, portaria, limites por rota, workflow e bootstrap.
