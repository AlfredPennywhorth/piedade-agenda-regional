import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RegionaisView } from '../components/regionais/RegionaisView'
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

describe('S01 — RegionaisView (Gestão Territorial Frontend)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('1. Listar: deve carregar e exibir lista de regionais', async () => {
    const mockRegionais = [
      { id: 'reg-1', nome: 'Regional São Paulo Leste', codigo: 'SP-ESTE', ativo: true, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'reg-2', nome: 'Regional São Paulo Norte', codigo: 'SP-NTE', ativo: false, createdAt: '2026-01-02T00:00:00.000Z' }
    ]

    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue(mockRegionais)

    render(<RegionaisView />)

    expect(screen.getByText('Gestão Territorial — Regionais')).toBeInTheDocument()
    expect(await screen.findByText('Regional São Paulo Leste')).toBeInTheDocument()
    expect(screen.getByText('Regional São Paulo Norte')).toBeInTheDocument()
    expect(screen.getByText('SP-ESTE')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('Inativo')).toBeInTheDocument()
  })

  it('2. Vazio: deve exibir estado vazio quando a lista estiver vazia', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue([])

    render(<RegionaisView />)

    expect(await screen.findByText('Nenhuma regional cadastrada até o momento.')).toBeInTheDocument()
  })

  it('3. Erro na listagem: deve exibir mensagem de erro se a busca falhar', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockRejectedValue(new Error('Erro de conexão com o servidor'))

    render(<RegionaisView />)

    expect(await screen.findByText('Erro de conexão com o servidor')).toBeInTheDocument()
  })

  it('4. Detalhar: deve carregar e exibir os detalhes de uma regional ao clicar em Detalhes', async () => {
    const mockRegionais = [
      { id: 'reg-1', nome: 'Regional Campinas', codigo: 'CPS', ativo: true, createdAt: '2026-02-01T00:00:00.000Z' }
    ]

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/regionais') return mockRegionais
      if (endpoint === '/regionais/reg-1') return mockRegionais[0]
      throw new Error('Not found')
    })

    render(<RegionaisView />)

    const btnDetalhes = await screen.findByText('Detalhes')
    fireEvent.click(btnDetalhes)

    expect(await screen.findByRole('heading', { name: 'Detalhes da Regional' })).toBeInTheDocument()
    expect(screen.getAllByText('Regional Campinas').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('CPS').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('reg-1')).toBeInTheDocument()
  })

  it('5. Criar: deve cadastrar uma nova regional com sucesso', async () => {
    const mockRegionaisInicial: any[] = []
    const novaRegional = { id: 'reg-novo', nome: 'Regional Santos', codigo: 'STS', ativo: true }

    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue(mockRegionaisInicial)
    vi.mocked(apiClient.postWithAuth).mockResolvedValue(novaRegional)

    render(<RegionaisView />)

    await screen.findByText('Nenhuma regional cadastrada até o momento.')

    const btnNovo = screen.getByText('+ Nova Regional')
    fireEvent.click(btnNovo)

    expect(screen.getByText('Cadastrar Nova Regional')).toBeInTheDocument()

    const inputNome = screen.getByLabelText(/Nome da Regional/i)
    const inputCodigo = screen.getByLabelText(/Código/i)

    fireEvent.change(inputNome, { target: { value: 'Regional Santos' } })
    fireEvent.change(inputCodigo, { target: { value: 'STS' } })

    const btnSalvar = screen.getByText('Salvar Regional')
    fireEvent.click(btnSalvar)

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith('/regionais', {
        nome: 'Regional Santos',
        codigo: 'STS',
        ativo: true
      })
    })

    expect(await screen.findByText('Regional criada com sucesso!')).toBeInTheDocument()
  })

  it('6. Criar com erro de validação Zod: nome menor que 2 caracteres não chama API', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue([])

    render(<RegionaisView />)

    await screen.findByText('Nenhuma regional cadastrada até o momento.')

    fireEvent.click(screen.getByText('+ Nova Regional'))

    const inputNome = screen.getByLabelText(/Nome da Regional/i)
    fireEvent.change(inputNome, { target: { value: 'A' } })

    fireEvent.click(screen.getByText('Salvar Regional'))

    expect(await screen.findByText('Nome deve ter no mínimo 2 caracteres')).toBeInTheDocument()
    expect(apiClient.postWithAuth).not.toHaveBeenCalled()
  })

  it('7. Editar: deve carregar dados existentes e atualizar regional via PATCH', async () => {
    const mockRegional = { id: 'reg-1', nome: 'Regional Antiga', codigo: 'ANT', ativo: true }
    const regionalAtualizada = { id: 'reg-1', nome: 'Regional Atualizada', codigo: 'ATU', ativo: false }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/regionais') return [mockRegional]
      if (endpoint === '/regionais/reg-1') return mockRegional
      throw new Error('Not found')
    })
    vi.mocked(apiClient.patchWithAuth).mockResolvedValue(regionalAtualizada)

    render(<RegionaisView />)

    const btnEditar = await screen.findByText('Editar')
    fireEvent.click(btnEditar)

    expect(await screen.findByText('Editar Regional')).toBeInTheDocument()

    const inputNome = screen.getByLabelText(/Nome da Regional/i)
    const inputCodigo = screen.getByLabelText(/Código/i)
    const inputAtivo = screen.getByLabelText(/Regional Ativa/i)

    await waitFor(() => {
      expect((inputNome as HTMLInputElement).value).toBe('Regional Antiga')
    })

    fireEvent.change(inputNome, { target: { value: 'Regional Atualizada' } })
    fireEvent.change(inputCodigo, { target: { value: 'ATU' } })
    fireEvent.click(inputAtivo) // inativar (ativo = false)

    fireEvent.click(screen.getByText('Atualizar Regional'))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith('/regionais/reg-1', {
        nome: 'Regional Atualizada',
        codigo: 'ATU',
        ativo: false
      })
    })

    expect(await screen.findByText('Regional atualizada com sucesso!')).toBeInTheDocument()
  })

  it('Administrador Regional consulta Regionais sem controles de mutação', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue([
      { id: 'reg-1', nome: 'Regional São Paulo', codigo: 'SP', ativo: true }
    ])

    render(<RegionaisView podeEditar={false} />)

    expect(await screen.findByText('Regional São Paulo')).toBeInTheDocument()
    expect(screen.getByText('Consulta de Regionais')).toBeInTheDocument()
    expect(screen.queryByText('+ Nova Regional')).not.toBeInTheDocument()
    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
    expect(screen.getByText('Detalhes')).toBeInTheDocument()
  })

  it('8. Erro no servidor ao criar/editar: exibe mensagem de erro retornada pela API', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue([])
    vi.mocked(apiClient.postWithAuth).mockRejectedValue(new apiClient.ApiError(400, 'Código regional já cadastrado', { error: 'Código regional já cadastrado' }))

    render(<RegionaisView />)

    await screen.findByText('Nenhuma regional cadastrada até o momento.')

    fireEvent.click(screen.getByText('+ Nova Regional'))

    const inputNome = screen.getByLabelText(/Nome da Regional/i)
    fireEvent.change(inputNome, { target: { value: 'Regional Duplicada' } })

    fireEvent.click(screen.getByText('Salvar Regional'))

    expect(await screen.findByText('Código regional já cadastrado')).toBeInTheDocument()
  })
})
