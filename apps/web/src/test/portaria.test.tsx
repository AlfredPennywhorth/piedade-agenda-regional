import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { PortariaView } from '../components/portaria/PortariaView'
import * as apiClient from '../api/apiClient'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

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
const UUID_DEST3 = 'd8b5a83d-e350-4100-b615-562db4965df3'
const UUID_DEST4 = 'd8b5a83d-e350-4100-b615-562db4965df4'
const UUID_M1 = '99c5a83d-e350-4100-b615-562db4965df1'
const UUID_M2 = '99c5a83d-e350-4100-b615-562db4965df2'
const UUID_M3 = '99c5a83d-e350-4100-b615-562db4965df3'
const UUID_M4 = '99c5a83d-e350-4100-b615-562db4965df4'

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
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('renderiza empty state quando não há eventos autorizados', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({ data: [] })
    render(<PortariaView />)
    
    expect(screen.getByText(/Carregando eventos autorizados/i)).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.getByText('Nenhum evento ativo com autorização de operação encontrado para hoje')).toBeInTheDocument()
    })
  })

  it('carrega o seletor com eventos e exibe labels de RSVP, contadores e ordenação correta', async () => {
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
    
    // A lista contém:
    // M1 - Presente (NAO_PARTICIPAREI)
    // M2 - Pendente (PARTICIPAREI)
    // M3 - Pendente (NAO_SEI)
    // M4 - Pendente (null)
    const participantesFake: ParticipantesRes = {
      participantes: [
        {
          convocacaoDestinatarioId: UUID_DEST1,
          membro: { id: UUID_M1, nome: 'Ana Presente', casaNome: null },
          rsvpResposta: 'NAO_PARTICIPAREI',
          checkin: { id: 'ck-1', dataHoraCheckin: '2026-10-01T14:00:00Z', forma: 'QR' }
        },
        {
          convocacaoDestinatarioId: UUID_DEST2,
          membro: { id: UUID_M2, nome: 'Beto Pendente', casaNome: null },
          rsvpResposta: 'PARTICIPAREI',
          checkin: null
        },
        {
          convocacaoDestinatarioId: UUID_DEST3,
          membro: { id: UUID_M3, nome: 'Carlos Pendente', casaNome: null },
          rsvpResposta: 'NAO_SEI',
          checkin: null
        },
        {
          convocacaoDestinatarioId: UUID_DEST4,
          membro: { id: UUID_M4, nome: 'Daniel Pendente', casaNome: null },
          rsvpResposta: null,
          checkin: null
        }
      ]
    }
    mockFetchWithAuth.mockResolvedValueOnce(participantesFake)

    fireEvent.change(select, { target: { value: UUID_EVT1 } })

    await waitFor(() => {
      expect(screen.getByText('Total: 4')).toBeInTheDocument()
      expect(screen.getByText('Presentes: 1')).toBeInTheDocument()
      expect(screen.getByText('Pendentes: 3')).toBeInTheDocument()
    })

    // Checar badges de RSVP
    expect(screen.getByText('Não participará')).toBeInTheDocument()
    expect(screen.getByText('Participará')).toBeInTheDocument()
    expect(screen.getByText('Indefinido')).toBeInTheDocument()
    expect(screen.getByText('Sem resposta')).toBeInTheDocument()

    // Checar ordenação (pendentes primeiro, depois presentes)
    const rows = screen.getAllByTestId(/row-/i)
    expect(rows[0]).toHaveTextContent('Beto Pendente') // Pendente
    expect(rows[1]).toHaveTextContent('Carlos Pendente') // Pendente
    expect(rows[2]).toHaveTextContent('Daniel Pendente') // Pendente
    expect(rows[3]).toHaveTextContent('Ana Presente') // Presente
  })

  it('destaca visualmente após checkin e limpa na troca de evento', async () => {
    const eventosDisponiveis = {
      data: [
        { id: UUID_EVT1, titulo: 'Evt 1', inicioEm: '2026-10-01T14:00:00Z', fimEm: '2026-10-01T16:00:00Z', modalidade: 'PRESENCIAL' },
        { id: UUID_EVT2, titulo: 'Evt 2', inicioEm: '2026-10-01T14:00:00Z', fimEm: '2026-10-01T16:00:00Z', modalidade: 'PRESENCIAL' }
      ]
    }
    mockFetchWithAuth.mockResolvedValueOnce(eventosDisponiveis)
    render(<PortariaView />)
    await waitFor(() => screen.getByRole('combobox'))

    const select = screen.getByRole('combobox')

    // Carregar evento 1
    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [
        { convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Ana', casaNome: null }, rsvpResposta: null, checkin: null }
      ]
    })
    fireEvent.change(select, { target: { value: UUID_EVT1 } })
    await waitFor(() => screen.getByText('Registrar Presença'))

    // Fazer checkin manual
    mockPostWithAuth.mockResolvedValueOnce({ jaRegistrado: false, convocacaoDestinatarioId: UUID_DEST1 })
    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [
        { convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Ana', casaNome: null }, rsvpResposta: null, checkin: { id: 'ck-1', dataHoraCheckin: '2026-10-01T14:10:00Z', forma: 'MANUAL' } }
      ]
    })
    fireEvent.click(screen.getByText('Registrar Presença'))

    // Verifica que o elemento recebe a classe de highlight
    await waitFor(() => {
      const row = screen.getByTestId(`row-${UUID_DEST1}`)
      expect(row.className).toContain('bg-brand-50')
      expect(row.className).toContain('ring-2')
    })

    // Avança 5 segundos e verifica que limpou o highlight
    act(() => {
      vi.advanceTimersByTime(5100)
    })
    
    await waitFor(() => {
      const row = screen.getByTestId(`row-${UUID_DEST1}`)
      expect(row.className).not.toContain('bg-brand-50')
      expect(row.className).toContain('bg-green-50')
    })
    
    // Testa limpeza na troca de evento
    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [
        { convocacaoDestinatarioId: UUID_DEST2, membro: { id: UUID_M2, nome: 'Beto', casaNome: null }, rsvpResposta: null, checkin: null }
      ]
    })
    fireEvent.change(select, { target: { value: UUID_EVT2 } })
    await waitFor(() => expect(screen.getByText('Beto')).toBeInTheDocument())
  })

  it('mantém o destaque do segundo check-in caso sobreposto ao primeiro', async () => {
    const eventosDisponiveis = {
      data: [{ id: UUID_EVT1, titulo: 'Evt 1', inicioEm: '2026-10-01T14:00:00Z', fimEm: '2026-10-01T16:00:00Z', modalidade: 'PRESENCIAL' }]
    }
    mockFetchWithAuth.mockResolvedValueOnce(eventosDisponiveis)
    render(<PortariaView />)
    await waitFor(() => screen.getByRole('combobox'))

    const select = screen.getByRole('combobox')

    // Carrega 2 participantes
    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [
        { convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Ana', casaNome: null }, rsvpResposta: null, checkin: null },
        { convocacaoDestinatarioId: UUID_DEST2, membro: { id: UUID_M2, nome: 'Beto', casaNome: null }, rsvpResposta: null, checkin: null }
      ]
    })
    fireEvent.change(select, { target: { value: UUID_EVT1 } })
    await waitFor(() => expect(screen.getAllByText('Registrar Presença').length).toBe(2))

    // 1. Check-in de Ana
    mockPostWithAuth.mockResolvedValueOnce({ jaRegistrado: false, convocacaoDestinatarioId: UUID_DEST1 })
    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [
        { convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Ana', casaNome: null }, rsvpResposta: null, checkin: { id: 'ck-1', dataHoraCheckin: '2026-10-01T14:10:00Z', forma: 'MANUAL' } },
        { convocacaoDestinatarioId: UUID_DEST2, membro: { id: UUID_M2, nome: 'Beto', casaNome: null }, rsvpResposta: null, checkin: null }
      ]
    })
    
    const btns = screen.getAllByText('Registrar Presença')
    fireEvent.click(btns[0]) // Clica em Ana

    await waitFor(() => {
      expect(screen.getByTestId(`row-${UUID_DEST1}`).className).toContain('bg-brand-50')
    })

    // Avança 2 segundos (timer 1 faltam 3s)
    act(() => { vi.advanceTimersByTime(2000) })

    // 2. Check-in de Beto
    mockPostWithAuth.mockResolvedValueOnce({ jaRegistrado: false, convocacaoDestinatarioId: UUID_DEST2 })
    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [
        { convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Ana', casaNome: null }, rsvpResposta: null, checkin: { id: 'ck-1', dataHoraCheckin: '2026-10-01T14:10:00Z', forma: 'MANUAL' } },
        { convocacaoDestinatarioId: UUID_DEST2, membro: { id: UUID_M2, nome: 'Beto', casaNome: null }, rsvpResposta: null, checkin: { id: 'ck-2', dataHoraCheckin: '2026-10-01T14:10:02Z', forma: 'MANUAL' } }
      ]
    })
    
    const btnsBeto = screen.getAllByText('Registrar Presença')
    fireEvent.click(btnsBeto[0]) // O único botão sobrando (Beto)

    await waitFor(() => {
      expect(screen.getByTestId(`row-${UUID_DEST2}`).className).toContain('bg-brand-50')
    })

    // Avança 3.1 segundos (timer 1 teria estourado agora, total 5.1s de Ana)
    act(() => { vi.advanceTimersByTime(3100) })

    // Confirma que Beto ainda está com destaque (o timer de Ana foi cancelado)
    await waitFor(() => {
      expect(screen.getByTestId(`row-${UUID_DEST2}`).className).toContain('bg-brand-50')
    })

    // Avança o resto do tempo de Beto (2000ms -> Total do Beto = 5.1s)
    act(() => { vi.advanceTimersByTime(2000) })

    // Confirma que Beto perdeu o destaque agora
    await waitFor(() => {
      expect(screen.getByTestId(`row-${UUID_DEST2}`).className).not.toContain('bg-brand-50')
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

  it('check-in por QR exibe 201 quando sucesso e aplica destaque', async () => {
    mockFetchWithAuth.mockResolvedValueOnce({
      data: [{ id: UUID_EVT1, titulo: 'Evt', inicioEm: '2026-10-01T14:00:00Z', fimEm: '2026-10-01T16:00:00Z', modalidade: 'PRESENCIAL' }]
    })
    render(<PortariaView />)
    await waitFor(() => screen.getByRole('combobox'))

    // Carregar evento com participante pendente
    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [{ convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Ana QR', casaNome: null }, rsvpResposta: null, checkin: null }]
    })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: UUID_EVT1 } })
    await waitFor(() => screen.getByPlaceholderText(/Aproxime o leitor/i))
    await waitFor(() => expect(screen.getByText('Ana QR')).toBeInTheDocument())

    const qrInput = screen.getByPlaceholderText(/Aproxime o leitor/i)
    fireEvent.change(qrInput, { target: { value: 'token-qr-123' } })

    // Mock POST sucesso
    mockPostWithAuth.mockResolvedValueOnce({ jaRegistrado: false, convocacaoDestinatarioId: UUID_DEST1 })
    
    // Mock da recarga pós-sucesso
    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [{ convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Ana QR', casaNome: null }, rsvpResposta: null, checkin: { id: 'ck-qr', dataHoraCheckin: '2026-10-01T14:15:00Z', forma: 'QR' } }]
    })

    fireEvent.click(screen.getByText('Confirmar QR'))

    // Confirma mensagem de sucesso e foco devolvido
    await waitFor(() => {
      expect(screen.getByText('Check-in por QR Code realizado com sucesso!')).toBeInTheDocument()
      expect(qrInput).toHaveFocus()
    })

    // Confirma o destaque visual na linha
    await waitFor(() => {
      expect(screen.getByTestId(`row-${UUID_DEST1}`).className).toContain('bg-brand-50')
    })

    // Avança o timer em 5.1s
    act(() => { vi.advanceTimersByTime(5100) })

    // Confirma que o destaque foi removido
    await waitFor(() => {
      expect(screen.getByTestId(`row-${UUID_DEST1}`).className).not.toContain('bg-brand-50')
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
