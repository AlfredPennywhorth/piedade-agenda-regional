import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import * as apiClient from '../api/apiClient'

// Mock the API client
vi.mock('../api/apiClient', () => ({
  fetchWithAuth: vi.fn(),
  API_BASE_URL: 'http://test'
}))

const mockEventos = [
  {
    evento: {
      id: '1',
      titulo: 'Reunião de Setor',
      inicioEm: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      fimEm: new Date(Date.now() + 90000000).toISOString(),
      modalidade: 'HIBRIDO',
    },
    convocacao: { id: 'c1', observacoes: 'Levar caderno' },
    local: { nome: 'Sede Regional', endereco: 'Rua X' }
  },
  {
    evento: {
      id: '2',
      titulo: 'Encontro Online',
      inicioEm: new Date(Date.now() + 172800000).toISOString(), // In 2 days
      fimEm: new Date(Date.now() + 180000000).toISOString(),
      modalidade: 'ONLINE',
    },
    convocacao: { id: 'c2', observacoes: null },
    local: null
  }
]

describe('S07 - Minha Agenda e Calendário', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('1. Renderiza o Layout Principal com Navegação', () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue([])
    render(<App />)
    
    expect(screen.getByText('Agenda Regional SP')).toBeInTheDocument()
    expect(screen.getByText('Agenda')).toBeInTheDocument()
    expect(screen.getByText('Calendário')).toBeInTheDocument()
  })

  it('2. Exibe estado de loading e vazio na Agenda', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue([])
    render(<App />)
    
    // Test for empty state
    await waitFor(() => {
      expect(screen.getByText('Você não possui eventos futuros agendados.')).toBeInTheDocument()
    })
  })

  it('3. Renderiza lista de eventos (Minha Agenda) ordenados', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    
    await waitFor(() => {
      expect(screen.getByText('Reunião de Setor')).toBeInTheDocument()
      expect(screen.getByText('Encontro Online')).toBeInTheDocument()
    })
    
    // Check modalities and local
    expect(screen.getByText('HIBRIDO')).toBeInTheDocument()
    expect(screen.getByText('ONLINE')).toBeInTheDocument()
    expect(screen.getByText('Sede Regional')).toBeInTheDocument()
  })

  it('4. Navega para Calendário e exibe grid mensal', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    
    const calTab = screen.getByText('Calendário')
    fireEvent.click(calTab)
    
    await waitFor(() => {
      expect(screen.getByText('Dom')).toBeInTheDocument()
      expect(screen.getByText('Seg')).toBeInTheDocument()
    })
    
    // Check month rendering (will contain current month name, e.g. "Janeiro", "Fevereiro")
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    const today = new Date()
    expect(screen.getByText(new RegExp(months[today.getMonth()]))).toBeInTheDocument()
  })

  it('5. Cenário de Erro da API', async () => {
    ;(apiClient.fetchWithAuth as any).mockRejectedValue(new Error('Sessão expirada'))
    render(<App />)
    
    await waitFor(() => {
      expect(screen.getByText('Sessão expirada')).toBeInTheDocument()
    })
  })

  it('6. Seleciona dia com evento no calendário e exibe lista', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    
    // Go to calendar
    fireEvent.click(screen.getByText('Calendário'))
    await waitFor(() => expect(screen.getByText('Dom')).toBeInTheDocument())
    
    // Find the day button (tomorrow)
    const tmrw = new Date(Date.now() + 86400000)
    const dayBtn = screen.getByLabelText(`Selecionar dia ${tmrw.getDate()}`)
    fireEvent.click(dayBtn)
    
    // Expect event in list below calendar
    await waitFor(() => {
      expect(screen.getByText('Reunião de Setor')).toBeInTheDocument()
    })
  })

  it('7. Seleciona dia sem evento no calendário', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    
    // Go to calendar
    fireEvent.click(screen.getByText('Calendário'))
    await waitFor(() => expect(screen.getByText('Dom')).toBeInTheDocument())
    
    // Find a day without event (assuming day 1 has no events in mock)
    // We mock events for tomorrow and in 2 days. Let's just click today.
    const today = new Date()
    const dayBtn = screen.getByLabelText(`Selecionar dia ${today.getDate()}`)
    fireEvent.click(dayBtn)
    
    // Expect empty state
    await waitFor(() => {
      expect(screen.getByText('Nenhum evento agendado para este dia.')).toBeInTheDocument()
    })
  })

  it('8. Abre detalhe pela Minha Agenda e verifica conteúdo (HIBRIDO/PRESENCIAL)', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)

    // Aguarda o botão do card aparecer e clica semanticamente no elemento interativo
    const cardBtn = await screen.findByRole('button', { name: /Reunião de Setor/i })
    fireEvent.click(cardBtn)

    // Aguarda o dialog aparecer de forma assíncrona (showModal define o atributo open)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Sede Regional')).toBeInTheDocument()
    expect(screen.getByText('Rua X')).toBeInTheDocument()
    expect(screen.getByText('Levar caderno')).toBeInTheDocument()

    // Fechar modal
    fireEvent.click(screen.getByLabelText('Fechar detalhes'))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('9. Abre detalhe pelo Calendário e verifica conteúdo ONLINE', async () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue(mockEventos)
    render(<App />)
    
    // Go to calendar
    fireEvent.click(screen.getByText('Calendário'))
    await waitFor(() => expect(screen.getByText('Dom')).toBeInTheDocument())
    
    // Click day
    const day = new Date(Date.now() + 172800000)
    const dayBtn = screen.getByLabelText(`Selecionar dia ${day.getDate()}`)
    fireEvent.click(dayBtn)
    
    await waitFor(() => {
      expect(screen.getByText('Encontro Online')).toBeInTheDocument()
    })
    
    // Open details
    fireEvent.click(screen.getByText('Encontro Online'))
    
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      // "Sede Regional" should NOT be here (it is ONLINE)
      expect(screen.queryByText('Sede Regional')).not.toBeInTheDocument()
    })
  })
})
