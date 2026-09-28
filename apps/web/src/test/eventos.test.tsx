import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventosView } from '../components/eventos/EventosView'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/apiClient')>()
  return {
    ...actual,
    fetchWithAuth: vi.fn(),
    postWithAuth: vi.fn(),
    patchWithAuth: vi.fn(),
  }
})

const EVENTO_ID = '33333333-3333-3333-3333-333333333333'
const LOCAL_ID = '11111111-1111-1111-1111-111111111111'
const REGIONAL_ID = '22222222-2222-2222-2222-222222222222'

const mockEventos = [
  {
    id: EVENTO_ID,
    titulo: 'Reunião Presencial',
    descricao: 'Descrição do evento',
    pauta: 'Pauta do evento',
    modalidade: 'PRESENCIAL',
    inicioEm: '2026-10-10T10:00:00.000Z',
    fimEm: '2026-10-10T12:00:00.000Z',
    localId: LOCAL_ID,
    urlOnline: null,
    organizadorMembroId: null,
    regionalId: REGIONAL_ID,
    administracaoId: null,
    setorId: null,
    casaId: null,
    grupoTrabalhoId: null,
    observacoes: null,
    ativo: true,
  }
]

const SERIE_ID = '44444444-4444-4444-4444-444444444444'
const mockEventoRecorrente = {
  ...mockEventos[0],
  id: '55555555-5555-5555-5555-555555555555',
  titulo: 'Reunião Recorrente',
  serieRecorrenciaId: SERIE_ID,
  recorrenciaExcecao: false
}

describe('EventosView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return mockEventos
      if (url === '/locais') return [{ id: LOCAL_ID, nome: 'Sede' }]
      if (url === '/regionais') return [{ id: REGIONAL_ID, nome: 'Reg 1' }]
      return []
    })
  })

  it('deve listar eventos corretamente', async () => {
    render(<EventosView />)
    expect(screen.getByText('Gestão de Eventos')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.getByText('Reunião Presencial')).toBeInTheDocument()
      expect(screen.getByText('PRESENCIAL')).toBeInTheDocument()
    })
  })

  it('deve exibir empty state quando não houver eventos', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return []
      return []
    })

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Nenhum evento cadastrado.')).toBeInTheDocument()
    })
  })

  it('deve exibir detalhes de um evento em diálogo acessível', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url.startsWith(`/eventos/${EVENTO_ID}`)) return mockEventos[0]
      if (url === '/eventos') return mockEventos
      return []
    })

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Presencial')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /ver/i }))

    await waitFor(() => {
      const dialog = screen.getByRole('dialog', { name: /detalhes do evento/i })
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      
      const { getByText } = within(dialog)
      expect(getByText('Descrição do evento')).toBeInTheDocument()
    })
  })

  it('deve validar regra temporal: fim anterior ao início', async () => {
    vi.mocked(apiClient.postWithAuth).mockResolvedValueOnce({})
    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Presencial')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /\+ novo evento/i }))

    const dialog = await screen.findByRole('dialog', { name: /novo evento/i })
    const { getByLabelText, getByRole, findByRole } = within(dialog)

    fireEvent.change(getByLabelText(/título/i), { target: { value: 'Novo Evento' } })
    // Fim anterior ao início
    fireEvent.change(getByLabelText(/início/i), { target: { value: '2026-10-10T12:00' } })
    fireEvent.change(getByLabelText(/fim/i), { target: { value: '2026-10-10T10:00' } })
    
    // modalidade presencial
    fireEvent.change(getByLabelText(/modalidade/i), { target: { value: 'PRESENCIAL' } })
    fireEvent.change(getByLabelText(/local/i), { target: { value: LOCAL_ID } })

    // escopo
    fireEvent.change(getByLabelText(/tipo de escopo/i), { target: { value: 'regional' } })
    fireEvent.change(getByLabelText(/regional \*/i), { target: { value: REGIONAL_ID } })

    fireEvent.click(getByRole('button', { name: /salvar/i }))

    const alert = await findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(apiClient.postWithAuth).not.toHaveBeenCalled()
  })

  it('deve limpar urlOnline ao trocar para PRESENCIAL e vice-versa', async () => {
    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Presencial')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /\+ novo evento/i }))

    const dialog = await screen.findByRole('dialog', { name: /novo evento/i })
    const { getByLabelText, queryByLabelText } = within(dialog)

    // Online
    fireEvent.change(getByLabelText(/modalidade/i), { target: { value: 'ONLINE' } })
    expect(getByLabelText(/url online/i)).toBeInTheDocument()
    expect(queryByLabelText(/local \*/i)).not.toBeInTheDocument()

    // Hibrido
    fireEvent.change(getByLabelText(/modalidade/i), { target: { value: 'HIBRIDO' } })
    expect(getByLabelText(/url online/i)).toBeInTheDocument()
    expect(getByLabelText(/local \*/i)).toBeInTheDocument()

    // Presencial
    fireEvent.change(getByLabelText(/modalidade/i), { target: { value: 'PRESENCIAL' } })
    expect(queryByLabelText(/url online/i)).not.toBeInTheDocument()
    expect(getByLabelText(/local \*/i)).toBeInTheDocument()
  })

  it('deve editar um evento existente via PATCH e limpar scopes cruzados', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url.startsWith(`/eventos/${EVENTO_ID}`)) return mockEventos[0]
      if (url === '/eventos') return mockEventos
      if (url === '/locais') return [{ id: LOCAL_ID, nome: 'Sede' }]
      if (url === '/regionais') return [{ id: REGIONAL_ID, nome: 'Reg 1' }]
      return []
    })
    vi.mocked(apiClient.patchWithAuth).mockResolvedValueOnce({})

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Presencial')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])

    const dialog = await screen.findByRole('dialog', { name: /editar evento/i })
    const { getByLabelText, getByRole } = within(dialog)

    await waitFor(() => {
      expect(getByLabelText(/título/i)).toHaveValue('Reunião Presencial')
    })

    fireEvent.change(getByLabelText(/título/i), { target: { value: 'Reunião Presencial Editada' } })
    fireEvent.click(getByRole('button', { name: /salvar/i }))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(`/eventos/${EVENTO_ID}`, expect.objectContaining({
        titulo: 'Reunião Presencial Editada',
        regionalId: REGIONAL_ID,
        administracaoId: null,
      }))
    })
  })

  it('deve abrir escolha ao editar evento recorrente, cancelar não envia PATCH', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return [mockEventoRecorrente]
      return []
    })

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Recorrente')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])

    const dialogEscolha = await screen.findByRole('dialog', { name: /editar evento recorrente/i })
    expect(dialogEscolha).toBeInTheDocument()

    // Clicar em cancelar
    fireEvent.click(within(dialogEscolha).getByRole('button', { name: /cancelar/i }))
    expect(dialogEscolha).not.toBeInTheDocument()
    expect(apiClient.patchWithAuth).not.toHaveBeenCalled()
  })

  it('deve enviar updateMode THIS e fromEventId ao editar apenas a ocorrência', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url.startsWith(`/eventos/${mockEventoRecorrente.id}`)) return mockEventoRecorrente
      if (url === '/eventos') return [mockEventoRecorrente]
      if (url === '/locais') return [{ id: LOCAL_ID, nome: 'Sede' }]
      if (url === '/regionais') return [{ id: REGIONAL_ID, nome: 'Reg 1' }]
      return []
    })
    vi.mocked(apiClient.patchWithAuth).mockResolvedValueOnce({})

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Recorrente')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])

    const dialogEscolha = await screen.findByRole('dialog', { name: /editar evento recorrente/i })
    fireEvent.click(within(dialogEscolha).getByRole('button', { name: /apenas este evento/i }))

    const formDialog = await screen.findByRole('dialog', { name: /editar evento/i })
    const { getByLabelText, getByRole } = within(formDialog)

    await waitFor(() => {
      expect(getByLabelText(/título/i)).toHaveValue('Reunião Recorrente')
    })

    fireEvent.change(getByLabelText(/título/i), { target: { value: 'Reunião Recorrente Editada' } })
    fireEvent.click(getByRole('button', { name: /salvar/i }))

    // Confirmação de THIS
    const confirmDialog = await screen.findByRole('dialog', { name: /confirmar exceção/i })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /confirmar e salvar/i }))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(`/series-recorrencia/${SERIE_ID}`, expect.objectContaining({
        updateMode: 'THIS',
        fromEventId: mockEventoRecorrente.id,
        changes: expect.objectContaining({
          titulo: 'Reunião Recorrente Editada'
        })
      }))
    })
    
    // Assegurar que os campos de série NÃO estão presentes em changes (verificado por ser o objeto vindo do form)
    const patchCall = vi.mocked(apiClient.patchWithAuth).mock.calls[0][1]
    expect(patchCall.changes).not.toHaveProperty('frequencia')
    expect(patchCall.changes).not.toHaveProperty('intervalo')
  })

  it('deve exibir erro da API se falhar no PATCH THIS', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url.startsWith(`/eventos/${mockEventoRecorrente.id}`)) return mockEventoRecorrente
      if (url === '/eventos') return [mockEventoRecorrente]
      return []
    })
    
    vi.mocked(apiClient.patchWithAuth).mockRejectedValueOnce(
      new apiClient.ApiError(409, 'Conflito de horários', { error: 'Conflito de horários' })
    )

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Recorrente')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])
    
    const dialogEscolha = await screen.findByRole('dialog', { name: /editar evento recorrente/i })
    fireEvent.click(within(dialogEscolha).getByRole('button', { name: /apenas este evento/i }))

    const formDialog = await screen.findByRole('dialog', { name: /editar evento/i })
    const { getByRole } = within(formDialog)

    await waitFor(() => {
      expect(within(formDialog).getByLabelText(/título/i)).toHaveValue('Reunião Recorrente')
    })

    fireEvent.click(getByRole('button', { name: /salvar/i }))

    const confirmDialog = await screen.findByRole('dialog', { name: /confirmar exceção/i })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /confirmar e salvar/i }))

    const erroDiv = await screen.findByText('Conflito de horários')
    expect(erroDiv).toBeInTheDocument()
  })
  it('deve enviar updateMode THIS_AND_FUTURE e fromEventId ao editar este e os próximos', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url.startsWith(`/series-recorrencia/${SERIE_ID}`)) return { ...mockEventoRecorrente, frequencia: 'DIARIA', intervalo: 1, dataInicio: '2026-10-10', dataFim: '2026-10-20', horarioInicio: '10:00', horarioFim: '12:00' }
      if (url === '/eventos') return [mockEventoRecorrente]
      if (url === '/locais') return [{ id: LOCAL_ID, nome: 'Sede' }]
      if (url === '/regionais') return [{ id: REGIONAL_ID, nome: 'Reg 1' }]
      return []
    })
    vi.mocked(apiClient.patchWithAuth).mockResolvedValueOnce({})

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Recorrente')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])

    const dialogEscolha = await screen.findByRole('dialog', { name: /editar evento recorrente/i })
    fireEvent.click(within(dialogEscolha).getByRole('button', { name: /este e os próximos eventos/i }))

    const formDialog = await screen.findByRole('dialog', { name: /editar evento recorrente/i })
    const { getByLabelText, getByRole } = within(formDialog)

    await waitFor(() => {
      expect(getByLabelText(/título/i)).toHaveValue('Reunião Recorrente')
    })

    fireEvent.change(getByLabelText(/título/i), { target: { value: 'Série Editada' } })
    fireEvent.click(getByRole('button', { name: /salvar série/i }))

    // Confirmação de THIS_AND_FUTURE
    const confirmDialog = await screen.findByRole('dialog', { name: /confirmar edição/i })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /confirmar e salvar/i }))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(`/series-recorrencia/${SERIE_ID}`, expect.objectContaining({
        updateMode: 'THIS_AND_FUTURE',
        fromEventId: mockEventoRecorrente.id,
        changes: expect.objectContaining({
          titulo: 'Série Editada',
          frequencia: 'DIARIA'
        })
      }))
    })
  })

  it('deve exibir erro da API se falhar no PATCH THIS_AND_FUTURE', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url.startsWith(`/series-recorrencia/${SERIE_ID}`)) return { ...mockEventoRecorrente, frequencia: 'DIARIA', intervalo: 1, dataInicio: '2026-10-10', dataFim: '2026-10-20', horarioInicio: '10:00', horarioFim: '12:00' }
      if (url === '/eventos') return [mockEventoRecorrente]
      return []
    })
    
    vi.mocked(apiClient.patchWithAuth).mockRejectedValueOnce(
      new apiClient.ApiError(409, 'Erro na série futura', { error: 'Erro na série futura' })
    )

    render(<EventosView />)

    await waitFor(() => {
      expect(screen.getByText('Reunião Recorrente')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0])
    
    const dialogEscolha = await screen.findByRole('dialog', { name: /editar evento recorrente/i })
    fireEvent.click(within(dialogEscolha).getByRole('button', { name: /este e os próximos eventos/i }))

    const formDialog = await screen.findByRole('dialog', { name: /editar evento recorrente/i })
    const { getByRole } = within(formDialog)

    await waitFor(() => {
      expect(within(formDialog).getByLabelText(/título/i)).toHaveValue('Reunião Recorrente')
    })

    fireEvent.click(getByRole('button', { name: /salvar série/i }))

    const confirmDialog = await screen.findByRole('dialog', { name: /confirmar edição/i })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /confirmar e salvar/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /confirmar edição/i })).not.toBeInTheDocument()
    })

    expect(screen.getByRole('dialog', { name: /editar evento recorrente/i })).toBeInTheDocument()

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.some(alert => alert.textContent === 'Erro na série futura')).toBe(true)
  })
})
