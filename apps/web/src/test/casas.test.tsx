import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CasasView } from '../components/casas/CasasView'
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

describe('S01 — CasasView (Gestão Territorial Frontend)', () => {
  const SET_1_ID = '11111111-1111-4111-8111-111111111111'
  const SET_2_ID = '22222222-2222-4222-8222-222222222222'
  const CASA_1_ID = '33333333-3333-4333-8333-333333333333'
  const CASA_2_ID = '44444444-4444-4444-8444-444444444444'

  const mockSetores = [
    { id: SET_1_ID, administracaoId: 'adm-1', nome: 'Setor 01 — Osasco Centro', codigo: 'SET-01', ativo: true },
    { id: SET_2_ID, administracaoId: 'adm-2', nome: 'Setor 02 — Jundiaí Sul', codigo: 'SET-02', ativo: true }
  ]

  const mockCasas = [
    { id: CASA_1_ID, setorId: SET_1_ID, nome: 'Central de Osasco', codigo: 'C-OSC-01', ativo: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: CASA_2_ID, setorId: SET_2_ID, nome: 'Jardim Samambaia', codigo: 'C-JND-02', ativo: false, createdAt: '2026-01-02T00:00:00.000Z' }
  ]

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('1. Listar: deve carregar e exibir lista de casas de oração com o nome do setor associado', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/casas') return mockCasas
      if (endpoint === '/setores') return mockSetores
      throw new Error('Not found')
    })

    render(<CasasView />)

    expect(screen.getByText('Gestão Territorial — Casas de Oração')).toBeInTheDocument()
    expect(await screen.findByText('Central de Osasco')).toBeInTheDocument()
    expect(screen.getByText('Jardim Samambaia')).toBeInTheDocument()
    expect(screen.getByText('Setor 01 — Osasco Centro')).toBeInTheDocument()
    expect(screen.getByText('Setor 02 — Jundiaí Sul')).toBeInTheDocument()
    expect(screen.getByText('C-OSC-01')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('Inativo')).toBeInTheDocument()
  })

  it('2. Filtrar: deve filtrar casas de oração por setor no cliente', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/casas') return mockCasas
      if (endpoint === '/setores') return mockSetores
      throw new Error('Not found')
    })

    render(<CasasView />)

    await screen.findByText('Central de Osasco')
    expect(screen.getByText('Jardim Samambaia')).toBeInTheDocument()

    const selectFiltro = screen.getByLabelText(/Filtrar por Setor/i)
    fireEvent.change(selectFiltro, { target: { value: SET_1_ID } })

    expect(screen.getByText('Central de Osasco')).toBeInTheDocument()
    expect(screen.queryByText('Jardim Samambaia')).not.toBeInTheDocument()
    expect(screen.getByText('Exibindo 1 de 2 casas de oração')).toBeInTheDocument()
  })

  it('3. Vazio: deve exibir estado vazio ao carregar lista sem registros', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/casas') return []
      if (endpoint === '/setores') return mockSetores
      throw new Error('Not found')
    })

    render(<CasasView />)

    expect(await screen.findByText('Nenhuma casa de oração cadastrada até o momento.')).toBeInTheDocument()
  })

  it('4. Erro na listagem: deve exibir mensagem de erro se busca de dados falhar', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockRejectedValue(new Error('Erro de conexão com o banco de dados'))

    render(<CasasView />)

    expect(await screen.findByText('Erro de conexão com o banco de dados')).toBeInTheDocument()
  })

  it('5. Detalhar: deve carregar e exibir os detalhes da casa de oração ao clicar em Detalhes', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/casas') return mockCasas
      if (endpoint === '/setores') return mockSetores
      if (endpoint === `/casas/${CASA_1_ID}`) return mockCasas[0]
      throw new Error('Not found')
    })

    render(<CasasView />)

    const btnsDetalhes = await screen.findAllByText('Detalhes')
    fireEvent.click(btnsDetalhes[0])

    expect(await screen.findByRole('heading', { name: 'Detalhes da Casa de Oração' })).toBeInTheDocument()
    expect(screen.getAllByText('Central de Osasco').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('C-OSC-01').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(CASA_1_ID)).toBeInTheDocument()
  })

  it('6. Criar: deve cadastrar uma nova casa de oração selecionando setor válido (UUID)', async () => {
    const NEW_CASA_ID = '55555555-5555-5555-8555-555555555555'
    const novaCasa = { id: NEW_CASA_ID, setorId: SET_1_ID, nome: 'Vila Yara', codigo: 'C-OSC-02', ativo: true }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/casas') return []
      if (endpoint === '/setores') return mockSetores
      throw new Error('Not found')
    })
    vi.mocked(apiClient.postWithAuth).mockResolvedValue(novaCasa)

    render(<CasasView />)

    await screen.findByText('Nenhuma casa de oração cadastrada até o momento.')

    const btnNovo = screen.getByText('+ Nova Casa de Oração')
    fireEvent.click(btnNovo)

    expect(screen.getByText('Cadastrar Nova Casa de Oração')).toBeInTheDocument()

    const selectSetor = screen.getByLabelText(/^Setor \*/i)
    const inputNome = screen.getByLabelText(/Nome da Casa de Oração/i)
    const inputCodigo = screen.getByLabelText(/Código/i)

    fireEvent.change(selectSetor, { target: { value: SET_1_ID } })
    fireEvent.change(inputNome, { target: { value: 'Vila Yara' } })
    fireEvent.change(inputCodigo, { target: { value: 'C-OSC-02' } })

    const btnSalvar = screen.getByText('Salvar Casa de Oração')
    fireEvent.click(btnSalvar)

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith('/casas', {
        setorId: SET_1_ID,
        nome: 'Vila Yara',
        codigo: 'C-OSC-02',
        ativo: true
      })
    })

    expect(await screen.findByText('Casa de oração criada com sucesso!')).toBeInTheDocument()
  })

  it('7. Criar com validação Zod: falha se setorId não for UUID ou nome < 2 caracteres', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/casas') return []
      if (endpoint === '/setores') return mockSetores
      throw new Error('Not found')
    })

    render(<CasasView />)

    await screen.findByText('Nenhuma casa de oração cadastrada até o momento.')

    fireEvent.click(screen.getByText('+ Nova Casa de Oração'))

    const selectSetor = screen.getByLabelText(/^Setor \*/i)
    fireEvent.change(selectSetor, { target: { value: '' } }) // id inválido/vazio

    const inputNome = screen.getByLabelText(/Nome da Casa de Oração/i)
    fireEvent.change(inputNome, { target: { value: 'A' } }) // nome < 2 chars

    fireEvent.click(screen.getByText('Salvar Casa de Oração'))

    expect(await screen.findByText('setorId deve ser um UUID válido')).toBeInTheDocument()
    expect(screen.getByText('Nome deve ter no mínimo 2 caracteres')).toBeInTheDocument()
    expect(apiClient.postWithAuth).not.toHaveBeenCalled()
  })

  it('8. Editar: deve carregar dados da casa de oração e atualizar via PATCH', async () => {
    const casaAntiga = mockCasas[0]
    const casaAtualizada = { ...casaAntiga, nome: 'Central de Osasco — Reformada', codigo: 'C-OSC-01R', ativo: false }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/casas') return [casaAntiga]
      if (endpoint === '/setores') return mockSetores
      if (endpoint === `/casas/${CASA_1_ID}`) return casaAntiga
      throw new Error('Not found')
    })
    vi.mocked(apiClient.patchWithAuth).mockResolvedValue(casaAtualizada)

    render(<CasasView />)

    const btnsEditar = await screen.findAllByText('Editar')
    fireEvent.click(btnsEditar[0])

    expect(await screen.findByText('Editar Casa de Oração')).toBeInTheDocument()

    const inputNome = screen.getByLabelText(/Nome da Casa de Oração/i)
    const inputCodigo = screen.getByLabelText(/Código/i)
    const inputAtivo = screen.getByLabelText(/Casa de Oração Ativa/i)

    await waitFor(() => {
      expect((inputNome as HTMLInputElement).value).toBe('Central de Osasco')
    })

    fireEvent.change(inputNome, { target: { value: 'Central de Osasco — Reformada' } })
    fireEvent.change(inputCodigo, { target: { value: 'C-OSC-01R' } })
    fireEvent.click(inputAtivo) // inativar (ativo = false)

    fireEvent.click(screen.getByText('Atualizar Casa de Oração'))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(`/casas/${CASA_1_ID}`, {
        setorId: SET_1_ID,
        nome: 'Central de Osasco — Reformada',
        codigo: 'C-OSC-01R',
        ativo: false
      })
    })

    expect(await screen.findByText('Casa de oração atualizada com sucesso!')).toBeInTheDocument()
  })

  it('9. Erro do servidor ao criar/editar: exibe mensagem da API', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/casas') return []
      if (endpoint === '/setores') return mockSetores
      throw new Error('Not found')
    })
    vi.mocked(apiClient.postWithAuth).mockRejectedValue(
      new apiClient.ApiError(400, 'Setor vinculado não existe', { error: 'Setor vinculado não existe' })
    )

    render(<CasasView />)

    await screen.findByText('Nenhuma casa de oração cadastrada até o momento.')

    fireEvent.click(screen.getByText('+ Nova Casa de Oração'))

    const selectSetor = screen.getByLabelText(/^Setor \*/i)
    const inputNome = screen.getByLabelText(/Nome da Casa de Oração/i)

    fireEvent.change(selectSetor, { target: { value: SET_1_ID } })
    fireEvent.change(inputNome, { target: { value: 'Casa Teste' } })

    fireEvent.click(screen.getByText('Salvar Casa de Oração'))

    expect(await screen.findByText('Setor vinculado não existe')).toBeInTheDocument()
  })
})
