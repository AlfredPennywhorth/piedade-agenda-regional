# Eventos Próprio e segregação por hierarquia

Solicitação de André em 07/10/2026. Esforço inicialmente estimado: 6–12 horas,
incluindo implementação, testes e revisão. A implementação segue para revisão
em `develop`; merge e deploy dependem do fluxo de autorização do projeto.

## Problema e resultado

A listagem de eventos usava a visibilidade territorial dos cadastros, incluindo
ancestrais e outros eventos sem participação ou delegação específica. Agora a
filtragem acontece na API, antes da resposta, e protege também o acesso por ID,
convocações e refeições.

No formulário de evento avulso, o escopo Casa de Oração oferece o público
**Próprio — somente para mim**. Ao salvar, o evento aparece diretamente na Minha
Agenda e no Calendário, sem rascunho, convocação, RSVP ou QR de portaria.
O frontend navega para Minha Agenda. O público institucional mantém o fluxo de
convocação existente. Séries continuam institucionais nesta alteração.

## Regras

| Situação | Consulta | Gestão |
| --- | --- | --- |
| Evento Próprio | Autor e Master | Autor e Master |
| Usuário comum | Eventos criados/organizados por ele e eventos com convocação publicada destinada a ele | Eventos criados/organizados por ele na própria Casa |
| Gestor de Agenda | Escopo delegado e descendentes | Escopo delegado e descendentes |
| Administrador Regional | Regional autorizada e descendentes | Regional autorizada e descendentes |
| Relatórios, Auditoria e Portaria | Escopo autorizado e descendentes de eventos institucionais | Não recebem gestão de eventos por esse perfil |
| Master | Todos os eventos | Todos, respeitando as regras de estado do evento |

Vínculos operacionais legados de relatórios, auditoria e portaria são respeitados.
A vinculação comum à Casa não concede leitura de agendas alheias. GT é um ramo
separado; acesso ao Setor não concede acesso ao GT Regional.

A API fixa `criadorMembroId` na identidade autenticada, ignorando autoria enviada
pelo cliente. Evento Próprio exige Casa e não pode ser transferido a outro usuário.
O público fica imutável após a criação. Mudanças de escopo exigem autoridade
de gestão no destino; a permissão de criar na própria Casa não permite mover
eventos alheios para fora da delegação. O autor preserva a gestão de seu evento
pessoal na Casa original mesmo que seu cadastro mude de Casa. Eventos encerrados permanecem imutáveis.
A tela só oferece edição, cancelamento e portaria quando a API autoriza gestão;
eventos pessoais não são oferecidos no seletor de nova convocação.

## Matriz confirmada e filtros (07/10/2026)

André confirmou as regras de consulta/gestão acima e **GT somente Regional**.
Criação e edição de GT já exigem Regional na API. Para não perder acesso a
registros legados vinculados por Administração/Setor, a permissão Regional
resolve sua ancestralidade; esses vínculos não concedem gestão de GT ao Setor
ou à Administração. Nenhum cadastro é modificado automaticamente.

- Usuário comum abre Eventos vendo apenas autoria, organização e participação
  em convocação publicada; não recebe seletor de escopos nem de pessoas.
- Gestores abrem a lista autorizada e podem filtrar por escopo, incluindo
  descendentes. O filtro reduz a lista; nunca amplia a permissão da API.
- Master dispõe também de filtro por pessoa: autor, organizador ou destinatário
  de convocação publicada. Pode limpar a seleção para voltar à visão global.
- A API recusa filtro por pessoa para outros perfis e só fornece a lista de
  pessoas ao Master. Respostas antigas de filtros não substituem a seleção atual.
- Gestor de Relatórios consulta destinatários no escopo e nos níveis abaixo,
  tanto por acesso técnico quanto por vínculo funcional legado. O seletor de
  escopo também reconhece vínculos ativos legados de relatórios, auditoria e portaria.

## Banco e compatibilidade

Migration: `apps/worker/drizzle/0042_eventos_pessoais.sql`.

- Acrescenta `pessoal`, com padrão falso, e `criador_membro_id`.
- Recupera autoria de `EVENTO_CRIADO`, depois de `SERIE_RECORRENCIA_CRIADA` e,
  como fallback legado, do organizador.
- Não transforma eventos antigos em pessoais e não remove dados.
- Registros sem autoria recuperável continuam acessíveis ao Master, aos gestores
  autorizados e aos destinatários de convocação publicada.
- Cria índice para agenda pessoal e gatilhos para rejeitar eventos pessoais sem
  Casa/autor, vinculados a séries ou com nova convocação.
- As novas ocorrências de séries institucionais também registram o autor.
- Regenerações em “Todas” e “Esta e futuras” usam a mesma recuperação de autoria
  pela auditoria ou ocorrências, sem atribuí-la ao gestor que editou a série.

**Aplicar a migration antes do novo Worker.** Sem as colunas novas, as consultas
novas de eventos falharão. No deploy do Worker Beta, marcar `apply_migrations`.
Depois publicar o Pages Beta. Produção repete essa ordem após homologação e
aprovação. Nenhum deploy é disparado por esta alteração.

## Evidências locais

- Worker: 602 testes passando, incluindo 33 testes de segregação, eventos
  pessoais, conflitos, atalhos de convocação e migration.
- Frontend: 284 testes passando, incluindo criação pessoal sem convocação,
  consulta sem ações de gestão e abertura pessoal na agenda/calendário sem RSVP/QR.
- Shared: 26 testes passando.
- Lint: sem erros; os avisos de `any` existentes não bloqueiam o projeto.
- Typecheck: os três pacotes passaram.
- Build do frontend/PWA passou.
- Bundle do Worker via esbuild, local e sem rede, passou. O dry-run local do
  Wrangler foi bloqueado pela revisão automática por possível transmissão de
  código/metadados à Cloudflare; não foi repetido.

## Roteiro de homologação Beta

1. Entrar como usuário comum, selecionar Casa de Oração e público Próprio,
   preencher o evento e salvar. Deve ir para Minha Agenda e também constar no
   Calendário, sem pedir convocação ou resposta de presença.
2. Entrar como outro usuário da mesma Casa. O evento pessoal não pode aparecer
   na listagem, na agenda ou em consulta direta por ID.
3. Repetir como Gestor da Casa, Setor, Administração e Regional. O evento pessoal
   do primeiro usuário continua oculto. Master pode consultá-lo em Eventos.
4. Criar evento institucional. Ele mantém o fluxo de rascunho/convocação e só
   aparece na Minha Agenda do destinatário depois da publicação.
5. Conferir cada nível de gestor: vê seu escopo e descendentes; não vê rascunhos
   de ancestrais, irmãos, outra Regional nem GT não autorizado.
6. Destinatário pode consultar o evento institucional publicado mesmo fora do
   seu território, mas não recebe botões de edição/cancelamento/portaria.
7. Editar horário do evento pessoal, criar outro concorrente e conferir os
   conflitos. A priorização funciona sem RSVP. Cancelar retira da agenda.
8. Conferir um evento antigo com autoria auditada, um evento organizado pelo
   usuário e um sem autoria conhecida, preservando as regras da tabela acima.

9. Como Master, selecionar uma pessoa e conferir seus eventos próprios,
   organizados e convocações publicadas; limpar o filtro. Como usuário comum,
   confirmar ausência dos seletores de pessoas e escopos.
10. Como gestor Regional/Administração/Setor, filtrar seu escopo e consultar
    destinatários de convocação da Casa subordinada, sem acesso a outra Regional.

Após CI e revisão do HEAD: solicitar autorização para merge, executar os deploys
no fluxo acordado e realizar este roteiro antes de promover a produção.
