export interface AgendaItem {
  evento: {
    id: string
    titulo: string
    inicioEm: string
    fimEm: string
    modalidade: 'PRESENCIAL' | 'ONLINE' | 'HIBRIDO'
    urlOnline?: string | null
    urlMaps?: string | null
    urlWaze?: string | null
    possuiManha?: boolean
    possuiTarde?: boolean
    possuiNoite?: boolean
    refeicoesOferecidas?: string[]
  }
  convocacao: {
    id: string
    observacoes: string | null
  }
  local: {
    nome: string
    endereco: string
  } | null
  destinatarioId: string
  rsvp: {
    resposta: 'PARTICIPAREI' | 'NAO_PARTICIPAREI' | 'NAO_SEI'
    justificativa?: string | null
    periodosParticipacao?: string[] | null
  } | null
}
