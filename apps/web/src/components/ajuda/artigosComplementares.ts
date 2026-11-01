import type { ArtigoAjuda } from './artigos'

// Textos estáticos: nunca inserir tokens, PINs, contatos ou dados de contas aqui.
export const artigosComplementares: ArtigoAjuda[] = [
  {
    id: 'agenda',
    titulo: 'Minha Agenda — compromissos e respostas',
    codigos: ['AGD-MOB-001'],
    passos: [
      'Abra Minha Agenda na barra inferior e toque no cartão de um compromisso para conferir data, horário, local e demais detalhes.',
      'Em Sua Participação, use Vou participar, Não vou participar ou Não sei ainda, quando disponíveis. Para confirmar ausência, informe a justificativa; para participação, escolha os períodos solicitados e confirme.',
      'Quando aparecer Reconfirmar, releia as mudanças de data, horário ou local e envie a resposta solicitada.',
      'Apresente o QR Code individual quando o comando estiver disponível para sua convocação. Não encaminhe seu QR a outras pessoas.',
      'Se houver conflito de horário, confira os compromissos envolvidos. Priorizar este compromisso não cancela o outro evento nem muda a convocação de terceiros.',
    ],
    cuidados: [
      'A agenda vazia indica ausência de compromissos futuros vinculados ao seu acesso. Se esperava um convite, confirme com o organizador ou a secretaria.',
      'A resposta RSVP é bloqueada após o início do evento. Eventos próprios não usam o painel comum de resposta à convocação.',
      'No convite nominal externo, Confirmar e Recusar só funcionam enquanto o convite estiver pendente e antes do início. Depois de responder, confira o cartão atualizado; para corrigir a decisão, procure o organizador.',
    ],
  },
  {
    id: 'calendario',
    titulo: 'Calendário — consultar dias e eventos',
    codigos: ['AGD-MOB-002'],
    passos: [
      'Use as setas para alternar os meses. Os pontos nos dias indicam eventos conforme a legenda de cores por escopo.',
      'Selecione um dia para abrir Eventos em DD/MM/AAAA e toque no cartão desejado para consultar detalhes.',
      'Quando permitido, responda em Sua Participação nos detalhes, seguindo as mesmas regras de Minha Agenda: períodos exigidos, justificativa de ausência e limite de horário.',
    ],
    cuidados: [
      'As datas seguem o dia operacional de São Paulo. Cores não representam confirmação de presença nem autorização administrativa.',
      'Se houver erro ao atualizar os conflitos depois de responder, recarregue e confira o status antes de enviar novamente: a resposta pode já ter sido salva.',
    ],
  },
  {
    id: 'avisos',
    titulo: 'Avisos e notificações do dispositivo',
    codigos: ['AGD-MOB-003'],
    passos: [
      'Abra Mais → Avisos para consultar o controle de Notificações Push.',
      'Use Ativar Notificações se desejar e autorize a permissão solicitada pelo navegador. Use Desativar Notificações para desabilitar a inscrição deste dispositivo.',
      'Se o navegador indicar bloqueio de notificações ou falta de suporte, confira as configurações e as orientações mostradas na tela.',
    ],
    cuidados: [
      'O módulo de Avisos informa que está em desenvolvimento. Não há uma caixa de avisos de reuniões cadastradas, alteradas ou canceladas implementada nessa tela.',
      'Ativar notificações não garante a entrega de todo aviso. Consulte Minha Agenda e confirme mudanças importantes com o organizador.',
    ],
  },
  {
    id: 'cadastro',
    titulo: 'Meu Cadastro — dados, celular e PIN',
    codigos: ['AGD-SHR-001'],
    passos: [
      'Em Mais → Meu Cadastro, confira nome, carteirinha, Casa de Oração, dados institucionais e situação apresentados.',
      'Para Atualizar celular, informe o novo celular e seu PIN atual nos campos próprios e aguarde a confirmação.',
      'Para Alterar PIN, informe o PIN atual, o novo PIN de seis dígitos e sua confirmação. Confira o resultado e entre novamente quando solicitado.',
    ],
    cuidados: [
      'Os dados institucionais são apenas para consulta nessa tela. Peça correção ao administrador autorizado; não crie outro cadastro.',
      'Alterar PIN encerra as sessões existentes. Nunca compartilhe o PIN nem envie capturas com seus campos preenchidos.',
    ],
  },
  {
    id: 'series',
    titulo: 'Séries — reuniões recorrentes',
    codigos: [
      'AGD-ADM-002',
      'AGD-ADM-024',
      'AGD-ADM-025',
      'AGD-ADM-026',
      'AGD-ADM-027',
      'AGD-ADM-028',
      'AGD-ADM-029',
      'AGD-ADM-030',
    ],
    capacidade: 'podeGerirAgenda',
    passos: [
      'Consulte a lista pelos filtros de situação e período. O filtro temporal considera a última ocorrência real da série.',
      'Em + Nova Série, informe título, modalidade, frequência, período, horários, escopo e Local/Espaço ou URL online, conforme os campos disponíveis.',
      'Confira a prévia e as validações antes de salvar. Na edição, leia a confirmação sobre as ocorrências afetadas.',
      'Ao criar Local ou Espaço no formulário, confira titularidade e escopo autorizados e revise os dados antes de selecionar o novo registro.',
    ],
    cuidados: [
      'Convocações ativas nas ocorrências, inclusive rascunhos, impedem a inativação da série. Trate-as pelo fluxo autorizado antes de inativar.',
      'Inativar uma série não apaga histórico nem cancela automaticamente convocações publicadas. A API valida escopo e autorização.',
    ],
  },
  {
    id: 'grupos-trabalho',
    titulo: 'Grupos de Trabalho — cadastro regional',
    codigos: ['AGD-ADM-009', 'AGD-ADM-045', 'AGD-ADM-046', 'AGD-ADM-047'],
    capacidade: 'podeAdministrarEstrutura',
    passos: [
      'Consulte a listagem de Grupos de Trabalho e confira nome, vínculo e situação. Use Detalhes para conferir o grupo existente.',
      'Em + Novo Grupo, informe o nome, selecione a Regional vinculada, confira Grupo Ativo e salve.',
      'Para atualizar um GT regional, use Editar, revise os dados e salve com Atualizar Grupo, conforme sua autorização.',
    ],
    cuidados: [
      'Novos GTs são exclusivamente regionais. GT não é um nível entre Setor e Casa; os Setores participam por representantes.',
      'GTs históricos de Administração ou Setor podem aparecer na consulta, mas o formulário atual não permite atualizá-los. Encaminhe para tratamento administrativo; não crie duplicatas para contornar.',
    ],
  },
  {
    id: 'portaria',
    titulo: 'Portaria — presenças e encerramento',
    codigos: ['AGD-MOB-004'],
    capacidadesAlternativas: ['podeOperarPortaria', 'podeGerirAgenda'],
    passos: [
      'Selecione o evento autorizado. A lista padrão apresenta eventos de hoje no fuso de São Paulo; confira a reunião antes de registrar presenças.',
      'Use Confirmar QR com o QR individual do participante ou localize a pessoa por nome/Casa para o check-in manual disponível.',
      'Em Convidados não cadastrados, gere o QR/link quando autorizado. Depois do autocadastro, confira o comparecimento e use Validar presença.',
      'Para corrigir presença incorreta, use Retificar check-in e informe o motivo, preservando o histórico.',
      'Solicitar encerramento mantém a Portaria aberta até outra pessoa autorizada, diferente da solicitante, confirmar o encerramento.',
    ],
    cuidados: [
      'As ações dependem da autorização para o evento, não apenas da visibilidade do menu. Operar e confirmar fechamento são permissões diferentes.',
      'Gerar novamente o QR de convidados revoga os anteriores. Autocadastro não comprova presença validada.',
      'Reabrir Portaria exige autorização e justificativa e não restaura credenciais temporárias antigas. Nunca compartilhe contas ou links de operador.',
    ],
  },
  {
    id: 'relatorios',
    titulo: 'Relatórios — RSVP, presenças e consolidação',
    codigos: ['AGD-ADM-003'],
    capacidade: 'podeVisualizarRelatorios',
    passos: [
      'Em Relatório do Evento, pesquise e selecione a reunião, use Buscar Relatório e confira os indicadores e a lista nominal com os filtros disponíveis.',
      'Em Presenças, escolha Reunião específica, histórico por Membro ou Período / escopo. Informe os filtros e use Consultar.',
      'Confira se o resultado é Lista final da reunião ou Prévia operacional. Exportar CSV e impressão devem respeitar a finalidade e o escopo autorizados.',
      'Quando a Portaria estiver fechada, use Baixar Lista de Presença (PDF) para anexar à ata. O arquivo contém somente presenças registradas, não respostas RSVP.',
      'Relatório Agregado é exclusivo do Master ou de gestor de relatórios autorizado para o escopo consultado. Somente com essa autorização, informe tipo de escopo, ID do Escopo (UUID) e datas. Obtenha o identificador correto com o responsável pelo cadastro; não o adivinhe.',
      'Utilização de locais/espaços também exige ser Master ou gestor de relatórios autorizado para aquele escopo. Confira escopo e período e carregue novamente após alterar filtros.',
    ],
    cuidados: [
      'Ser organizador e conseguir abrir Relatórios não autoriza consultas agregadas ou de utilização por escopo; a API pode recusá-las com 403. RSVP confirmado não equivale a presença registrada. Prévia operacional não é fechamento oficial da Portaria.',
      'Históricos e consolidados de presença usam fechamentos materializados e escopos autorizados. Eventos pessoais e externos não integram o relatório de Portaria.',
      'Antes da primeira emissão definitiva, confira o CNPJ exclusivo do Setor responsável, o endereço do Local escolhido para a reunião e as funções. O PDF emitido fica preservado para a ata; mudanças posteriores no cadastro não reescrevem o documento.',
      'O ranking de locais considera apenas instalações visíveis e pode diferir do total de eventos. Não distribua relatórios nominais em canais públicos.',
    ],
  },
  {
    id: 'auditoria',
    titulo: 'Auditoria — consultar registros e contexto',
    codigos: ['AGD-ADM-004'],
    capacidade: 'podeVisualizarAuditoria',
    passos: [
      'Abra Trilha de Auditoria quando autorizada para seu perfil e confira data/hora, ação, recurso, ator e escopo.',
      'Use os filtros de ação e tipo de recurso e a paginação para localizar registros.',
      'Use Ver Detalhes quando houver contexto disponível e feche o painel para voltar à listagem.',
    ],
    cuidados: [
      'Auditoria e Relatórios têm permissões distintas. A API limita os registros ao escopo autorizado e protege dados de eventos pessoais.',
      'Não copie contexto de logs com dados pessoais para chamados públicos. A tela não oferece todos os parâmetros técnicos aceitos pela API.',
    ],
  },
  {
    id: 'login',
    titulo: 'Entrar — celular e PIN',
    codigos: ['AGD-SHR-002'],
    isolado: true,
    passos: [
      'Informe o celular cadastrado e o PIN pessoal de seis dígitos e toque em Entrar.',
      'No primeiro acesso, utilize o link individual de ativação recebido do administrador antes de tentar entrar.',
      'Se esqueceu o PIN, use Esqueci meu PIN e siga a recuperação supervisionada.',
    ],
    cuidados: [
      'Em muitas tentativas, aguarde o prazo informado. Para conta bloqueada, dados divergentes ou falta de cadastro, procure o administrador.',
      'Não compartilhe PIN, tokens nem links de ativação. A ajuda não envia dados do formulário nem cria uma conta.',
    ],
  },
  {
    id: 'ativacao',
    titulo: 'Ativar conta — primeiro acesso ou redefinição',
    codigos: ['AGD-SHR-003'],
    isolado: true,
    passos: [
      'Abra seu link individual, informe carteirinha e celular cadastrados, crie o PIN de seis dígitos e repita em Confirmar PIN.',
      'Use Ativar e entrar e aguarde a confirmação. Voltar para o login permite sair desse fluxo sem ativar.',
    ],
    cuidados: [
      'O link é temporário e de uso único. Se expirar, perder-se ou os dados não coincidirem, solicite orientação ao administrador autorizado.',
      'O administrador não escolhe nem precisa conhecer seu PIN. Abrir a ajuda não ativa a conta nem consome o link.',
    ],
  },
  {
    id: 'recuperacao',
    titulo: 'Recuperar PIN — solicitar atendimento',
    codigos: ['AGD-SHR-004'],
    isolado: true,
    passos: [
      'Informe o celular cadastrado em Recuperar PIN e envie a solicitação.',
      'Aguarde o administrador responsável verificar sua identidade e disponibilizar o link individual, quando cabível.',
      'Use a opção de voltar para o login quando desejar.',
    ],
    cuidados: [
      'A mensagem de solicitação recebida não revela se o celular existe no cadastro. Não presuma envio automático de PIN ou link.',
      'Nunca informe seu PIN a terceiros nem tente usar o cadastro de outra pessoa.',
    ],
  },
  {
    id: 'responsabilidade',
    titulo: 'Ciência do responsável PMO da Regional',
    codigos: ['AGD-SHR-005'],
    isolado: true,
    passos: [
      'Confira a Regional vinculada e leia integralmente o texto e sua versão apresentados pela aplicação.',
      'Marque a ciência apenas após a leitura e use o comando de confirmação para registrar sua manifestação.',
      'Se houver mais de um acesso pendente, confira cada Regional apresentada antes de continuar.',
    ],
    cuidados: [
      'A ajuda não marca a confirmação, não registra ciência nem substitui o texto institucional.',
      'Se a responsabilidade ou a Regional estiver incorreta, procure o administrador antes de confirmar.',
    ],
  },
  {
    id: 'portaria-temporaria',
    titulo: 'Acesso temporário de Portaria',
    codigos: ['AGD-MOB-005'],
    isolado: true,
    passos: [
      'Abra o link individual fornecido pelo gestor e confira o evento e a validade do acesso.',
      'Use os controles disponíveis para conferir participantes, confirmar QR, registrar presença e validar convidados da reunião.',
      'Confira o estado da Portaria e as mensagens antes de repetir um registro.',
    ],
    cuidados: [
      'O acesso vale somente para a reunião e operações autorizadas. Não encaminhe o link a outras pessoas.',
      'Se o acesso estiver expirado, revogado ou a Portaria encerrada, procure o gestor. Reabrir a Portaria não restaura links antigos.',
    ],
  },
  {
    id: 'convidado',
    titulo: 'Cadastro de convidado da reunião',
    codigos: ['AGD-MOB-006'],
    isolado: true,
    passos: [
      'Confira o evento identificado no link/QR e preencha os campos solicitados, como nome, localidade, referência e observações quando aplicáveis.',
      'Envie o cadastro e confira a confirmação Cadastro enviado.',
      'Ao chegar, procure a recepção para validar sua presença.',
    ],
    cuidados: [
      'Cadastro enviado não significa presença validada nem cria uma conta de membro.',
      'Para link inválido, expirado, revogado ou reunião encerrada, siga a mensagem apresentada e procure o porteiro. Não compartilhe dados pessoais desnecessários.',
    ],
  },
]
