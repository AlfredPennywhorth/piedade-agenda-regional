import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PortariaView } from '../components/portaria/PortariaView'
import * as apiClient from '../api/apiClient'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../api/apiClient', () => ({
  fetchWithAuth: vi.fn(),
  postWithAuth: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    body: unknown
    constructor(status: number, message: string, body: unknown) {
      super(message)
      this.name = 'ApiError'
      this.status = status
      this.body = body
    }
  }
}))

const UUID_EVT1 = '550e8400-e29b-41d4-a716-446655440001'
const UUID_EVT2 = '550e8400-e29b-41d4-a716-446655440002'
const UUID_DEST1 = 'd8b5a83d-e350-4100-b615-562db4965df1'
const UUID_DEST2 = 'd8b5a83d-e350-4100-b615-562db4965df2'
const UUID_M1 = '99c5a83d-e350-4100-b615-562db4965df1'
const UUID_M2 = '99c5a83d-e350-4100-b615-562db4965df2'

interface ParticipantesRes {
  participantes: Array<{
    convocacaoDestinatarioId: string
    membro: { id: string; nome: string; casaNome: string | null }
    rsvpResposta: string | null
    checkin: { id: string; dataHoraCheckin: string; forma: string } | null
  }>
}

describe('PortariaView', () => {
  const mockFetchWithAuth = vi.mocked(apiClient.fetchWithAuth)
  const mockPostWithAuth = vi.mocked(apiClient.postWithAuth)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza empty state quando não há eventos autorizados', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({ data: [] })
    render(<PortariaView />)
    
    expect(screen.getByText(/Carregando eventos autorizados/i)).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.getByText('Nenhum evento ativo com autorização de operação encontrado para hoje')).toBeInTheDocument()
    })
  })

  it('carrega o seletor com eventos e preenche a lista ao selecionar', async () => {
    const eventosDisponiveis = {
      data: [
        {
          id: UUID_EVT1,
          titulo: 'Evento Teste',
          inicioEm: '2026-10-01T14:00:00Z',
          fimEm: '2026-10-01T16:00:00Z',
          modalidade: 'PRESENCIAL'
        }
      ]
    }

    mockFetchWithAuth.mockResolvedValueOnce(eventosDisponiveis)

    render(<PortariaView />)

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    const select = screen.getByRole('combobox')
    expect(select).toHaveTextContent(/Evento Teste/i)

    const participantesFake: ParticipantesRes = {
      participantes: [
        {
          convocacaoDestinatarioId: UUID_DEST1,
          membro: { id: UUID_M1, nome: 'João da Silva', casaNome: 'Casa A' },
          rsvpResposta: 'PARTICIPAREI',
          checkin: null
        }
      ]
    }
    mockFetchWithAuth.mockResolvedValueOnce(participantesFake)

    fireEvent.change(select, { target: { value: UUID_EVT1 } })

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(`/portaria/eventos/${UUID_EVT1}/participantes`)
      expect(screen.getByText('João da Silva')).toBeInTheDocument()
      expect(screen.getByText('Esperado')).toBeInTheDocument()
    })
  })

  it('limpa os dados residuais ao trocar de evento e ignora corrida', async () => {
    const eventosDisponiveis = {
      data: [
        { id: UUID_EVT1, titulo: 'Evento A', inicioEm: '2026-10-01T14:00:00Z', fimEm: '2026-10-01T16:00:00Z', modalidade: 'PRESENCIAL' },
        { id: UUID_EVT2, titulo: 'Evento B', inicioEm: '2026-10-01T18:00:00Z', fimEm: '2026-10-01T20:00:00Z', modalidade: 'PRESENCIAL' }
      ]
    }
    mockFetchWithAuth.mockResolvedValueOnce(eventosDisponiveis)
    render(<PortariaView />)

    await waitFor(() => screen.getByRole('combobox'))
    const select = screen.getByRole('combobox')

    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [{ convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Pessoa 1', casaNome: null }, rsvpResposta: null, checkin: null }]
    })
    fireEvent.change(select, { target: { value: UUID_EVT1 } })
    await waitFor(() => expect(screen.getByText('Pessoa 1')).toBeInTheDocument())

    let resolveSegundaChamada: (val: ParticipantesRes) => void = () => {}
    mockFetchWithAuth.mockReturnValueOnce(new Promise(resolve => { resolveSegundaChamada = resolve }))

    fireEvent.change(select, { target: { value: UUID_EVT2 } })

    expect(screen.queryByText('Pessoa 1')).not.toBeInTheDocument()

    resolveSegundaChamada({
      participantes: [{ convocacaoDestinatarioId: UUID_DEST2, membro: { id: UUID_M2, nome: 'Pessoa 2', casaNome: null }, rsvpResposta: null, checkin: null }]
    })
    await waitFor(() => expect(screen.getByText('Pessoa 2')).toBeInTheDocument())
  })

  it('check-in manual exibe feedback de sucesso e recarrega a lista', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      data: [{ id: UUID_EVT1, titulo: 'Evt', inicioEm: '2026-10-01T14:00:00Z', fimEm: '2026-10-01T16:00:00Z', modalidade: 'PRESENCIAL' }]
    })
    render(<PortariaView />)
    await waitFor(() => screen.getByRole('combobox'))

    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [
        { convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Ana', casaNome: null }, rsvpResposta: null, checkin: null }
      ]
    })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: UUID_EVT1 } })
    await waitFor(() => screen.getByText('Registrar Presença'))

    mockPostWithAuth.mockResolvedValueOnce({ jaRegistrado: false })
    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [
        { convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Ana', casaNome: null }, rsvpResposta: null, checkin: { id: 'ck-1', dataHoraCheckin: '2026-10-01T14:10:00Z', forma: 'MANUAL' } }
      ]
    })

    fireEvent.click(screen.getByText('Registrar Presença'))

    await waitFor(() => {
      expect(mockPostWithAuth).toHaveBeenCalledWith('/checkin/manual', { convocacaoDestinatarioId: UUID_DEST1 })
      expect(screen.getByText('Check-in manual de Ana realizado com sucesso!')).toBeInTheDocument()
      expect(screen.getByText(/Presente/i)).toBeInTheDocument()
    })
  })

  it('check-in por QR exibe 409 quando já registrado', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      data: [{ id: UUID_EVT1, titulo: 'Evt', inicioEm: '2026-10-01T14:00:00Z', fimEm: '2026-10-01T16:00:00Z', modalidade: 'PRESENCIAL' }]
    })
    render(<PortariaView />)
    await waitFor(() => screen.getByRole('combobox'))

    mockFetchWithAuth.mockResolvedValue({ participantes: [] })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: UUID_EVT1 } })
    await waitFor(() => screen.getByPlaceholderText(/Aproxime o leitor/i))

    const qrInput = screen.getByPlaceholderText(/Aproxime o leitor/i)
    fireEvent.change(qrInput, { target: { value: UUID_DEST1 } })

    mockPostWithAuth.mockRejectedValueOnce(new apiClient.ApiError(409, 'Presença JÁ REGISTRADA previamente!', { jaRegistrado: true }))

    fireEvent.click(screen.getByText('Confirmar QR'))

    await waitFor(() => {
      expect(screen.getByText('Atenção: Presença JÁ REGISTRADA previamente!')).toBeInTheDocument()
      expect(qrInput).toHaveFocus()
    })
  })

  it('check-in por QR exibe 201 quando sucesso', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      data: [{ id: UUID_EVT1, titulo: 'Evt', inicioEm: '2026-10-01T14:00:00Z', fimEm: '2026-10-01T16:00:00Z', modalidade: 'PRESENCIAL' }]
    })
    render(<PortariaView />)
    await waitFor(() => screen.getByRole('combobox'))

    mockFetchWithAuth.mockResolvedValue({ participantes: [] })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: UUID_EVT1 } })
    await waitFor(() => screen.getByPlaceholderText(/Aproxime o leitor/i))

    const qrInput = screen.getByPlaceholderText(/Aproxime o leitor/i)
    fireEvent.change(qrInput, { target: { value: UUID_DEST1 } })

    mockPostWithAuth.mockResolvedValueOnce({ jaRegistrado: false })

    fireEvent.click(screen.getByText('Confirmar QR'))

    await waitFor(() => {
      expect(screen.getByText('Check-in por QR Code realizado com sucesso!')).toBeInTheDocument()
      expect(qrInput).toHaveFocus()
    })
  })

  it('check-in manual exibe erro 400 em payload invalido com alert role', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      data: [{ id: UUID_EVT1, titulo: 'Evt', inicioEm: '2026-10-01T14:00:00Z', fimEm: '2026-10-01T16:00:00Z', modalidade: 'PRESENCIAL' }]
    })
    render(<PortariaView />)
    await waitFor(() => screen.getByRole('combobox'))

    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [{ convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Ana', casaNome: null }, rsvpResposta: null, checkin: null }]
    })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: UUID_EVT1 } })
    await waitFor(() => screen.getByText('Registrar Presença'))

    mockPostWithAuth.mockRejectedValueOnce(new apiClient.ApiError(400, 'Payload inválido', {}))

    fireEvent.click(screen.getByText('Registrar Presença'))

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('Payload inválido')
    })
  })

  it('check-in manual exibe erro 404 quando destinatario nao encontrado com alert role', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      data: [{ id: UUID_EVT1, titulo: 'Evt', inicioEm: '2026-10-01T14:00:00Z', fimEm: '2026-10-01T16:00:00Z', modalidade: 'PRESENCIAL' }]
    })
    render(<PortariaView />)
    await waitFor(() => screen.getByRole('combobox'))

    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [{ convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Ana', casaNome: null }, rsvpResposta: null, checkin: null }]
    })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: UUID_EVT1 } })
    await waitFor(() => screen.getByText('Registrar Presença'))

    mockPostWithAuth.mockRejectedValueOnce(new apiClient.ApiError(404, 'Destinatário não encontrado', {}))

    fireEvent.click(screen.getByText('Registrar Presença'))

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('Destinatário não encontrado')
    })
  })
})
