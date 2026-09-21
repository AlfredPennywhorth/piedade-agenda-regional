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

const flushPromises = async () => {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve()
  })
}

describe('PortariaView', () => {
  const mockFetchWithAuth = vi.mocked(apiClient.fetchWithAuth)
  const mockPostWithAuth = vi.mocked(apiClient.postWithAuth)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
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

    expect(screen.getByText('Não participará')).toBeInTheDocument()
    expect(screen.getByText('Participará')).toBeInTheDocument()
    expect(screen.getByText('Indefinido')).toBeInTheDocument()
    expect(screen.getByText('Sem resposta')).toBeInTheDocument()

    const rows = screen.getAllByTestId(/row-/i)
    expect(rows[0]).toHaveTextContent('Beto Pendente')
    expect(rows[1]).toHaveTextContent('Carlos Pendente')
    expect(rows[2]).toHaveTextContent('Daniel Pendente')
    expect(rows[3]).toHaveTextContent('Ana Presente')
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

    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [
        { convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Ana', casaNome: null }, rsvpResposta: null, checkin: null }
      ]
    })
    fireEvent.change(select, { target: { value: UUID_EVT1 } })
    await waitFor(() => screen.getByText('Registrar Presença'))

    mockPostWithAuth.mockResolvedValueOnce({ jaRegistrado: false, convocacaoDestinatarioId: UUID_DEST1 })
    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [
        { convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Ana', casaNome: null }, rsvpResposta: null, checkin: { id: 'ck-1', dataHoraCheckin: '2026-10-01T14:10:00Z', forma: 'MANUAL' } }
      ]
    })

    vi.useFakeTimers()
    fireEvent.click(screen.getByText('Registrar Presença'))

    await flushPromises()

    const row = screen.getByTestId(`row-${UUID_DEST1}`)
    expect(row.className).toContain('bg-brand-50')
    expect(row.className).toContain('ring-2')

    act(() => { vi.advanceTimersByTime(5100) })

    expect(row.className).not.toContain('bg-brand-50')
    expect(row.className).toContain('bg-green-50')

    vi.useRealTimers()

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

    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [
        { convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Ana', casaNome: null }, rsvpResposta: null, checkin: null },
        { convocacaoDestinatarioId: UUID_DEST2, membro: { id: UUID_M2, nome: 'Beto', casaNome: null }, rsvpResposta: null, checkin: null }
      ]
    })
    fireEvent.change(select, { target: { value: UUID_EVT1 } })
    await waitFor(() => expect(screen.getAllByText('Registrar Presença').length).toBe(2))

    vi.useFakeTimers()

    // 1. Check-in de Ana
    mockPostWithAuth.mockResolvedValueOnce({ jaRegistrado: false, convocacaoDestinatarioId: UUID_DEST1 })
    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [
        { convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Ana', casaNome: null }, rsvpResposta: null, checkin: { id: 'ck-1', dataHoraCheckin: '2026-10-01T14:10:00Z', forma: 'MANUAL' } },
        { convocacaoDestinatarioId: UUID_DEST2, membro: { id: UUID_M2, nome: 'Beto', casaNome: null }, rsvpResposta: null, checkin: null }
      ]
    })

    const btns = screen.getAllByText('Registrar Presença')
    fireEvent.click(btns[0])

    await flushPromises()
    expect(screen.getByTestId(`row-${UUID_DEST1}`).className).toContain('bg-brand-50')

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
    fireEvent.click(btnsBeto[0])

    await flushPromises()
    expect(screen.getByTestId(`row-${UUID_DEST2}`).className).toContain('bg-brand-50')

    // Avança 3.1 segundos (timer 1 teria estourado agora, total 5.1s de Ana)
    act(() => { vi.advanceTimersByTime(3100) })

    // Confirma que Beto ainda está com destaque
    expect(screen.getByTestId(`row-${UUID_DEST2}`).className).toContain('bg-brand-50')

    // Avança o resto do tempo de Beto
    act(() => { vi.advanceTimersByTime(2000) })

    // Confirma que Beto perdeu o destaque agora
    expect(screen.getByTestId(`row-${UUID_DEST2}`).className).not.toContain('bg-brand-50')

    vi.useRealTimers()
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

    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [{ convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Ana QR', casaNome: null }, rsvpResposta: null, checkin: null }]
    })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: UUID_EVT1 } })
    await waitFor(() => screen.getByPlaceholderText(/Aproxime o leitor/i))
    await waitFor(() => expect(screen.getByText('Ana QR')).toBeInTheDocument())

    const qrInput = screen.getByPlaceholderText(/Aproxime o leitor/i)
    fireEvent.change(qrInput, { target: { value: 'token-qr-123' } })

    mockPostWithAuth.mockResolvedValueOnce({ jaRegistrado: false, convocacaoDestinatarioId: UUID_DEST1 })

    mockFetchWithAuth.mockResolvedValueOnce({
      participantes: [{ convocacaoDestinatarioId: UUID_DEST1, membro: { id: UUID_M1, nome: 'Ana QR', casaNome: null }, rsvpResposta: null, checkin: { id: 'ck-qr', dataHoraCheckin: '2026-10-01T14:15:00Z', forma: 'QR' } }]
    })

    vi.useFakeTimers()
    fireEvent.click(screen.getByText('Confirmar QR'))

    await flushPromises()

    expect(screen.getByText('Check-in por QR Code realizado com sucesso!')).toBeInTheDocument()
    expect(qrInput).toHaveFocus()
    expect(screen.getByTestId(`row-${UUID_DEST1}`).className).toContain('bg-brand-50')

    act(() => { vi.advanceTimersByTime(5100) })

    expect(screen.getByTestId(`row-${UUID_DEST1}`).className).not.toContain('bg-brand-50')

    vi.useRealTimers()
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
  it('fecha a Portaria pela interface após confirmação', async () => {
    mockFetchWithAuth.mockImplementation(async (url) => {
      if (url === '/portaria/eventos') {
        return {
          data: [{ id: UUID_EVT1, titulo: 'Evt', inicioEm: '2026-10-01T14:00:00Z', fimEm: '2026-10-01T16:00:00Z', modalidade: 'PRESENCIAL' }]
        }
      }
      if (url.includes('/participantes')) return { participantes: [] }
      if (url.includes('/convidados')) return { data: [] }
      return {}
    })
    mockPostWithAuth.mockResolvedValueOnce({
      fechamento: { id: 'fech-1', eventoId: UUID_EVT1 },
      resumo: { totalPresentes: 0 },
      itens: [],
    })
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)

    render(<PortariaView />)
    await waitFor(() => screen.getByRole('combobox'))

    fireEvent.change(screen.getByRole('combobox'), { target: { value: UUID_EVT1 } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fechar Portaria' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Fechar Portaria' }))

    await waitFor(() => {
      expect(mockPostWithAuth).toHaveBeenCalledWith(`/portaria/eventos/${UUID_EVT1}/fechar`, {})
      expect(screen.getByText(/Portaria fechada e lista final consolidada com sucesso/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Fechar Portaria' })).not.toBeInTheDocument()
  })

    const getMockParticipantes = () => ({
      participantes: [
        {
          convocacaoDestinatarioId: 'dest1',
          membro: { id: 'm1', nome: 'João Ativo', casaNome: 'Casa 1' },
          rsvpResposta: 'CONFIRMADO',
          checkin: { id: 'chk1', dataHoraCheckin: '2026-09-18T10:00:00Z', forma: 'QR' }
        },
        {
          convocacaoDestinatarioId: 'dest2',
          membro: { id: 'm2', nome: 'Maria Pendente', casaNome: 'Casa 1' },
          rsvpResposta: 'CONFIRMADO',
          checkin: null
        }
      ]
    })

    const mockEventos = { data: [{ id: '11111111-1111-1111-1111-111111111111', titulo: 'Evento de Teste', inicioEm: '2026-09-18T10:00:00Z', fimEm: '2026-09-18T12:00:00Z', modalidade: 'PRESENCIAL' }] }

    describe('Retificação de Check-in', () => {
      it('exibe o botão Retificar check-in somente para participante com checkin ativo', async () => {
        mockFetchWithAuth.mockImplementation(async (url) => {
          if (url.includes('/eventos/11111111-1111-1111-1111-111111111111/participantes')) return getMockParticipantes()
          return mockEventos
        })
        render(<PortariaView />)
        await flushPromises()
        fireEvent.change(screen.getByRole('combobox'), { target: { value: '11111111-1111-1111-1111-111111111111' } })
        await flushPromises()

        const cards = screen.getAllByTestId(/row-/)
        expect(cards[1]).toHaveTextContent('Retificar check-in')
        expect(cards[0]).not.toHaveTextContent('Retificar check-in')
        expect(cards[0]).toHaveTextContent('Registrar Presença')
      })

      it('abre modal de retificação, mostra aviso LGPD e foca o textarea, cancela sem POST', async () => {
        mockFetchWithAuth.mockImplementation(async (url) => {
          if (url.includes('/eventos/11111111-1111-1111-1111-111111111111/participantes')) return getMockParticipantes()
          return mockEventos
        })
        render(<PortariaView />)
        await flushPromises()
        fireEvent.change(screen.getByRole('combobox'), { target: { value: '11111111-1111-1111-1111-111111111111' } })
        await flushPromises()

        fireEvent.click(screen.getByText('Retificar check-in'))

        const dialog = screen.getByRole('dialog')
        expect(dialog).toBeInTheDocument()
        expect(screen.getAllByText(/João Ativo/).length).toBeGreaterThan(0)
        expect(screen.getByText(/Descreva apenas o erro operacional. Não informe dados pessoais ou sensíveis./)).toBeInTheDocument()

        const textarea = screen.getByLabelText(/Motivo da retificação/)
        await waitFor(() => expect(textarea).toHaveFocus())

        // Cancelar
        fireEvent.click(screen.getByText('Cancelar'))

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
        expect(mockPostWithAuth).not.toHaveBeenCalled()

        const qrInput = screen.getByPlaceholderText(/Aproxime o leitor/i)
        await waitFor(() => expect(qrInput).toHaveFocus())
      })

      it('impede submissão de motivo inválido exibindo alert local sem disparar POST', async () => {
        mockFetchWithAuth.mockImplementation(async (url) => {
          if (url.includes('/eventos/11111111-1111-1111-1111-111111111111/participantes')) return getMockParticipantes()
          return mockEventos
        })
        render(<PortariaView />)
        await flushPromises()
        fireEvent.change(screen.getByRole('combobox'), { target: { value: '11111111-1111-1111-1111-111111111111' } })
        await flushPromises()

        fireEvent.click(screen.getByText('Retificar check-in'))
        fireEvent.change(screen.getByLabelText(/Motivo da retificação/), { target: { value: 'abc' } }) // < 5 caracteres
        fireEvent.click(screen.getByText('Confirmar retificação'))

        await waitFor(() => {
          expect(screen.getByText(/O motivo deve ter entre 5 e 100 caracteres válidos/i)).toBeInTheDocument()
        })
        expect(mockPostWithAuth).not.toHaveBeenCalled()
      })

      it('sucesso no POST, recarrega participantes, fecha modal e mostra toast global', async () => {
        let isFirstCall = true
        mockFetchWithAuth.mockImplementation(async (url) => {
          if (url.includes('/eventos/11111111-1111-1111-1111-111111111111/participantes')) {
            if (isFirstCall) {
              isFirstCall = false
              return getMockParticipantes()
            }
            // Na segunda chamada o participante volta a pendente
            return {
              participantes: [
                { ...getMockParticipantes().participantes[0], checkin: null },
                getMockParticipantes().participantes[1]
              ]
            }
          }
          return mockEventos
        })
        mockPostWithAuth.mockResolvedValueOnce({ success: true })

        render(<PortariaView />)
        await flushPromises()
        fireEvent.change(screen.getByRole('combobox'), { target: { value: '11111111-1111-1111-1111-111111111111' } })
        await flushPromises()

        fireEvent.click(screen.getByText('Retificar check-in'))
        fireEvent.change(screen.getByLabelText(/Motivo da retificação/), { target: { value: 'Duplo clique no QR' } })
        fireEvent.click(screen.getByText('Confirmar retificação'))

        await flushPromises()

        expect(mockPostWithAuth).toHaveBeenCalledWith('/checkin/chk1/retificar', { motivo: 'Duplo clique no QR' })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent(/Check-in retificado com sucesso/)

        const cards = screen.getAllByTestId(/row-/)
        expect(cards[0]).toHaveTextContent('Registrar Presença')

        const qrInput = screen.getByPlaceholderText(/Aproxime o leitor/i)
        await waitFor(() => expect(qrInput).toHaveFocus())
      })

      it('mantém loading impedindo duplo clique e mostra mensagem do ApiError ao receber erro (ex: 409)', async () => {
        mockFetchWithAuth.mockImplementation(async (url) => {
          if (url.includes('/eventos/11111111-1111-1111-1111-111111111111/participantes')) return getMockParticipantes()
          return mockEventos
        })

        let rejectPost: ((reason?: unknown) => void) | undefined;
        const postPromise = new Promise((_, reject) => rejectPost = reject)
        mockPostWithAuth.mockImplementationOnce(() => postPromise)

        render(<PortariaView />)
        await flushPromises()
        fireEvent.change(screen.getByRole('combobox'), { target: { value: '11111111-1111-1111-1111-111111111111' } })
        await flushPromises()

        fireEvent.click(screen.getByText('Retificar check-in'))
        fireEvent.change(screen.getByLabelText(/Motivo da retificação/), { target: { value: 'Duplo clique no QR' } })

        const btnConfirmar = screen.getByText('Confirmar retificação')
        fireEvent.click(btnConfirmar)

        await waitFor(() => {
          expect(screen.getByText('Confirmando...')).toBeDisabled()
        })
        expect(screen.getByText('Cancelar')).toBeDisabled()

        // Simula rejeição 409
        if (!rejectPost) throw new Error('rejectPost n�o inicializado');
        rejectPost(new apiClient.ApiError(409, 'Conflict', {}))
        await flushPromises()

        expect(screen.getByRole('dialog')).toBeInTheDocument()
        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent(/Check-in já foi retificado por outra operação/)
      })

      it('trata erros 403 e 404', async () => {
        mockFetchWithAuth.mockImplementation(async (url) => {
          if (url.includes('/eventos/11111111-1111-1111-1111-111111111111/participantes')) return getMockParticipantes()
          return mockEventos
        })

        mockPostWithAuth.mockRejectedValueOnce(new apiClient.ApiError(403, 'Forbidden', {}))

        render(<PortariaView />)
        await flushPromises()
        fireEvent.change(screen.getByRole('combobox'), { target: { value: '11111111-1111-1111-1111-111111111111' } })
        await flushPromises()

        fireEvent.click(screen.getByText('Retificar check-in'))
        fireEvent.change(screen.getByLabelText(/Motivo da retificação/), { target: { value: 'Valido motivo' } })
        fireEvent.click(screen.getByText('Confirmar retificação'))
        await flushPromises()

        expect(screen.getByRole('alert')).toHaveTextContent(/Sem autorização para retificar neste evento/)

        // Tenta de novo e forja um 404
        mockPostWithAuth.mockRejectedValueOnce(new apiClient.ApiError(404, 'Not Found', {}))
        fireEvent.change(screen.getByLabelText(/Motivo da retificação/), { target: { value: 'Valido 2' } })
        fireEvent.click(screen.getByText('Confirmar retificação'))
        await flushPromises()

        expect(screen.getByRole('alert')).toHaveTextContent(/Check-in n.*o encontrado/)
      })
    })

})
