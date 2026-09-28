import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', () => ({
  fetchWithAuth: vi.fn(),
  postWithAuth: vi.fn(),
  limparTokenSessao: vi.fn(() => localStorage.removeItem('session_token')),
  possuiTokenSessao: vi.fn(() => Boolean(localStorage.getItem('session_token'))),
  API_BASE_URL: 'http://test',
}))

describe('App — S07 Minha Agenda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('session_token', 'sessao-teste')
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/auth/me') {
        return { nome: 'Pessoa Teste', capacidades: {} }
      }
      if (endpoint === '/governanca/responsabilidade-regional') {
        return {
          tipo: 'RESPONSAVEL_REGIONAL_PMO',
          natureza: 'CIENCIA_DE_RESPONSABILIDADE',
          versao: 'teste',
          texto: 'Responsabilidades',
          acessos: [],
        }
      }
      return []
    })
  })

  it('renderiza o elemento main após validar a sessão', async () => {
    render(<App />)
    expect(await screen.findByRole('main')).toBeDefined()
  })

  it('exibe o título atual da aplicação', async () => {
    render(<App />)
    expect(await screen.findByText('Agenda Regional SP')).toBeDefined()
    expect(screen.getByText('Pessoa Teste')).toBeDefined()
  })

  it('exibe a navegação principal da S07', async () => {
    render(<App />)
    const nav = within(await screen.findByRole('navigation', { name: /navegação móvel principal/i }))
    expect(nav.getByText('Minha Agenda')).toBeDefined()
    expect(nav.getByText('Calendário')).toBeDefined()
  })

  it('oculta módulos restritos sem capacidades', async () => {
    render(<App />)
    const nav = within(await screen.findByRole('navigation', { name: /navegação móvel principal/i }))
    expect(nav.getByText('Minha Agenda')).toBeDefined()
    fireEvent.click(nav.getByRole('button', { name: /Mais/i }))
    const menu = within(screen.getByRole('dialog', { name: /mais opções/i }))
    expect(menu.queryByText('Portaria')).toBeNull()
    expect(menu.queryByText('Relatórios')).toBeNull()
    expect(menu.queryByText('Auditoria')).toBeNull()
  })

  it('exibe módulos restritos quando as capacidades são concedidas', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/auth/me') {
        return {
          nome: 'Pessoa Teste',
          capacidades: {
            podeOperarPortaria: true,
            podeVisualizarRelatorios: true,
            podeVisualizarAuditoria: true,
          },
        }
      }
      if (endpoint === '/governanca/responsabilidade-regional') {
        return {
          tipo: 'RESPONSAVEL_REGIONAL_PMO',
          natureza: 'CIENCIA_DE_RESPONSABILIDADE',
          versao: 'teste',
          texto: 'Responsabilidades',
          acessos: [],
        }
      }
      return []
    })

    render(<App />)
    const nav = within(await screen.findByRole('navigation', { name: /navegação móvel principal/i }))
    fireEvent.click(nav.getByRole('button', { name: /Mais/i }))
    const menu = within(screen.getByRole('dialog', { name: /mais opções/i }))
    expect(menu.getByText('Portaria')).toBeDefined()
    expect(menu.getByText('Relatórios')).toBeDefined()
    expect(menu.getByText('Auditoria')).toBeDefined()
  })

  it('exibe login quando não existe sessão local', async () => {
    localStorage.removeItem('session_token')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeDefined()
    expect(screen.queryByRole('navigation', { name: /navegação móvel principal/i })).toBeNull()
  })
})
