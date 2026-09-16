import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SetoresView } from '../components/setores/SetoresView'
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

describe('S01 — SetoresView (Gestão Territorial Frontend)', () => {
  const ADM_1_ID = '11111111-1111-4111-8111-111111111111'
  const ADM_2_ID = '22222222-2222-4222-8222-222222222222'
  const SET_1_ID = '33333333-3333-4333-8333-333333333333'
  const SET_2_ID = '44444444-4444-4444-8444-444444444444'

  const mockAdministracoes = [
    { id: ADM_1_ID, regionalId: 'reg-1', nome: 'Administração Osasco', codigo: 'ADM-OSC', ativo: true },
    { id: ADM_2_ID, regionalId: 'reg-2', nome: 'Administração Jundiaí', codigo: 'ADM-JND', ativo: true }
  ]

  const mockSetores = [
    { id: SET_1_ID, administracaoId: ADM_1_ID, nome: 'Setor 01 — Osasco Centro', codigo: 'SET-01', ativo: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: SET_2_ID, administracaoId: ADM_2_ID, nome: 'Setor 02 — Jundiaí Sul', codigo: 'SET-02', ativo: false, createdAt: '2026-01-02T00:00:00.000Z' }
  ]

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('1. Listar: deve carregar e exibir lista de setores com o nome da administração associada', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/setores') return mockSetores
      if (endpoint === '/administracoes') return mockAdministracoes
      throw new Error('Not found')
    })

    render(<SetoresView />)

    expect(screen.getByText('Gestão Territorial — Setores')).toBeInTheDocument()
    expect(await screen.findByText('Setor 01 — Osasco Centro')).toBeInTheDocument()
    expect(screen.getByText('Setor 02 — Jundiaí Sul')).toBeInTheDocument()
    expect(screen.getByText('Administração Osasco')).toBeInTheDocument()
    expect(screen.getByText('Administração Jundiaí')).toBeInTheDocument()
    expect(screen.getByText('SET-01')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('Inativo')).toBeInTheDocument()
  })

  it('2. Filtrar: deve filtrar setores por administração no cliente', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/setores') return mockSetores
      if (endpoint === '/administracoes') return mockAdministracoes
      throw new Error('Not found')
    })

    render(<SetoresView />)

    await screen.findByText('Setor 01 — Osasco Centro')
    expect(screen.getByText('Setor 02 — Jundiaí Sul')).toBeInTheDocument()

    const selectFiltro = screen.getByLabelText(/Filtrar por Administração/i)
    fireEvent.change(selectFiltro, { target: { value: ADM_1_ID } })

    expect(screen.getByText('Setor 01 — Osasco Centro')).toBeInTheDocument()
    expect(screen.queryByText('Setor 02 — Jundiaí Sul')).not.toBeInTheDocument()
    expect(screen.getByText('Exibindo 1 de 2 setores')).toBeInTheDocument()
  })

  it('3. Vazio: deve exibir estado vazio ao carregar lista sem registros', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/setores') return []
      if (endpoint === '/administracoes') return mockAdministracoes
      throw new Error('Not found')
    })

    render(<SetoresView />)

    expect(await screen.findByText('Nenhum setor cadastrado até o momento.')).toBeInTheDocument()
  })

  it('4. Erro na listagem: deve exibir mensagem de erro se busca de dados falhar', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockRejectedValue(new Error('Erro de conexão com a API'))

    render(<SetoresView />)

    expect(await screen.findByText('Erro de conexão com a API')).toBeInTheDocument()
  })

  it('5. Detalhar: deve carregar e exibir os detalhes do setor ao clicar em Detalhes', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/setores') return mockSetores
      if (endpoint === '/administracoes') return mockAdministracoes
      if (endpoint === `/setores/${SET_1_ID}`) return mockSetores[0]
      throw new Error('Not found')
    })

    render(<SetoresView />)

    const btnsDetalhes = await screen.findAllByText('Detalhes')
    fireEvent.click(btnsDetalhes[0])

    expect(await screen.findByRole('heading', { name: 'Detalhes do Setor' })).toBeInTheDocument()
    expect(screen.getAllByText('Setor 01 — Osasco Centro').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('SET-01').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(SET_1_ID)).toBeInTheDocument()
  })

  it('6. Criar: deve cadastrar um novo setor selecionando administração válida (UUID)', async () => {
    const NEW_SET_ID = '55555555-5555-5555-8555-555555555555'
    const novoSetor = { id: NEW_SET_ID, administracaoId: ADM_1_ID, nome: 'Setor 03 — Rochdale', codigo: 'SET-03', ativo: true }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/setores') return []
      if (endpoint === '/administracoes') return mockAdministracoes
      throw new Error('Not found')
    })
    vi.mocked(apiClient.postWithAuth).mockResolvedValue(novoSetor)

    render(<SetoresView />)

    await screen.findByText('Nenhum setor cadastrado até o momento.')

    const btnNovo = screen.getByText('+ Novo Setor')
    fireEvent.click(btnNovo)

    expect(screen.getByText('Cadastrar Novo Setor')).toBeInTheDocument()

    const selectAdm = screen.getByLabelText(/^Administração \*/i)
    const inputNome = screen.getByLabelText(/Nome do Setor/i)
    const inputCodigo = screen.getByLabelText(/Código/i)

    fireEvent.change(selectAdm, { target: { value: ADM_1_ID } })
    fireEvent.change(inputNome, { target: { value: 'Setor 03 — Rochdale' } })
    fireEvent.change(inputCodigo, { target: { value: 'SET-03' } })

    const btnSalvar = screen.getByText('Salvar Setor')
    fireEvent.click(btnSalvar)

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith('/setores', {
        administracaoId: ADM_1_ID,
        nome: 'Setor 03 — Rochdale',
        codigo: 'SET-03',
        ativo: true
      })
    })

    expect(await screen.findByText('Setor criado com sucesso!')).toBeInTheDocument()
  })

  it('7. Criar com validação Zod: falha se administracaoId não for UUID ou nome < 2 caracteres', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/setores') return []
      if (endpoint === '/administracoes') return mockAdministracoes
      throw new Error('Not found')
    })

    render(<SetoresView />)

    await screen.findByText('Nenhum setor cadastrado até o momento.')

    fireEvent.click(screen.getByText('+ Novo Setor'))

    const selectAdm = screen.getByLabelText(/^Administração \*/i)
    fireEvent.change(selectAdm, { target: { value: '' } }) // id inválido/vazio

    const inputNome = screen.getByLabelText(/Nome do Setor/i)
    fireEvent.change(inputNome, { target: { value: 'A' } }) // nome < 2 chars

    fireEvent.click(screen.getByText('Salvar Setor'))

    expect(await screen.findByText('administracaoId deve ser um UUID válido')).toBeInTheDocument()
    expect(screen.getByText('Nome deve ter no mínimo 2 caracteres')).toBeInTheDocument()
    expect(apiClient.postWithAuth).not.toHaveBeenCalled()
  })

  it('8. Editar: deve carregar dados do setor e atualizar via PATCH', async () => {
    const setorAntigo = mockSetores[0]
    const setorAtualizado = { ...setorAntigo, nome: 'Setor 01 — Osasco Norte', codigo: 'SET-01-NTE', ativo: false }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/setores') return [setorAntigo]
      if (endpoint === '/administracoes') return mockAdministracoes
      if (endpoint === `/setores/${SET_1_ID}`) return setorAntigo
      throw new Error('Not found')
    })
    vi.mocked(apiClient.patchWithAuth).mockResolvedValue(setorAtualizado)

    render(<SetoresView />)

    const btnsEditar = await screen.findAllByText('Editar')
    fireEvent.click(btnsEditar[0])

    expect(await screen.findByText('Editar Setor')).toBeInTheDocument()

    const inputNome = screen.getByLabelText(/Nome do Setor/i)
    const inputCodigo = screen.getByLabelText(/Código/i)
    const inputAtivo = screen.getByLabelText(/Setor Ativo/i)

    await waitFor(() => {
      expect((inputNome as HTMLInputElement).value).toBe('Setor 01 — Osasco Centro')
    })

    fireEvent.change(inputNome, { target: { value: 'Setor 01 — Osasco Norte' } })
    fireEvent.change(inputCodigo, { target: { value: 'SET-01-NTE' } })
    fireEvent.click(inputAtivo) // inativar (ativo = false)

    fireEvent.click(screen.getByText('Atualizar Setor'))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(`/setores/${SET_1_ID}`, {
        administracaoId: ADM_1_ID,
        nome: 'Setor 01 — Osasco Norte',
        codigo: 'SET-01-NTE',
        ativo: false
      })
    })

    expect(await screen.findByText('Setor atualizado com sucesso!')).toBeInTheDocument()
  })

  it('9. Erro do servidor ao criar/editar: exibe mensagem da API', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/setores') return []
      if (endpoint === '/administracoes') return mockAdministracoes
      throw new Error('Not found')
    })
    vi.mocked(apiClient.postWithAuth).mockRejectedValue(
      new apiClient.ApiError(400, 'Administração vinculada não existe', { error: 'Administração vinculada não existe' })
    )

    render(<SetoresView />)

    await screen.findByText('Nenhum setor cadastrado até o momento.')

    fireEvent.click(screen.getByText('+ Novo Setor'))

    const selectAdm = screen.getByLabelText(/^Administração \*/i)
    const inputNome = screen.getByLabelText(/Nome do Setor/i)

    fireEvent.change(selectAdm, { target: { value: ADM_1_ID } })
    fireEvent.change(inputNome, { target: { value: 'Setor Teste' } })

    fireEvent.click(screen.getByText('Salvar Setor'))

    expect(await screen.findByText('Administração vinculada não existe')).toBeInTheDocument()
  })
})
