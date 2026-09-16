import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { FuncoesView } from '../components/funcoes/FuncoesView'
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

describe('S02-B1 — FuncoesView (Catálogo de Funções Frontend)', () => {
  const FUNCAO_1_ID = '11111111-1111-4111-8111-111111111111'
  const FUNCAO_2_ID = '22222222-2222-4222-8222-222222222222'

  const mockFuncoes = [
    { 
      id: FUNCAO_1_ID, 
      nome: 'Ancião', 
      codigo: 'ANC',
      descricao: 'Responsável regional',
      ativo: true, 
      createdAt: '2026-01-01T00:00:00.000Z' 
    },
    { 
      id: FUNCAO_2_ID, 
      nome: 'Cooperador de Jovens e Menores', 
      codigo: 'CJM',
      descricao: null,
      ativo: false, 
      createdAt: '2026-01-02T00:00:00.000Z' 
    }
  ]

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('1. Listar: deve carregar e exibir lista de funções institucionais', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/funcoes') return mockFuncoes
      throw new Error('Not found')
    })

    render(<FuncoesView />)

    expect(screen.getByText('Catálogo de Funções')).toBeInTheDocument()
    expect(await screen.findByText('Ancião')).toBeInTheDocument()
    expect(screen.getByText('Cooperador de Jovens e Menores')).toBeInTheDocument()
    expect(screen.getByText('ANC')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('Inativo')).toBeInTheDocument()
  })

  it('2. Vazio: deve exibir estado vazio ao carregar lista sem registros', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/funcoes') return []
      throw new Error('Not found')
    })

    render(<FuncoesView />)

    expect(await screen.findByText('Nenhuma função cadastrada até o momento.')).toBeInTheDocument()
  })

  it('3. Detalhar: deve carregar e exibir os detalhes da função ao clicar em Detalhes', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/funcoes') return mockFuncoes
      if (endpoint === `/funcoes/${FUNCAO_1_ID}`) return mockFuncoes[0]
      throw new Error('Not found')
    })

    render(<FuncoesView />)

    const btnsDetalhes = await screen.findAllByText('Detalhes')
    fireEvent.click(btnsDetalhes[0])

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()

    const { getByText } = within(dialog)
    expect(getByText('Detalhes da Função')).toBeInTheDocument()
    expect(getByText('Ancião')).toBeInTheDocument()
    expect(getByText('Responsável regional')).toBeInTheDocument()
    expect(getByText(FUNCAO_1_ID)).toBeInTheDocument()
  })

  it('4. Criar: deve cadastrar uma nova função', async () => {
    const NEW_FUNCAO_ID = '77777777-7777-7777-8777-777777777777'
    const novaFuncao = { id: NEW_FUNCAO_ID, nome: 'Encarregado Regional', codigo: 'ENC-REG', descricao: 'Encarregado regional', ativo: true }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/funcoes') return []
      throw new Error('Not found')
    })
    vi.mocked(apiClient.postWithAuth).mockResolvedValue(novaFuncao)

    render(<FuncoesView />)

    await screen.findByText('Nenhuma função cadastrada até o momento.')

    const btnNovo = screen.getByText('+ Nova Função')
    fireEvent.click(btnNovo)

    expect(screen.getByText('Cadastrar Nova Função')).toBeInTheDocument()

    const inputNome = screen.getByLabelText(/Nome da Função \*/i)
    const inputCodigo = screen.getByLabelText(/Código/i)
    const inputDescricao = screen.getByLabelText(/Descrição/i)

    fireEvent.change(inputNome, { target: { value: 'Encarregado Regional' } })
    fireEvent.change(inputCodigo, { target: { value: 'ENC-REG' } })
    fireEvent.change(inputDescricao, { target: { value: 'Encarregado regional' } })

    const btnSalvar = screen.getByText('Salvar Função')
    fireEvent.click(btnSalvar)

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith('/funcoes', {
        nome: 'Encarregado Regional',
        codigo: 'ENC-REG',
        descricao: 'Encarregado regional',
        ativo: true
      })
    })

    expect(await screen.findByText('Função criada com sucesso!')).toBeInTheDocument()
  })

  it('5. Criar com validação Zod: falha se nome < 2 caracteres', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/funcoes') return []
      throw new Error('Not found')
    })

    render(<FuncoesView />)
    await screen.findByText('Nenhuma função cadastrada até o momento.')

    fireEvent.click(screen.getByText('+ Nova Função'))

    const inputNome = screen.getByLabelText(/Nome da Função \*/i)
    fireEvent.change(inputNome, { target: { value: 'A' } }) // < 2 chars

    fireEvent.click(screen.getByText('Salvar Função'))

    expect(await screen.findByText('Nome deve ter no mínimo 2 caracteres')).toBeInTheDocument()
    expect(apiClient.postWithAuth).not.toHaveBeenCalled()
  })

  it('6. Editar: deve carregar dados da função e atualizar', async () => {
    const funcaoAntiga = mockFuncoes[0]
    const funcaoAtualizada = { ...funcaoAntiga, nome: 'Ancião - Editado', ativo: false }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/funcoes') return [funcaoAntiga]
      if (endpoint === `/funcoes/${FUNCAO_1_ID}`) return funcaoAntiga
      throw new Error('Not found')
    })
    vi.mocked(apiClient.patchWithAuth).mockResolvedValue(funcaoAtualizada)

    render(<FuncoesView />)

    const btnsEditar = await screen.findAllByText('Editar')
    fireEvent.click(btnsEditar[0])

    expect(await screen.findByText('Editar Função')).toBeInTheDocument()

    const inputNome = screen.getByLabelText(/Nome da Função \*/i)
    const inputAtivo = screen.getByLabelText(/Função Ativa/i)

    await waitFor(() => {
      expect((inputNome as HTMLInputElement).value).toBe('Ancião')
    })

    fireEvent.change(inputNome, { target: { value: 'Ancião - Editado' } })
    fireEvent.click(inputAtivo) // inativar

    fireEvent.click(screen.getByText('Atualizar Função'))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(`/funcoes/${FUNCAO_1_ID}`, {
        nome: 'Ancião - Editado',
        codigo: 'ANC',
        descricao: 'Responsável regional',
        ativo: false
      })
    })

    expect(await screen.findByText('Função atualizada com sucesso!')).toBeInTheDocument()
  })
})
