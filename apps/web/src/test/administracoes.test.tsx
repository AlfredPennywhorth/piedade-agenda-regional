import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AdministracoesView } from '../components/administracoes/AdministracoesView'
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

describe('S01 — AdministracoesView (Gestão Territorial Frontend)', () => {
  const REG_1_ID = '11111111-1111-4111-8111-111111111111'
  const REG_2_ID = '22222222-2222-4222-8222-222222222222'
  const ADM_1_ID = '33333333-3333-4333-8333-333333333333'
  const ADM_2_ID = '44444444-4444-4444-8444-444444444444'

  const mockRegionais = [
    { id: REG_1_ID, nome: 'Regional São Paulo Leste', codigo: 'SP-ESTE', ativo: true },
    { id: REG_2_ID, nome: 'Regional Campinas', codigo: 'CPS', ativo: true }
  ]

  const mockAdministracoes = [
    { id: ADM_1_ID, regionalId: REG_1_ID, nome: 'Administração Osasco', codigo: 'ADM-OSC', ativo: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: ADM_2_ID, regionalId: REG_2_ID, nome: 'Administração Jundiaí', codigo: 'ADM-JND', ativo: false, createdAt: '2026-01-02T00:00:00.000Z' }
  ]

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('1. Listar: deve carregar e exibir lista de administrações com o nome da regional associada', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/administracoes') return mockAdministracoes
      if (endpoint === '/regionais') return mockRegionais
      throw new Error('Not found')
    })

    render(<AdministracoesView />)

    expect(screen.getByText('Gestão Territorial — Administrações')).toBeInTheDocument()
    expect(await screen.findByText('Administração Osasco')).toBeInTheDocument()
    expect(screen.getByText('Administração Jundiaí')).toBeInTheDocument()
    expect(screen.getByText('Regional São Paulo Leste')).toBeInTheDocument()
    expect(screen.getByText('Regional Campinas')).toBeInTheDocument()
    expect(screen.getByText('ADM-OSC')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('Inativo')).toBeInTheDocument()
  })

  it('2. Filtrar: deve filtrar administrações por regional no cliente', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/administracoes') return mockAdministracoes
      if (endpoint === '/regionais') return mockRegionais
      throw new Error('Not found')
    })

    render(<AdministracoesView />)

    await screen.findByText('Administração Osasco')
    expect(screen.getByText('Administração Jundiaí')).toBeInTheDocument()

    const selectFiltro = screen.getByLabelText(/Filtrar por Regional/i)
    fireEvent.change(selectFiltro, { target: { value: REG_1_ID } })

    expect(screen.getByText('Administração Osasco')).toBeInTheDocument()
    expect(screen.queryByText('Administração Jundiaí')).not.toBeInTheDocument()
    expect(screen.getByText('Exibindo 1 de 2 administrações')).toBeInTheDocument()
  })

  it('3. Vazio: deve exibir estado vazio ao carregar lista sem registros', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/administracoes') return []
      if (endpoint === '/regionais') return mockRegionais
      throw new Error('Not found')
    })

    render(<AdministracoesView />)

    expect(await screen.findByText('Nenhuma administração cadastrada até o momento.')).toBeInTheDocument()
  })

  it('4. Erro na listagem: deve exibir mensagem de erro se busca de dados falhar', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockRejectedValue(new Error('Erro de conexão com o banco'))

    render(<AdministracoesView />)

    expect(await screen.findByText('Erro de conexão com o banco')).toBeInTheDocument()
  })

  it('5. Detalhar: deve carregar e exibir os detalhes da administração ao clicar em Detalhes', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/administracoes') return mockAdministracoes
      if (endpoint === '/regionais') return mockRegionais
      if (endpoint === `/administracoes/${ADM_1_ID}`) return mockAdministracoes[0]
      throw new Error('Not found')
    })

    render(<AdministracoesView />)

    const btnsDetalhes = await screen.findAllByText('Detalhes')
    fireEvent.click(btnsDetalhes[0])

    expect(await screen.findByRole('heading', { name: 'Detalhes da Administração' })).toBeInTheDocument()
    expect(screen.getAllByText('Administração Osasco').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('ADM-OSC').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(ADM_1_ID)).toBeInTheDocument()
  })

  it('6. Criar: deve cadastrar uma nova administração selecionando regional válida (UUID)', async () => {
    const NEW_ADM_ID = '55555555-5555-5555-8555-555555555555'
    const novaAdm = { id: NEW_ADM_ID, regionalId: REG_1_ID, nome: 'Administração Guarulhos', codigo: 'ADM-GRU', ativo: true }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/administracoes') return []
      if (endpoint === '/regionais') return mockRegionais
      throw new Error('Not found')
    })
    vi.mocked(apiClient.postWithAuth).mockResolvedValue(novaAdm)

    render(<AdministracoesView />)

    await screen.findByText('Nenhuma administração cadastrada até o momento.')

    const btnNovo = screen.getByText('+ Nova Administração')
    fireEvent.click(btnNovo)

    expect(screen.getByText('Cadastrar Nova Administração')).toBeInTheDocument()

    const selectRegional = screen.getByLabelText(/^Regional \*/i)
    const inputNome = screen.getByLabelText(/Nome da Administração/i)
    const inputCodigo = screen.getByLabelText(/Código/i)

    fireEvent.change(selectRegional, { target: { value: REG_1_ID } })
    fireEvent.change(inputNome, { target: { value: 'Administração Guarulhos' } })
    fireEvent.change(inputCodigo, { target: { value: 'ADM-GRU' } })

    const btnSalvar = screen.getByText('Salvar Administração')
    fireEvent.click(btnSalvar)

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith('/administracoes', {
        regionalId: REG_1_ID,
        nome: 'Administração Guarulhos',
        codigo: 'ADM-GRU',
        ativo: true
      })
    })

    expect(await screen.findByText('Administração criada com sucesso!')).toBeInTheDocument()
  })

  it('7. Criar com validação Zod: falha se regionalId não for UUID ou nome < 2 caracteres', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/administracoes') return []
      if (endpoint === '/regionais') return mockRegionais
      throw new Error('Not found')
    })

    render(<AdministracoesView />)

    await screen.findByText('Nenhuma administração cadastrada até o momento.')

    fireEvent.click(screen.getByText('+ Nova Administração'))

    const selectRegional = screen.getByLabelText(/^Regional \*/i)
    fireEvent.change(selectRegional, { target: { value: '' } }) // regional id inválido/vazio

    const inputNome = screen.getByLabelText(/Nome da Administração/i)
    fireEvent.change(inputNome, { target: { value: 'X' } }) // nome menor que 2 caracteres

    fireEvent.click(screen.getByText('Salvar Administração'))

    expect(await screen.findByText('regionalId deve ser um UUID válido')).toBeInTheDocument()
    expect(screen.getByText('Nome deve ter no mínimo 2 caracteres')).toBeInTheDocument()
    expect(apiClient.postWithAuth).not.toHaveBeenCalled()
  })

  it('8. Editar: deve carregar dados da administração e atualizar via PATCH', async () => {
    const admAntiga = mockAdministracoes[0]
    const admAtualizada = { ...admAntiga, nome: 'Administração Osasco Centro', codigo: 'ADM-OSC-CTR', ativo: false }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/administracoes') return [admAntiga]
      if (endpoint === '/regionais') return mockRegionais
      if (endpoint === `/administracoes/${ADM_1_ID}`) return admAntiga
      throw new Error('Not found')
    })
    vi.mocked(apiClient.patchWithAuth).mockResolvedValue(admAtualizada)

    render(<AdministracoesView />)

    const btnsEditar = await screen.findAllByText('Editar')
    fireEvent.click(btnsEditar[0])

    expect(await screen.findByText('Editar Administração')).toBeInTheDocument()

    const inputNome = screen.getByLabelText(/Nome da Administração/i)
    const inputCodigo = screen.getByLabelText(/Código/i)
    const inputAtivo = screen.getByLabelText(/Administração Ativa/i)

    await waitFor(() => {
      expect((inputNome as HTMLInputElement).value).toBe('Administração Osasco')
    })

    fireEvent.change(inputNome, { target: { value: 'Administração Osasco Centro' } })
    fireEvent.change(inputCodigo, { target: { value: 'ADM-OSC-CTR' } })
    fireEvent.click(inputAtivo) // inativar (ativo = false)

    fireEvent.click(screen.getByText('Atualizar Administração'))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(`/administracoes/${ADM_1_ID}`, {
        regionalId: REG_1_ID,
        nome: 'Administração Osasco Centro',
        codigo: 'ADM-OSC-CTR',
        ativo: false
      })
    })

    expect(await screen.findByText('Administração atualizada com sucesso!')).toBeInTheDocument()
  })

  it('9. Erro do servidor ao criar/editar: exibe mensagem da API', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/administracoes') return []
      if (endpoint === '/regionais') return mockRegionais
      throw new Error('Not found')
    })
    vi.mocked(apiClient.postWithAuth).mockRejectedValue(
      new apiClient.ApiError(400, 'Regional vinculada não existe', { error: 'Regional vinculada não existe' })
    )

    render(<AdministracoesView />)

    await screen.findByText('Nenhuma administração cadastrada até o momento.')

    fireEvent.click(screen.getByText('+ Nova Administração'))

    const selectRegional = screen.getByLabelText(/^Regional \*/i)
    const inputNome = screen.getByLabelText(/Nome da Administração/i)

    fireEvent.change(selectRegional, { target: { value: REG_1_ID } })
    fireEvent.change(inputNome, { target: { value: 'Administração Teste' } })

    fireEvent.click(screen.getByText('Salvar Administração'))

    expect(await screen.findByText('Regional vinculada não existe')).toBeInTheDocument()
  })
})
