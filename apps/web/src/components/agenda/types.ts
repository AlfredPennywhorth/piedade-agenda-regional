export interface AgendaItem {
  evento: {
    id: string
    pessoal?: boolean
    titulo: string
    inicioEm: string
    fimEm: string
    modalidade: 'PRESENCIAL' | 'ONLINE' | 'HIBRIDO'
    abrangencia?: 'TERRITORIAL' | 'NACIONAL' | 'INTERNACIONAL'
    destinoUf?: string | null
    destinoPaisCodigo?: string | null
    destinoCidadeLocal?: string | null
    urlOnline?: string | null
    urlMaps?: string | null
    urlWaze?: string | null
    possuiManha?: boolean
    possuiTarde?: boolean
    possuiNoite?: boolean
    refeicoesOferecidas?: string[]
    agendaAviso?: string | null
  }
  convocacao: {
    id: string
    observacoes: string | null
  } | null
  local: {
    nome: string
    endereco: string
    urlMaps?: string | null
    urlWaze?: string | null
  } | null
  espaco?: {
    id: string
    nome: string
  } | null
  participacaoExterna?: { status: 'CONVIDADO' | 'ATRIBUIDO' | 'CONFIRMADO' | 'RECUSADO'; membroId: string } | null
  destinatarioId: string | null
  vinculo?: {
    funcaoId: string
    funcaoNome: string
    vinculoFuncionalId: string
  } | null
  rsvp: {
    resposta: 'PARTICIPAREI' | 'NAO_PARTICIPAREI' | 'NAO_SEI'
    justificativa?: string | null
    periodosParticipacao?: string[] | null
    reconfirmacaoPendente?: boolean
  } | null
  conflito?: {
    tipo: 'SOBREPOSICAO' | 'PROXIMIDADE'
    janelaTransicaoMinutos: number
    priorizado: boolean
    conflitosResolvidos: boolean
    atenuado: boolean
    eventos: Array<{
      eventoId: string
      titulo: string
      inicioEm: string
      fimEm: string
      tipo: 'SOBREPOSICAO' | 'PROXIMIDADE'
    }>
  } | null
}
