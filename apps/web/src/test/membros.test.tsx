import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MembrosView } from '../components/membros/MembrosView'
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

describe('S02-A — MembrosView (Diretório de Membros Frontend)', () => {
  const CASA_1_ID = '33333333-3333-4333-8333-333333333333'
  const CASA_2_ID = '44444444-4444-4444-8444-444444444444'
  const MEMBRO_1_ID = '55555555-5555-4555-8555-555555555555'
  const MEMBRO_2_ID = '66666666-6666-4666-8666-666666666666'

  const mockCasas = [
    { id: CASA_1_ID, setorId: 'set-1', nome: 'Central de Osasco', codigo: 'C-OSC-01', ativo: true },
    { id: CASA_2_ID, setorId: 'set-2', nome: 'Jardim Samambaia', codigo: 'C-JND-02', ativo: true }
  ]

  const mockMembros = [
    { 
      id: MEMBRO_1_ID, 
      casaId: CASA_1_ID, 
      nome: 'João da Silva', 
      dataNascimento: '1990-05-10T00:00:00.000Z',
      celular: '11988887777',
      ativo: true, 
      createdAt: '2026-01-01T00:00:00.000Z' 
    },
    { 
      id: MEMBRO_2_ID, 
      casaId: CASA_2_ID, 
      nome: 'Maria Souza', 
      dataNascimento: null,
      celular: null,
      ativo: false, 
      createdAt: '2026-01-02T00:00:00.000Z' 
    }
  ]

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('1. Listar: deve carregar e exibir lista de membros com o nome da casa de oração associada', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/membros') return mockMembros
      if (endpoint === '/casas') return mockCasas
      throw new Error('Not found')
    })

    render(<MembrosView />)

    expect(screen.getByText('Diretório de Membros')).toBeInTheDocument()
    expect(await screen.findByText('João da Silva')).toBeInTheDocument()
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()
    expect(screen.getByText('Central de Osasco')).toBeInTheDocument()
    expect(screen.getByText('Jardim Samambaia')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('Inativo')).toBeInTheDocument()
  })

  it('2. Filtrar: deve filtrar membros por casa de oração no cliente', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/membros') return mockMembros
      if (endpoint === '/casas') return mockCasas
      throw new Error('Not found')
    })

    render(<MembrosView />)

    await screen.findByText('João da Silva')
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()

    const selectFiltro = screen.getByLabelText(/Filtrar por Casa/i)
    fireEvent.change(selectFiltro, { target: { value: CASA_1_ID } })

    expect(screen.getByText('João da Silva')).toBeInTheDocument()
    expect(screen.queryByText('Maria Souza')).not.toBeInTheDocument()
    expect(screen.getByText('Exibindo 1 de 2 membros')).toBeInTheDocument()
  })

  it('3. Vazio: deve exibir estado vazio ao carregar lista sem registros', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/membros') return []
      if (endpoint === '/casas') return mockCasas
      throw new Error('Not found')
    })

    render(<MembrosView />)

    expect(await screen.findByText('Nenhum membro cadastrado até o momento.')).toBeInTheDocument()
  })

  it('4. Detalhar: deve carregar e exibir os detalhes do membro ao clicar em Detalhes', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/membros') return mockMembros
      if (endpoint === '/casas') return mockCasas
      if (endpoint === `/membros/${MEMBRO_1_ID}`) return mockMembros[0]
      throw new Error('Not found')
    })

    render(<MembrosView />)

    const btnsDetalhes = await screen.findAllByText('Detalhes')
    fireEvent.click(btnsDetalhes[0])

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()

    const { getByText } = within(dialog)
    expect(getByText('Detalhes do Membro')).toBeInTheDocument()
    expect(getByText('João da Silva')).toBeInTheDocument()
    expect(getByText('Central de Osasco')).toBeInTheDocument()
    expect(getByText('11988887777')).toBeInTheDocument()
    expect(getByText(MEMBRO_1_ID)).toBeInTheDocument()
  })

  it('5. Criar: deve cadastrar um novo membro', async () => {
    const NEW_MEMBRO_ID = '77777777-7777-7777-8777-777777777777'
    const novoMembro = { id: NEW_MEMBRO_ID, casaId: CASA_1_ID, nome: 'Pedro Henrique', dataNascimento: null, celular: null, ativo: true }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/membros') return []
      if (endpoint === '/casas') return mockCasas
      throw new Error('Not found')
    })
    vi.mocked(apiClient.postWithAuth).mockResolvedValue(novoMembro)

    render(<MembrosView />)

    await screen.findByText('Nenhum membro cadastrado até o momento.')

    const btnNovo = screen.getByText('+ Novo Membro')
    fireEvent.click(btnNovo)

    expect(screen.getByText('Cadastrar Novo Membro')).toBeInTheDocument()

    const selectCasa = screen.getByLabelText(/^Casa de Oração \*/i)
    const inputNome = screen.getByLabelText(/Nome Completo \*/i)

    fireEvent.change(selectCasa, { target: { value: CASA_1_ID } })
    fireEvent.change(inputNome, { target: { value: 'Pedro Henrique' } })

    const btnSalvar = screen.getByText('Salvar Membro')
    fireEvent.click(btnSalvar)

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith('/membros', {
        casaId: CASA_1_ID,
        nome: 'Pedro Henrique',
        dataNascimento: null,
        celular: null,
        ativo: true
      })
    })

    expect(await screen.findByText('Membro criado com sucesso!')).toBeInTheDocument()
  })

  it('6. Criar com validação Zod: falha se nome < 3 caracteres ou celular inválido', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/membros') return []
      if (endpoint === '/casas') return mockCasas
      throw new Error('Not found')
    })

    render(<MembrosView />)
    await screen.findByText('Nenhum membro cadastrado até o momento.')

    fireEvent.click(screen.getByText('+ Novo Membro'))

    const selectCasa = screen.getByLabelText(/^Casa de Oração \*/i)
    fireEvent.change(selectCasa, { target: { value: CASA_1_ID } })

    const inputNome = screen.getByLabelText(/Nome Completo \*/i)
    fireEvent.change(inputNome, { target: { value: 'Oi' } }) // < 3 chars

    const inputCelular = screen.getByLabelText(/Celular/i)
    fireEvent.change(inputCelular, { target: { value: '119' } }) // celular inválido

    fireEvent.click(screen.getByText('Salvar Membro'))

    expect(await screen.findByText('Nome deve ter no mínimo 3 caracteres')).toBeInTheDocument()
    expect(screen.getByText('Formato de celular inválido (ex: 11999999999)')).toBeInTheDocument()
    expect(apiClient.postWithAuth).not.toHaveBeenCalled()
  })

  it('7. Editar: deve carregar dados do membro e atualizar', async () => {
    const membroAntigo = mockMembros[0]
    const membroAtualizado = { ...membroAntigo, nome: 'João da Silva Silva', ativo: false }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/membros') return [membroAntigo]
      if (endpoint === '/casas') return mockCasas
      if (endpoint === `/membros/${MEMBRO_1_ID}`) return membroAntigo
      throw new Error('Not found')
    })
    vi.mocked(apiClient.patchWithAuth).mockResolvedValue(membroAtualizado)

    render(<MembrosView />)

    const btnsEditar = await screen.findAllByText('Editar')
    fireEvent.click(btnsEditar[0])

    expect(await screen.findByText('Editar Membro')).toBeInTheDocument()

    const inputNome = screen.getByLabelText(/Nome Completo \*/i)
    const inputAtivo = screen.getByLabelText(/Membro Ativo/i)

    await waitFor(() => {
      expect((inputNome as HTMLInputElement).value).toBe('João da Silva')
    })

    fireEvent.change(inputNome, { target: { value: 'João da Silva Silva' } })
    fireEvent.click(inputAtivo) // inativar

    fireEvent.click(screen.getByText('Atualizar Membro'))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(`/membros/${MEMBRO_1_ID}`, {
        casaId: CASA_1_ID,
        nome: 'João da Silva Silva',
        dataNascimento: '1990-05-10',
        celular: '11988887777',
        ativo: false
      })
    })

    expect(await screen.findByText('Membro atualizado com sucesso!')).toBeInTheDocument()
  })
})
