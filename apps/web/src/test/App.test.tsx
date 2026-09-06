import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', () => ({
  fetchWithAuth: vi.fn(),
  API_BASE_URL: 'http://test'
}))

describe('App — S07 Minha Agenda', () => {
  it('renderiza o elemento main', () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue([])
    render(<App />)
    expect(screen.getByRole('main')).toBeDefined()
  })

  it('exibe o título atual da aplicação', () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue([])
    render(<App />)
    expect(screen.getByText('Agenda Regional SP')).toBeDefined()
  })

  it('exibe a navegação principal da S07', () => {
    ;(apiClient.fetchWithAuth as any).mockResolvedValue([])
    render(<App />)
    expect(screen.getByText('Agenda')).toBeDefined()
    expect(screen.getByText('Calendário')).toBeDefined()
  })
})
