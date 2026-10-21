# Estudo preliminar — Backup D1 com botão (issue #315)

**Situação:** backup SQL de produção já conferido pelo responsável e guardado em HD externo. O botão é dívida **pós-UX**; nenhum código será implementado nesta etapa.

## Fluxo proposto

1. Master autenticado acessa área administrativa e seleciona ambiente (identificado explicitamente).
2. Confirma operação; backend verifica privilégio e registra evento de auditoria sem expor conteúdo.
3. Operação privilegiada exporta o D1 via credenciais secretas restritas ao servidor/CI, nunca pelo navegador.
4. Usuário recebe arquivo exportado para armazenamento externo e instruções de validação.
5. O sistema registra apenas resultado, data, ambiente e identificador, não dados exportados.

## Investigação obrigatória

- Escolher entre exportação via fluxo GitHub Actions protegido, API Cloudflare ou job isolado; verificar permissões mínimas e limites do plano gratuito.
- Estudar exportação assíncrona, tamanho máximo, timeout, retomada e proteção contra disparos simultâneos.
- Restringir download a Master e evitar links públicos, armazenamento no Pages/GitHub e inclusão de dados em logs.
- Exigir criptografia em trânsito (TLS) e em repouso, incluindo cópias temporárias e HD externo, com gestão de chaves separada, controle de acesso e proteção física do dispositivo.
- Definir prazo de retenção e eventos de término conforme a matriz LGPD vigente; prever eliminação segura de cada cópia e evidência auditável de descarte, sem registrar dados sensíveis.
- Se houver download, exigir endpoint protegido no backend, verificação de Master, concessão temporária e revogável e ausência de URLs públicas ou tokens permanentes. Expirar uma sessão não elimina uma cópia já baixada.
- Documentar recuperação em ambiente isolado e teste de integridade antes de habilitar em produção.
- Exigir evidência de segurança, LGPD e testes negativos de autorização.
- Proibir restauração automática em produção.

## Não escopo

Sem botão, agendamento, credenciais ou deploy agora. Revisitar após UX aprovada.
