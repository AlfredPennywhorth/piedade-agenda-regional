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
  } | null
}
