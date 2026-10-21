import type { CapacidadesFrontend } from '../layout/MainLayout'

export interface ArtigoAjuda {
  id: string
  titulo: string
  codigos: string[]
  capacidade?: keyof CapacidadesFrontend
  passos: string[]
  cuidados: string[]
}

export const artigosAjuda: ArtigoAjuda[] = [
  {
    id: 'inicio',
    titulo: 'Como usar a ajuda',
    codigos: [],
    passos: [
      'Abra Mais → Central de Ajuda e pesquise por assunto ou código de tela.',
      'Nas telas administrativas, Ajuda abre as orientações da tela atual. Feche a ajuda para continuar de onde parou.',
    ],
    cuidados: [
      'As opções disponíveis dependem do seu perfil e escopo. A ajuda não concede permissões.',
      'Não compartilhe PIN, links de ativação ou dados pessoais em pedidos públicos de suporte.',
    ],
  },
  {
    id: 'eventos',
    titulo: 'Eventos — cadastrar, editar e cancelar',
    codigos: [
      'AGD-ADM-001',
      'AGD-ADM-016',
      'AGD-ADM-017',
      'AGD-ADM-018',
      'AGD-ADM-019',
      'AGD-ADM-020',
      'AGD-ADM-021',
      'AGD-ADM-022',
      'AGD-ADM-023',
    ],
    capacidade: 'podeGerirAgenda',
    passos: [
      'A lista inicia com eventos futuros e ativos. Revise período, situação e filtros territoriais antes de concluir que um evento não existe. Use Ver para consultar os detalhes.',
      'Em + Novo Evento, escolha o tipo e escopo autorizados. Preencha título, início, fim, modalidade e os demais campos apresentados.',
      'Para reunião presencial ou híbrida, confira Local e Espaço. Nas modalidades online, confira a URL solicitada. Locais particulares e institucionais têm autorizações diferentes.',
      'Confira organizador e abrangência: Territorial, Nacional ou Internacional. Para destinos externos, confira cidade/UF ou cidade/país.',
      'Clique em Salvar Evento e aguarde a confirmação. O próximo passo depende do tipo: agenda pessoal, preparação de convocação territorial ou participantes nominais do evento externo.',
      'Para alterar um registro autorizado, use Editar. Em ocorrência de série, leia se a alteração afeta apenas esta ocorrência ou a série desta em diante.',
    ],
    cuidados: [
      'Salvar um evento não publica automaticamente uma convocação. Confira a distribuição aos participantes no fluxo apropriado.',
      'Para cancelar um evento com convocação PUBLICADA, cancele primeiro a convocação em Convocações. A API bloqueia a ordem inversa.',
      'Cancelar evento com convocação em rascunho cancela essa convocação e remove suas funções. Reativar o evento não reabre a convocação cancelada.',
      'Eventos já encerrados não podem ser alterados ou cancelados, mesmo se um botão permanecer visível. As ações dependem de autorização e escopo validados pela API.',
    ],
  },
  {
    id: 'convocacoes',
    titulo: 'Convocações — rascunho, publicação e acompanhamento',
    codigos: [
      'AGD-ADM-014',
      'AGD-ADM-031',
      'AGD-ADM-032',
      'AGD-ADM-033',
      'AGD-ADM-034',
      'AGD-ADM-059',
    ],
    capacidade: 'podeGerirAgenda',
    passos: [
      'Revise os filtros de situação, período e território para localizar a convocação.',
      'Em Nova Convocação, selecione o evento correto, preencha os campos apresentados e salve para criar um rascunho.',
      'No RASCUNHO, use Gerenciar Funções para configurar destinatários por função nos eventos institucionais compatíveis. Confira as funções e o evento antes de Publicar.',
      'Publicar exige confirmação e é diferente de salvar o rascunho. Editar só está disponível enquanto a convocação estiver em RASCUNHO.',
      'Depois de publicada, Acompanhar RSVP permite consultar respostas somente ao organizador, Master ou gestor de relatórios autorizado para aquele evento. A capacidade de gestão de agenda, sozinha, não autoriza essa consulta; a API pode retornar 403. Os membros respondem pelas telas pessoais.',
      'Quando disponível, Sincronizar Diáconos atualiza destinatários DCO de convocação territorial publicada antes do encerramento. Confira as contagens antes e depois.',
    ],
    cuidados: [
      'Convites de eventos NACIONAIS e INTERNACIONAIS são tratados nas ações de participantes nominais do evento externo; não presuma convocação por função.',
      'Se houver conflito por atualização de outra pessoa, recarregue e confira o estado atual antes de repetir a operação.',
      'Antes de Cancelar, confira o alvo e a autorização. Não há promessa de reabertura automática da convocação.',
      'Acesso ao módulo não autoriza gerenciar todos os registros. A API valida perfil e escopo em cada operação.',
    ],
  },
  {
    id: 'regionais',
    titulo: 'Estrutura Territorial — Regionais',
    codigos: ['AGD-ADM-005', 'AGD-ADM-037', 'AGD-ADM-038'],
    capacidade: 'podeAdministrarEstrutura',
    passos: ['Consulte a listagem e abra Detalhes para conferir nome, código e situação.'],
    cuidados: [
      'Regional → Administração → Setor → Casa de Oração é a hierarquia institucional.',
      'Confira registros oficiais antes de criar cadastros; não duplique unidades para contornar erros.',
    ],
  },
  {
    id: 'administracoes',
    titulo: 'Estrutura Territorial — Administrações',
    codigos: ['AGD-ADM-006', 'AGD-ADM-039', 'AGD-ADM-040'],
    capacidade: 'podeAdministrarEstrutura',
    passos: [
      'Use Filtrar por Regional antes de consultar a lista.',
      'Em + Nova Administração, selecione a Regional correta, informe os dados e confira a situação antes de salvar.',
      'Use Detalhes ou Editar para conferir registros existentes.',
    ],
    cuidados: ['A escrita depende do escopo autorizado da sua Regional.'],
  },
  {
    id: 'setores',
    titulo: 'Estrutura Territorial — Setores',
    codigos: ['AGD-ADM-007', 'AGD-ADM-041', 'AGD-ADM-042'],
    capacidade: 'podeAdministrarEstrutura',
    passos: [
      'Filtre por Regional e Administração. Trocar a Regional limpa a Administração selecionada.',
      'Em + Novo Setor, escolha uma Administração da Regional informada e confira nome, código e situação antes de salvar.',
    ],
    cuidados: [
      'O vínculo com a Administração é obrigatório. Não crie outro Setor para corrigir um relacionamento sem conferência institucional.',
    ],
  },
  {
    id: 'casas',
    titulo: 'Estrutura Territorial — Casas de Oração',
    codigos: ['AGD-ADM-008', 'AGD-ADM-043', 'AGD-ADM-044'],
    capacidade: 'podeAdministrarEstrutura',
    passos: [
      'Use Filtrar por Setor e confira o código institucional da Casa.',
      'Em + Nova Casa de Oração, selecione o Setor correto e preencha os dados oficiais.',
      'Revise o vínculo e a situação antes de salvar uma edição.',
    ],
    cuidados: ['Uma Casa institucional e um Local de reunião são cadastros distintos.'],
  },
  {
    id: 'locais',
    titulo: 'Locais e Espaços',
    codigos: ['AGD-ADM-013', 'AGD-ADM-055', 'AGD-ADM-056', 'AGD-ADM-057', 'AGD-ADM-058'],
    capacidade: 'podeGerirAgenda',
    passos: [
      'Pesquise por nome, endereço, bairro, cidade, UF ou CEP. Use Ver para conferir os detalhes.',
      'Em + Novo Local, confira o escopo autorizado e o endereço. Aguarde a consulta de CEP; se indisponível, preencha manualmente.',
      'Confira o endereço retornado, número e complemento antes de Salvar Local.',
      'Abra Espaços no Local correto. Informe Nome do Espaço, capacidade e descrição quando aplicável; confira a situação antes de adicionar ou atualizar.',
    ],
    cuidados: [
      'O escopo de um Local já classificado não pode ser alterado no formulário. Em erro, solicite tratamento administrativo.',
      'Inativar um Local ainda não bloqueia por si só novos agendamentos. Espaços inativos são recusados para novos usos.',
      'A API valida permissão e escopo de cada gravação; botão visível não garante autorização.',
    ],
  },
  {
    id: 'membros',
    titulo: 'Membros',
    codigos: ['AGD-ADM-010', 'AGD-ADM-035', 'AGD-ADM-036', 'AGD-ADM-048'],
    capacidade: 'podeAdministrarPessoas',
    passos: [
      'Filtre por Setor e busque nome, carteirinha ou Casa antes de cadastrar.',
      'Em + Cadastrar Membro, pesquise o pré-cadastro ministerial quando disponível e confira Casa, carteirinha e celular.',
      'No cadastro manual autorizado, confira a cascata Regional → Administração → Setor → Casa. Alterar um nível limpa os inferiores.',
      'Depois de salvar, confira o retorno. Cadastro de Membro e ativação da Conta são etapas distintas.',
    ],
    cuidados: [
      'Trocar a Casa altera vínculos DCO, pode mudar acessos USUARIO_COMUM e destinatários de convocações vigentes. Confirme com os responsáveis e confira o resultado.',
      'Exclusão é definitiva e pode ser recusada por conta, convocações, vínculos ou histórico. Não a use para resolver duplicidade com histórico.',
      'Não divulgue listas ou contatos pessoais em grupos públicos.',
    ],
  },
  {
    id: 'funcoes',
    titulo: 'Funções',
    codigos: ['AGD-ADM-011', 'AGD-ADM-049', 'AGD-ADM-050', 'AGD-ADM-051'],
    capacidade: 'podeAdministrarFuncoes',
    passos: [
      'Consulte o catálogo e abra Detalhes para conferir nome, Código e situação.',
      'Antes de criar ou editar uma Função, confirme a atribuição institucional e seu código.',
      'Confira os vínculos e efeitos de uma inativação antes de salvar.',
    ],
    cuidados: [
      'Códigos reservados podem conceder capacidades operacionais por vínculo. Não altere códigos para contornar permissões.',
      'A função-base DCO ativa e com código correto participa da manutenção automática dos vínculos dos membros.',
    ],
  },
  {
    id: 'vinculos-funcionais',
    titulo: 'Vínculos Funcionais',
    codigos: ['AGD-ADM-012', 'AGD-ADM-052', 'AGD-ADM-053', 'AGD-ADM-054'],
    capacidade: 'podeAdministrarPessoas',
    passos: [
      'Expanda os cartões por Função. Use busca, situação, abrangência e filtros Setor → Casa.',
      'Para criar ou editar, confira Membro + Função + Escopo institucional e situação.',
      'Se o código da Função não estiver visível, solicite ao Master a conferência em Funções → Detalhes antes de salvar.',
      'Se as participações dos GTs estiverem indisponíveis, a lista continua utilizável e o filtro por GT fica desabilitado.',
    ],
    cuidados: [
      'Criar, editar ou reativar vínculo ativo pode incluir destinatários imediatamente em convocações publicadas ainda vigentes. Inativar não remove destinatários já registrados.',
      'A tela não distingue a origem automática do DCO. Trate todo DCO como potencialmente automático: editar pode torná-lo manual e impedir a limpeza automática numa exclusão futura.',
      'Função, vínculo funcional e perfil técnico são registros diferentes; respeite o escopo autorizado.',
    ],
  },
  {
    id: 'acessos',
    titulo: 'Contas e Acessos',
    codigos: ['AGD-ADM-015'],
    capacidade: 'podeAdministrarAcessos',
    passos: [
      'Busque nome, celular ou carteirinha e confira a pessoa e a Casa antes de agir. Use os filtros territoriais, status e perfil.',
      'Para membro sem conta, use Gerar ativação quando disponível. Entregue o link temporário apenas ao titular.',
      'Se a ativação estiver pendente e o link expirou, confira a identidade e a disponibilidade de Redefinir PIN.',
      'Ao gerenciar acessos, confira perfil, nível e unidade autorizada. Após conceder ou revogar, confira a lista.',
      'Bloqueio e desbloqueio exigem confirmação e avaliação da situação da conta.',
    ],
    cuidados: [
      'Gerar um link não envia uma mensagem automaticamente. Nunca peça o PIN do titular.',
      'Redefinir PIN de conta ativada encerra as sessões atuais.',
      'Administradores regionais não podem alterar contas com Master ativo. O último Master operacional tem proteções adicionais.',
      'Unidade homônima sem identificação inequívoca deve ser regularizada; não escolha apenas pelo nome.',
    ],
  },
]

export function obterArtigos(capacidades: CapacidadesFrontend = {}): ArtigoAjuda[] {
  return artigosAjuda
    .filter(a => !a.capacidade || capacidades[a.capacidade] === true)
    .map(a => {
      if (a.id === 'regionais')
        return {
          ...a,
          passos: [
            ...a.passos,
            capacidades.podeAdministrarRegionais === true
              ? 'Como Master, use + Nova Regional ou Editar e confira nome, código e situação antes de salvar.'
              : 'Seu perfil permite consulta de Regionais; criação e edição são exclusivas do Master.',
          ],
        }
      if (a.id === 'acessos' && capacidades.podeGerenciarSessoes === true)
        return {
          ...a,
          passos: [
            ...a.passos,
            'Como Master, use Sessões ativas para consultar dispositivos e revogar uma sessão; Revogar todas encerra todas as sessões após confirmação. Rótulos de dispositivos são aproximados.',
          ],
        }
      return a
    })
}

export function pesquisarArtigos(artigos: ArtigoAjuda[], busca: string) {
  const normalizar = (texto: string) =>
    texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  const termos = normalizar(busca).trim().split(/\s+/)
  return artigos.filter(a =>
    termos.every(t =>
      normalizar([a.titulo, ...a.codigos, ...a.passos, ...a.cuidados].join(' ')).includes(t)
    )
  )
}
