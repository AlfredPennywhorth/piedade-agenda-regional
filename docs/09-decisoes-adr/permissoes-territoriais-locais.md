# Permissões territoriais de locais e espaços — correção prioritária

## Diagnóstico confirmado na develop (13/10/2026)
- `POST/PATCH /locais` e `POST/PATCH /espacos-locais` exigem `MASTER_SISTEMA`.
- O cadastro `locais` não armazena escopo territorial; não é seguro liberar esses endpoints somente pela presença de perfil administrativo.
- `ADMINISTRADOR_SISTEMA` em SETOR não equivale automaticamente a `GESTOR_AGENDA`, conforme `podeGerenciarAgendaNoEscopo`.
- Locais particulares e seus espaços já são protegidos por `proprietarioMembroId`; esta separação deve ser preservada.

## Modelo a implementar
1. Adicionar escopo territorial explícito ao local institucional (`REGIONAL`, `ADMINISTRACAO`, `SETOR`, `CASA` ou `GRUPO_TRABALHO`) e seu ID. Os espaços herdam do local.
2. Local legado sem escopo continua administrável **somente pelo Master** até classificação, sem atribuição automática a uma jurisdição.
3. Administrador ou gestor autorizado só cria/edita recursos dentro do escopo próprio e descendentes expressamente permitidos. **Sem permissão pela coincidência de cidade, UF, CEP ou endereço.**
4. Verificação na API (inclusive PATCH), sem confiar no frontend; checar ainda o escopo de origem ao tentar transferir local. Impedir transferência arbitrária entre escopos.
5. Proteção invariável para recursos particulares de terceiros. Permissões territoriais não concedem acesso à edição privada.
6. Tela de Locais deve filtrar/cadastrar com escolha de escopo autorizado; mensagens devem indicar permissão insuficiente e orientar o administrador. 
7. Aplicar a mesma regra na criação de espaço, por herança do local. Incluir testes positivos e negativos de separação territorial.
8. Migrar D1 Beta com backup e sequência correta antes do Pages Beta; só promover produção depois de smoke com administrador Setor real.
9. **Exceção posterior aprovada para AGD-ADM-055 (13/10/2026):** membro autenticado e ativo, com Casa de Oração de origem válida, pode **somente criar** Local institucional vinculado ao Setor de origem da própria Casa, sem receber `GESTOR_AGENDA` ou perfil administrativo. A API determina o Setor por vínculo institucional persistido, e valida a correspondência do escopo solicitado. Isso não dá permissão para `PATCH`, exclusão, mudança de escopo, cadastro em outros Setores, nem criação/edição de Espaços institucionais; essas ações continuam exigindo perfil autorizado. O Local criado segue a visibilidade territorial institucional já existente. Esta exceção substitui apenas a vedação de criação institucional ao `USUARIO_COMUM` na matriz original.

## Matriz alvo (cadastros)
| Perfil | Local institucional | Espaço institucional |
|---|---|---|
| MASTER_SISTEMA global | todos, inclusive legados | todos |
| ADMINISTRADOR_SISTEMA Regional | Regional e descendentes atribuídos | nos respectivos locais |
| ADMINISTRADOR_SISTEMA Administração | Administração e descendentes atribuídos | nos respectivos locais |
| ADMINISTRADOR_SISTEMA Setor | Setor e Casas subordinadas atribuídos | nos respectivos locais |
| ADMINISTRADOR_SISTEMA Casa | própria Casa atribuída | nos respectivos locais |
| GESTOR_AGENDA | escopos autorizados; política administrativa a validar | nos respectivos locais |
| USUARIO_COMUM | cria **somente no Setor de sua Casa de origem ativa**; não edita institucionais | não cria/edita espaços institucionais; mantém particulares próprios |

**Gate de segurança:** não remover `exigirMasterParaEscrita` antes de haver escopo persistido e verificação territorial equivalente.

## Histórico da decisão
- 13/10/2026: após validação Beta da AGD-ADM-055, a regra de **criação** foi ampliada expressamente para membros comuns no Setor de origem, sem elevação de perfil. As restrições de edição e gestão territorial permanecem inalteradas. Casos sem Casa/Setor válido não recebem exceção.
