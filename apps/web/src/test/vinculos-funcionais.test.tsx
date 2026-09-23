import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VinculosFuncionaisView } from '../components/vinculos-funcionais/VinculosFuncionaisView'
import * as apiClient from '../api/apiClient'
import { ApiError } from '../api/apiClient'

vi.mock('../api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/apiClient')>()
  return {
    ...actual,
    fetchWithAuth: vi.fn(),
    postWithAuth: vi.fn(),
    patchWithAuth: vi.fn(),
  }
})

describe('S02-B2 — VinculosFuncionaisView (Frontend)', () => {
  const MEMBRO_ID = '11111111-1111-4111-8111-111111111111'
  const FUNCAO_ID = '22222222-2222-4222-8222-222222222222'
  const REGIONAL_ID = '33333333-3333-4333-8333-333333333333'
  const SETOR_ID = '44444444-4444-4444-8444-444444444444'
  const VINCULO_ID = '55555555-5555-4555-8555-555555555555'

  const mockVinculo = {
    id: VINCULO_ID,
    membroId: MEMBRO_ID,
    funcaoId: FUNCAO_ID,
    ativo: true,
    regionalId: REGIONAL_ID,
    administracaoId: null,
    setorId: null,
    casaId: null,
    grupoTrabalhoId: null
  }

  const mockMembros = [{ id: MEMBRO_ID, nome: 'João da Silva' }]
  const mockFuncoes = [{ id: FUNCAO_ID, nome: 'Ancião', ativo: true }]
  const mockRegionais = [{ id: REGIONAL_ID, nome: 'Regional Leste' }]
  const mockSetores = [{ id: SETOR_ID, nome: 'Setor 1' }]

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/membros') return mockMembros
      if (endpoint === '/funcoes') return mockFuncoes
      if (endpoint === '/regionais') return mockRegionais
      if (endpoint === '/administracoes') return []
      if (endpoint === '/setores') return mockSetores
      if (endpoint === '/casas') return []
      if (endpoint === '/grupos-trabalho') return []
      if (endpoint === '/vinculos-funcionais') return [mockVinculo]
      if (endpoint === `/vinculos-funcionais/${VINCULO_ID}`) return mockVinculo
      throw new Error('Not found')
    })
  })

  it('1. Listar: deve resolver nomes pelos lookups quando a API retorna apenas IDs', async () => {
    render(<VinculosFuncionaisView />)
    
    expect(await screen.findByText('João da Silva')).toBeInTheDocument()
    expect(screen.getByText('Ancião')).toBeInTheDocument()
    expect(screen.getByText('Regional: Regional Leste')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
  })

  it('2. Criar com exatamente um escopo e limpar estado incompatível ao trocar', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/membros') return mockMembros
      if (endpoint === '/funcoes') return mockFuncoes
      if (endpoint === '/regionais') return mockRegionais
      if (endpoint === '/administracoes') return []
      if (endpoint === '/setores') return mockSetores
      if (endpoint === '/casas') return []
      if (endpoint === '/grupos-trabalho') return []
      if (endpoint === '/vinculos-funcionais') return [] // Lista inicial vazia
      throw new Error('Not found')
    })

    vi.mocked(apiClient.postWithAuth).mockResolvedValue({ id: 'novo' })

    render(<VinculosFuncionaisView />)
    
    await screen.findByText('Nenhum vínculo funcional cadastrado até o momento.')

    fireEvent.click(screen.getByText('+ Novo Vínculo'))
    expect(screen.getByText('Cadastrar Novo Vínculo')).toBeInTheDocument()

    // Selecionar membro e função
    fireEvent.change(screen.getByLabelText(/Membro \*/i), { target: { value: MEMBRO_ID } })
    fireEvent.change(screen.getByLabelText(/Função \*/i), { target: { value: FUNCAO_ID } })

    // Escolher Regional
    fireEvent.click(screen.getByLabelText(/Regional/i))
    // O select de regional deve aparecer
    const selectRegional = await screen.findByLabelText(/Regional Selecionada/i)
    fireEvent.change(selectRegional, { target: { value: REGIONAL_ID } })

    // Trocar para Setor (deve limpar o escopoId e ocultar o select da Regional)
    fireEvent.click(screen.getByLabelText(/Setor/i))
    const selectSetor = await screen.findByLabelText(/Setor Selecionado/i)
    
    // Agora selecionamos o setor
    fireEvent.change(selectSetor, { target: { value: SETOR_ID } })

    // Salvar
    fireEvent.click(screen.getByText('Salvar Vínculo'))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith('/vinculos-funcionais', {
        membroId: MEMBRO_ID,
        funcaoId: FUNCAO_ID,
        ativo: true,
        regionalId: null,
        administracaoId: null,
        setorId: SETOR_ID, // Exatamente 1 escopo
        casaId: null,
        grupoTrabalhoId: null
      })
    })

    expect(await screen.findByText('Vínculo Funcional criado com sucesso!')).toBeInTheDocument()
  })

  it('3. Validação: rejeição de nenhum escopo (exibição de erro Zod/Form)', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/membros') return mockMembros
      if (endpoint === '/funcoes') return mockFuncoes
      if (endpoint === '/regionais') return []
      if (endpoint === '/administracoes') return []
      if (endpoint === '/setores') return []
      if (endpoint === '/casas') return []
      if (endpoint === '/grupos-trabalho') return []
      if (endpoint === '/vinculos-funcionais') return []
      throw new Error('Not found')
    })

    render(<VinculosFuncionaisView />)
    await screen.findByText('Nenhum vínculo funcional cadastrado até o momento.')

    fireEvent.click(screen.getByText('+ Novo Vínculo'))

    // Selecionar membro e função mas NÃO ESCOLHER ESCOPO (tipoEscopo ou escopoId vazio)
    fireEvent.change(screen.getByLabelText(/Membro \*/i), { target: { value: MEMBRO_ID } })
    fireEvent.change(screen.getByLabelText(/Função \*/i), { target: { value: FUNCAO_ID } })

    fireEvent.click(screen.getByText('Salvar Vínculo'))

    expect(await screen.findByText('Selecione um escopo territorial/institucional válido.')).toBeInTheDocument()
    expect(apiClient.postWithAuth).not.toHaveBeenCalled()
  })

  it('4. Edição: carregar e modificar o vínculo', async () => {
    vi.mocked(apiClient.patchWithAuth).mockResolvedValue({ id: VINCULO_ID })

    render(<VinculosFuncionaisView />)
    
    // Aguardar o carregamento da lista
    const btnsEditar = await screen.findAllByText('Editar')
    fireEvent.click(btnsEditar[0])

    expect(await screen.findByText('Editar Vínculo')).toBeInTheDocument()

    // O rádio de Regional deve estar marcado por causa do mockVinculo.regionalId
    const radioRegional = screen.getByLabelText(/Regional/i, { selector: 'input[type="radio"]' }) as HTMLInputElement
    await waitFor(() => {
      expect(radioRegional.checked).toBe(true)
    })

    // Alterar o escopo para um Setor
    fireEvent.click(screen.getByLabelText(/Setor/i, { selector: 'input[type="radio"]' }))
    const selectSetor = await screen.findByLabelText(/Setor Selecionado/i)
    fireEvent.change(selectSetor, { target: { value: SETOR_ID } })

    // Salvar alteração
    fireEvent.click(screen.getByText('Atualizar Vínculo'))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(`/vinculos-funcionais/${VINCULO_ID}`, {
        membroId: MEMBRO_ID,
        funcaoId: FUNCAO_ID,
        ativo: true,
        regionalId: null, // Limpou
        administracaoId: null,
        setorId: SETOR_ID, // Novo
        casaId: null,
        grupoTrabalhoId: null
      })
    })

    expect(await screen.findByText('Vínculo Funcional atualizado com sucesso!')).toBeInTheDocument()
  })

  it('5. Erro: exibir erro de API ao tentar criar vínculo duplicado', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/membros') return mockMembros
      if (endpoint === '/funcoes') return mockFuncoes
      if (endpoint === '/regionais') return mockRegionais
      if (endpoint === '/administracoes') return []
      if (endpoint === '/setores') return []
      if (endpoint === '/casas') return []
      if (endpoint === '/grupos-trabalho') return []
      if (endpoint === '/vinculos-funcionais') return []
      throw new Error('Not found')
    })

    vi.mocked(apiClient.postWithAuth).mockRejectedValue(new ApiError(400, 'Bad Request', {
      error: 'Este vínculo já existe e está ativo neste escopo'
    }))

    render(<VinculosFuncionaisView />)
    await screen.findByText('Nenhum vínculo funcional cadastrado até o momento.')

    fireEvent.click(screen.getByText('+ Novo Vínculo'))

    fireEvent.change(screen.getByLabelText(/Membro \*/i), { target: { value: MEMBRO_ID } })
    fireEvent.change(screen.getByLabelText(/Função \*/i), { target: { value: FUNCAO_ID } })
    
    fireEvent.click(screen.getByLabelText(/Regional/i))
    const selectRegional = await screen.findByLabelText(/Regional Selecionada/i)
    fireEvent.change(selectRegional, { target: { value: REGIONAL_ID } })

    fireEvent.click(screen.getByText('Salvar Vínculo'))

    // Deve exibir o erro de duplicação da API
    expect(await screen.findByText('Este vínculo já existe e está ativo neste escopo')).toBeInTheDocument()
  })
})
