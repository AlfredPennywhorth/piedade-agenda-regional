import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GruposTrabalhoView } from '../components/grupos-trabalho/GruposTrabalhoView'
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

describe('S01 — GruposTrabalhoView (Gestão de Grupos de Trabalho)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('1. Listar: deve carregar e exibir lista de grupos de trabalho', async () => {
    const mockGrupos = [
      { id: 'gt-1', nome: 'Jovens - Regional', ativo: true, regionalId: 'reg-1', administracaoId: null, setorId: null },
      { id: 'gt-2', nome: 'Casais - Setor', ativo: false, regionalId: null, administracaoId: null, setorId: 'set-1' }
    ]

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url: string) => {
      if (url === '/grupos-trabalho') return mockGrupos
      if (url === '/regionais') return [{ id: 'reg-1', nome: 'Regional Sul' }]
      if (url === '/administracoes') return []
      if (url === '/setores') return [{ id: 'set-1', nome: 'Setor A' }]
      return []
    })

    render(<GruposTrabalhoView />)

    expect(screen.getByText('Gestão de Grupos de Trabalho')).toBeInTheDocument()
    expect(await screen.findByText('Jovens - Regional')).toBeInTheDocument()
    expect(screen.getByText('Casais - Setor')).toBeInTheDocument()
    expect(screen.getByText('Regional: Regional Sul')).toBeInTheDocument()
    expect(screen.getByText('Setor: Setor A')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('Inativo')).toBeInTheDocument()
  })

  it('2. Vazio: deve exibir estado vazio quando a lista estiver vazia', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue([])

    render(<GruposTrabalhoView />)

    expect(await screen.findByText('Nenhum grupo de trabalho encontrado.')).toBeInTheDocument()
  })

  it('3. Detalhar: deve exibir detalhes do grupo', async () => {
    const mockGrupo = { id: 'gt-1', nome: 'Coral', ativo: true, regionalId: 'reg-1', administracaoId: null, setorId: null }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url: string) => {
      if (url === '/grupos-trabalho') return [mockGrupo]
      if (url === '/regionais') return [{ id: 'reg-1', nome: 'Reg 1' }]
      if (url === '/administracoes' || url === '/setores') return []
      if (url === '/grupos-trabalho/gt-1') return mockGrupo
      return []
    })

    render(<GruposTrabalhoView />)

    const btnDetalhes = await screen.findByText('Detalhes')
    fireEvent.click(btnDetalhes)

    expect(await screen.findByText('Detalhes do Grupo de Trabalho')).toBeInTheDocument()
    expect(screen.getByText('Coral')).toBeInTheDocument()
  })

  it('4. Criar: deve validar envio e chamar post com sucesso', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url: string) => {
      if (url === '/regionais') return [{ id: 'reg-1', nome: 'Regional SP' }]
      return []
    })
    
    vi.mocked(apiClient.postWithAuth).mockResolvedValue({ id: 'novo', nome: 'Novo', ativo: true, regionalId: 'reg-1' })

    render(<GruposTrabalhoView />)
    await screen.findByText('Nenhum grupo de trabalho encontrado.')

    fireEvent.click(screen.getByText('+ Novo Grupo'))

    fireEvent.change(screen.getByLabelText(/Nome do Grupo/i), { target: { value: 'Novo Grupo' } })
    
    // regional radio is selected by default, so we pick the regional
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'reg-1' } })

    fireEvent.click(screen.getByText('Salvar Grupo'))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith('/grupos-trabalho', {
        nome: 'Novo Grupo',
        ativo: true,
        regionalId: 'reg-1',
        administracaoId: null,
        setorId: null
      })
    })

    expect(await screen.findByText('Grupo de Trabalho criado com sucesso!')).toBeInTheDocument()
  })
})
