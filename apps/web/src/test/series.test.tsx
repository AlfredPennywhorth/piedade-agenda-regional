import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { SeriesView } from '../components/series/SeriesView'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', () => ({
  fetchWithAuth: vi.fn(),
  postWithAuth: vi.fn(),
  patchWithAuth: vi.fn(),
  deleteWithAuth: vi.fn(),
  ApiError: class ApiError extends Error {
    body: any
    constructor(message: string, body: any) {
      super(message)
      this.body = body
    }
  }
}))

const MOCK_SERIES = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    titulo: 'Reunião Semanal',
    modalidade: 'ONLINE',
    frequencia: 'SEMANAL',
    intervalo: 1,
    dataInicio: '2025-01-01',
    dataFim: '2025-12-31',
    horarioInicio: '20:00',
    horarioFim: '21:00',
    diaSemana: 1, // Segunda
    diaMes: null,
    posicaoSemanaMes: null,
    localId: null,
    urlOnline: 'https://meet.google.com/abc',
    organizadorMembroId: '2b4c13a0-7f2e-4b9d-a8e5-3d5f9c8b7a6d',
    regionalId: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    administracaoId: null,
    setorId: null,
    casaId: null,
    grupoTrabalhoId: null,
    ativo: true,
  }
]

const MOCK_LOOKUPS = {
  locais: [{ id: '9f8b7c6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4', nome: 'Sede Regional' }],
  membros: [{ id: '2b4c13a0-7f2e-4b9d-a8e5-3d5f9c8b7a6d', nome: 'João' }],
  regionais: [{ id: 'd290f1ee-6c54-4b01-90e6-d701748f0851', nome: 'SP' }],
  administracoes: [],
  setores: [],
  casas: [],
  gruposTrabalho: []
}

describe('SeriesView', () => {
  beforeEach(() => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/series-recorrencia') return MOCK_SERIES
      if (url === '/locais') return MOCK_LOOKUPS.locais
      if (url === '/membros') return MOCK_LOOKUPS.membros
      if (url === '/regionais') return MOCK_LOOKUPS.regionais
      if (url === '/administracoes') return MOCK_LOOKUPS.administracoes
      if (url === '/setores') return MOCK_LOOKUPS.setores
      if (url === '/casas') return MOCK_LOOKUPS.casas
      if (url === '/grupos-trabalho') return MOCK_LOOKUPS.gruposTrabalho
      return []
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('deve listar as séries e permitir visualizar os detalhes num diálogo acessível', async () => {
    render(<SeriesView />)

    // Aguarda carregamento
    await waitFor(() => {
      expect(screen.getByText('Reunião Semanal')).toBeInTheDocument()
    })

    // Abre detalhes
    const btns = screen.getAllByText('Ver')
    fireEvent.click(btns[0])

    // Verifica acessibilidade do diálogo de detalhe
    const dialog = screen.getByRole('dialog', { name: 'Detalhes da Série' })
    expect(dialog).toBeInTheDocument()
    const view = within(dialog)
    expect(view.getByText('Semanal')).toBeInTheDocument()
    expect(view.getByText(/2025-01-01\s*20:00/)).toBeInTheDocument()

    // Fecha o modal
    fireEvent.click(screen.getByText('✕'))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Detalhes da Série' })).not.toBeInTheDocument()
    })
  })

  it('deve alternar campos condicionais de modalidade e limpar incompatíveis', async () => {
    render(<SeriesView />)

    await waitFor(() => screen.getByText('+ Nova Série'))
    fireEvent.click(screen.getByText('+ Nova Série'))

    // Seleciona modalidade HIBRIDO
    const modalidadeSelect = screen.getByLabelText(/Modalidade \*/i)
    fireEvent.change(modalidadeSelect, { target: { value: 'HIBRIDO' } })

    expect(screen.getByLabelText(/Local \*/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/URL Online \*/i)).toBeInTheDocument()

    // Preenche ambos
    fireEvent.change(screen.getByLabelText(/Local \*/i), { target: { value: '9f8b7c6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4' } })
    fireEvent.change(screen.getByLabelText(/URL Online \*/i), { target: { value: 'https://zoom.us' } })

    // Altera para PRESENCIAL (deve esconder URL Online)
    fireEvent.change(modalidadeSelect, { target: { value: 'PRESENCIAL' } })
    expect(screen.queryByLabelText(/URL Online \*/i)).not.toBeInTheDocument()

    // Submete e verifica o payload para confirmar que urlOnline foi limpo
    fireEvent.change(screen.getByLabelText(/Título \*/i), { target: { value: 'Teste' } })
    fireEvent.change(screen.getByLabelText(/Data Início \*/i), { target: { value: '2025-01-01' } })
    fireEvent.change(screen.getByLabelText(/Data Fim \*/i), { target: { value: '2025-01-31' } })
    fireEvent.change(screen.getByLabelText(/Horário Início \*/i), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText(/Horário Fim \*/i), { target: { value: '11:00' } })
    
    // Escopo
    fireEvent.change(screen.getByLabelText(/Tipo de Escopo/i), { target: { value: 'regional' } })
    fireEvent.change(screen.getByLabelText(/Regional \*/i), { target: { value: 'd290f1ee-6c54-4b01-90e6-d701748f0851' } })

    vi.mocked(apiClient.postWithAuth).mockResolvedValueOnce({})
    fireEvent.click(screen.getByText('Salvar Série'))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalled()
    })
    
    const payload = vi.mocked(apiClient.postWithAuth).mock.calls[0][1] as any
    expect(payload.modalidade).toBe('PRESENCIAL')
    expect(payload.urlOnline).toBeNull()
    expect(payload.localId).toBe('9f8b7c6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4')
  })

  it('deve apresentar os campos condicionais corretos para as frequências e validar o formulário (role="alert")', async () => {
    render(<SeriesView />)

    await waitFor(() => screen.getByText('+ Nova Série'))
    fireEvent.click(screen.getByText('+ Nova Série'))

    const form = screen.getByRole('dialog', { name: 'Nova Série de Recorrência' }).querySelector('form')
    expect(form).toHaveAttribute('noValidate')

    // SEMANAL: exibe diaSemana
    const frequenciaSelect = screen.getByLabelText(/Frequência \*/i)
    fireEvent.change(frequenciaSelect, { target: { value: 'SEMANAL' } })
    expect(screen.getByLabelText(/Dia da Semana \*/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Dia do Mês \*/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Posição na Semana \*/i)).not.toBeInTheDocument()

    // MENSAL_DIA_FIXO: exibe diaMes
    fireEvent.change(frequenciaSelect, { target: { value: 'MENSAL_DIA_FIXO' } })
    expect(screen.queryByLabelText(/Dia da Semana \*/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Dia do Mês \*/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Posição na Semana \*/i)).not.toBeInTheDocument()

    // MENSAL_POSICAO_SEMANA: exibe diaSemana e posicaoSemanaMes
    fireEvent.change(frequenciaSelect, { target: { value: 'MENSAL_POSICAO_SEMANA' } })
    expect(screen.getByLabelText(/Dia da Semana \*/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Posição na Semana \*/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Dia do Mês \*/i)).not.toBeInTheDocument()

    // Testa as mensagens de erro acessíveis disparando o submit vazio
    fireEvent.click(screen.getByText('Salvar Série'))

    // Deve aparecer role="alert" do zod
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      expect(alerts.length).toBeGreaterThan(0)
    })
  })

  it('deve permitir criar uma série com strings nativas de data/hora, validando o envio', async () => {
    render(<SeriesView />)

    await waitFor(() => screen.getByText('+ Nova Série'))
    fireEvent.click(screen.getByText('+ Nova Série'))

    fireEvent.change(screen.getByLabelText(/Título \*/i), { target: { value: 'Série Integrada' } })
    fireEvent.change(screen.getByLabelText(/Data Início \*/i), { target: { value: '2026-03-01' } })
    fireEvent.change(screen.getByLabelText(/Data Fim \*/i), { target: { value: '2026-04-01' } })
    fireEvent.change(screen.getByLabelText(/Horário Início \*/i), { target: { value: '08:30' } })
    fireEvent.change(screen.getByLabelText(/Horário Fim \*/i), { target: { value: '12:00' } })

    fireEvent.change(screen.getByLabelText(/Frequência \*/i), { target: { value: 'DIARIA' } })
    // Diaria nao precisa de dias especificos

    fireEvent.change(screen.getByLabelText(/Modalidade \*/i), { target: { value: 'ONLINE' } })
    fireEvent.change(screen.getByLabelText(/URL Online \*/i), { target: { value: 'https://teams.microsoft.com/xyz' } })

    fireEvent.change(screen.getByLabelText(/Tipo de Escopo/i), { target: { value: 'regional' } })
    fireEvent.change(screen.getByLabelText(/Regional \*/i), { target: { value: 'd290f1ee-6c54-4b01-90e6-d701748f0851' } })

    vi.mocked(apiClient.postWithAuth).mockResolvedValueOnce({})
    fireEvent.click(screen.getByText('Salvar Série'))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith('/series-recorrencia', expect.objectContaining({
        titulo: 'Série Integrada',
        dataInicio: '2026-03-01',
        dataFim: '2026-04-01',
        horarioInicio: '08:30',
        horarioFim: '12:00',
        frequencia: 'DIARIA',
        intervalo: 1,
        modalidade: 'ONLINE',
        urlOnline: 'https://teams.microsoft.com/xyz',
        regionalId: 'd290f1ee-6c54-4b01-90e6-d701748f0851'
      }))
    })
  })
})
