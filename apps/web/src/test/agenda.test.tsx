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
})
