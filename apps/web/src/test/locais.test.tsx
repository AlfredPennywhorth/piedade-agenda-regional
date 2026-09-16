import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocaisView } from '../components/locais/LocaisView'
import * as apiClient from '../api/apiClient'
import { z } from 'zod'

vi.mock('../api/apiClient', () => ({
  fetchWithAuth: vi.fn(),
  postWithAuth: vi.fn(),
  patchWithAuth: vi.fn()
}))

const mockLocais = [
  {
    id: '1',
    nome: 'Templo Central',
    endereco: 'Rua A',
    numero: '100',
    cidade: 'São Paulo',
    uf: 'SP',
    ativo: true,
  }
]

describe('LocaisView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve listar locais corretamente', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValueOnce(mockLocais)

    render(<LocaisView />)

    expect(screen.getByText('Gestão de Locais')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.getByText('Templo Central')).toBeInTheDocument()
      expect(screen.getByText('Rua A, 100')).toBeInTheDocument()
      expect(screen.getByText('São Paulo - SP')).toBeInTheDocument()
    })
  })

  it('deve exibir empty state quando não houver locais', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValueOnce([])

    render(<LocaisView />)

    await waitFor(() => {
      expect(screen.getByText('Nenhum local cadastrado.')).toBeInTheDocument()
    })
  })

  it('deve exibir detalhes de um local em diálogo acessível', async () => {
    vi.mocked(apiClient.fetchWithAuth)
      .mockResolvedValueOnce(mockLocais) // list
      .mockResolvedValueOnce({
        ...mockLocais[0],
        bairro: 'Centro',
        urlMaps: 'https://maps.google.com/test'
      }) // detail

    render(<LocaisView />)

    await waitFor(() => {
      expect(screen.getByText('Templo Central')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /ver/i }))

    await waitFor(() => {
      const dialog = screen.getByRole('dialog', { name: /detalhes do local/i })
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      
      const { getByText } = within(dialog)
      expect(getByText('Centro - São Paulo / SP')).toBeInTheDocument()
      expect(getByText('Ver no Google Maps')).toHaveAttribute('href', 'https://maps.google.com/test')
    })
  })

  it('deve criar um novo local validando campos obrigatórios', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValueOnce([]) // list
    vi.mocked(apiClient.postWithAuth).mockResolvedValueOnce({})

    render(<LocaisView />)

    await waitFor(() => {
      expect(screen.getByText('Cadastrar primeiro local')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Cadastrar primeiro local'))

    const dialog = screen.getByRole('dialog', { name: /novo local/i })
    const { getByLabelText, getByRole } = within(dialog)

    fireEvent.change(getByLabelText(/nome/i), { target: { value: 'Novo Local' } })
    fireEvent.change(getByLabelText(/endereço/i), { target: { value: 'Av B' } })
    fireEvent.change(getByLabelText(/número/i), { target: { value: '200' } })
    fireEvent.change(getByLabelText(/cidade/i), { target: { value: 'Campinas' } })
    fireEvent.change(getByLabelText(/uf/i), { target: { value: 'sp' } }) // deve ficar SP pelo onChange handler ou validação Zod
    
    fireEvent.click(getByRole('button', { name: /salvar local/i }))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith('/locais', expect.objectContaining({
        nome: 'Novo Local',
        endereco: 'Av B',
        numero: '200',
        cidade: 'Campinas',
        uf: 'SP', // uppercase
        ativo: true
      }))
    })
  })

  it('deve falhar validação Zod client-side para URL inválida', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValueOnce([])

    render(<LocaisView />)

    await waitFor(() => {
      expect(screen.getByText('Cadastrar primeiro local')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Cadastrar primeiro local'))

    const dialog = screen.getByRole('dialog')
    const { getByLabelText, getByRole, findByText } = within(dialog)

    fireEvent.change(getByLabelText(/nome/i), { target: { value: 'Novo Local' } })
    fireEvent.change(getByLabelText(/endereço/i), { target: { value: 'Av B' } })
    fireEvent.change(getByLabelText(/número/i), { target: { value: '200' } })
    fireEvent.change(getByLabelText(/cidade/i), { target: { value: 'Campinas' } })
    fireEvent.change(getByLabelText(/uf/i), { target: { value: 'SP' } })
    
    // Invalid URL
    fireEvent.change(getByLabelText(/URL Google Maps/i), { target: { value: 'not-a-url' } })

    fireEvent.click(getByRole('button', { name: /salvar local/i }))

    expect(await findByText(/URL inválida/i)).toBeInTheDocument()
    expect(apiClient.postWithAuth).not.toHaveBeenCalled()
  })

  it('deve editar um local via PATCH', async () => {
    vi.mocked(apiClient.fetchWithAuth)
      .mockResolvedValueOnce(mockLocais) // list
      .mockResolvedValueOnce(mockLocais[0]) // GET detail for edit
      .mockResolvedValueOnce(mockLocais) // list after edit
    
    vi.mocked(apiClient.patchWithAuth).mockResolvedValueOnce({})

    render(<LocaisView />)

    await waitFor(() => {
      expect(screen.getByText('Templo Central')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /editar/i }))

    await waitFor(() => {
      const dialog = screen.getByRole('dialog', { name: /editar local/i })
      const { getByLabelText } = within(dialog)
      expect((getByLabelText(/nome/i) as HTMLInputElement).value).toBe('Templo Central')
    })

    const dialog = screen.getByRole('dialog')
    const { getByLabelText, getByRole } = within(dialog)

    fireEvent.change(getByLabelText(/nome/i), { target: { value: 'Templo Central Editado' } })
    
    fireEvent.click(getByRole('button', { name: /salvar local/i }))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith('/locais/1', expect.objectContaining({
        nome: 'Templo Central Editado'
      }))
    })
  })

  it('deve exibir mensagem de erro se listagem falhar', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockRejectedValueOnce(new Error('Erro 500'))

    render(<LocaisView />)

    await waitFor(() => {
      expect(screen.getByText('Erro 500')).toBeInTheDocument()
    })
  })
})
