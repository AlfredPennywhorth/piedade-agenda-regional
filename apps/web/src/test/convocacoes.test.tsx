import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConvocacoesView } from '../components/convocacoes/ConvocacoesView'
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

const EVENTO_ID = '33333333-3333-3333-3333-333333333333'
const CONVOCACAO_ID = '44444444-4444-4444-4444-444444444444'

const mockEventos = [
  {
    id: EVENTO_ID,
    titulo: 'Reunião Presencial Teste',
    descricao: null,
    pauta: null,
    modalidade: 'PRESENCIAL',
    inicioEm: '2026-10-10T10:00:00.000Z',
    fimEm: '2026-10-10T12:00:00.000Z',
    localId: null,
    urlOnline: null,
    organizadorMembroId: null,
    regionalId: null,
    administracaoId: null,
    setorId: null,
    casaId: null,
    grupoTrabalhoId: null,
    observacoes: null,
    ativo: true,
  }
]

const mockConvocacoes = [
  {
    id: CONVOCACAO_ID,
    eventoId: EVENTO_ID,
    status: 'RASCUNHO',
    observacoes: 'Minha observação rascunho',
    ativo: true,
    createdAt: '2026-09-17T10:00:00.000Z',
    updatedAt: '2026-09-17T10:00:00.000Z'
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    eventoId: EVENTO_ID,
    status: 'PUBLICADA',
    observacoes: 'Convocação publicada',
    ativo: true,
    createdAt: '2026-09-16T10:00:00.000Z',
    updatedAt: '2026-09-16T10:00:00.000Z'
  }
]

describe('ConvocacoesView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/eventos') return mockEventos
      if (url === '/convocacoes') return mockConvocacoes
      return []
    })
  })

  it('deve listar convocações corretamente', async () => {
    render(<ConvocacoesView />)
    expect(screen.getByText('Gerencie os rascunhos de convocações')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.getAllByText('Reunião Presencial Teste').length).toBeGreaterThan(0)
      expect(screen.getByText('Minha observação rascunho')).toBeInTheDocument()
      expect(screen.getByText('Convocação publicada')).toBeInTheDocument()
    })
  })

  it('deve exibir empty state quando não houver convocações', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
      if (url === '/convocacoes') return []
      if (url === '/eventos') return mockEventos
      return []
    })

    render(<ConvocacoesView />)

    await waitFor(() => {
      expect(screen.getByText('Nenhuma convocação encontrada.')).toBeInTheDocument()
    })
  })

  it('deve permitir criar um rascunho', async () => {
    render(<ConvocacoesView />)

    await waitFor(() => {
      expect(screen.getByText('Minha observação rascunho')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /novo rascunho/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /nova convocação/i })).toBeInTheDocument()
    })

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: EVENTO_ID } })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Nova obs' } })

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith('/convocacoes', {
        eventoId: EVENTO_ID,
        observacoes: 'Nova obs'
      })
    })
  })

  it('deve permitir editar rascunho', async () => {
    render(<ConvocacoesView />)

    await waitFor(() => {
      expect(screen.getByText('Minha observação rascunho')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: /editar/i })
    fireEvent.click(editButtons[0]) // O primeiro é o RASCUNHO

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /editar rascunho/i })).toBeInTheDocument()
    })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Obs atualizada' } })

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(`/convocacoes/${CONVOCACAO_ID}`, {
        observacoes: 'Obs atualizada'
      })
    })
  })

  it('deve bloquear edição se status for PUBLICADA ou CANCELADA', async () => {
    render(<ConvocacoesView />)

    await waitFor(() => {
      expect(screen.getByText('Convocação publicada')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: /editar/i })
    fireEvent.click(editButtons[1]) // O segundo é a PUBLICADA

    expect(screen.getByRole('alert')).toHaveTextContent('Não é possível editar uma convocação com status PUBLICADA. Somente rascunhos podem ser editados.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(apiClient.patchWithAuth).not.toHaveBeenCalled()
  })

  it('deve exibir erro de API na listagem', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockRejectedValue(new Error('Falha no servidor'))

    render(<ConvocacoesView />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Falha no servidor')
    })
  })

  describe('Gestão de Funções do Rascunho', () => {
    it('deve exibir listas vazias e permitir adicionar/remover função', async () => {
      type ConvocacaoFuncaoMock = {
        id: string
        convocacaoId: string
        funcaoId: string
        createdAt: string
      }
      let vinculadas: ConvocacaoFuncaoMock[] = []
      
      vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url, options) => {
        if (options?.method === 'DELETE') {
          vinculadas = []
          return { success: true }
        }
        if (url === '/funcoes') return [{ id: '11111111-1111-1111-1111-111111111111', nome: 'Músico', ativo: true }]
        if (url === `/convocacoes/${CONVOCACAO_ID}/funcoes`) return vinculadas
        if (url === '/eventos') return mockEventos
        if (url === '/convocacoes') return mockConvocacoes
        return []
      })
      
      vi.mocked(apiClient.postWithAuth).mockImplementation(async () => {
        vinculadas = [{ id: 'v1', convocacaoId: CONVOCACAO_ID, funcaoId: '11111111-1111-1111-1111-111111111111', createdAt: '2026-09-17' }]
        return vinculadas[0]
      })

      render(<ConvocacoesView />)

      await waitFor(() => {
        expect(screen.getByText('Minha observação rascunho')).toBeInTheDocument()
      })

      const botoesGerenciar = screen.getAllByRole('button', { name: /gerenciar funções/i })
      expect(botoesGerenciar).toHaveLength(1) // Apenas RASCUNHO

      fireEvent.click(botoesGerenciar[0])

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /gerenciar funções do rascunho/i })).toBeInTheDocument()
        expect(screen.getByText('Nenhuma função vinculada.')).toBeInTheDocument()
      })
      
      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: '11111111-1111-1111-1111-111111111111' } })
      fireEvent.click(screen.getByRole('button', { name: /adicionar/i }))
      
      await waitFor(() => {
        expect(apiClient.postWithAuth).toHaveBeenCalledWith(`/convocacoes/${CONVOCACAO_ID}/funcoes`, { funcaoId: '11111111-1111-1111-1111-111111111111' })
        expect(screen.getByText('Músico')).toBeInTheDocument()
        expect(screen.queryByText('Nenhuma função vinculada.')).not.toBeInTheDocument()
        expect(screen.getByText('Nenhuma função disponível para adicionar.')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /remover/i }))
      
      await waitFor(() => {
        expect(apiClient.fetchWithAuth).toHaveBeenCalledWith(`/convocacoes/${CONVOCACAO_ID}/funcoes/11111111-1111-1111-1111-111111111111`, { method: 'DELETE' })
        expect(screen.getByText('Nenhuma função vinculada.')).toBeInTheDocument()
      })
    })

    it('deve exibir erro da API e erro de validação (ex: função já adicionada)', async () => {
      vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
        if (url === '/funcoes') return [{ id: '22222222-2222-2222-2222-222222222222', nome: 'Porteiro', ativo: true }]
        if (url === `/convocacoes/${CONVOCACAO_ID}/funcoes`) return []
        if (url === '/eventos') return mockEventos
        if (url === '/convocacoes') return mockConvocacoes
        return []
      })
      
      vi.mocked(apiClient.postWithAuth).mockRejectedValueOnce(new Error('Função já adicionada a esta convocação'))

      render(<ConvocacoesView />)

      await waitFor(() => {
        expect(screen.getByText('Minha observação rascunho')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /gerenciar funções/i }))
      
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /gerenciar funções do rascunho/i })).toBeInTheDocument()
      })

      fireEvent.change(screen.getByRole('combobox'), { target: { value: '22222222-2222-2222-2222-222222222222' } })
      fireEvent.click(screen.getByRole('button', { name: /adicionar/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Função já adicionada a esta convocação')
      })
    })

    it('deve exibir erro caso falhe o carregamento inicial das funções e listas', async () => {
      vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url) => {
        if (url === '/eventos') return mockEventos
        if (url === '/convocacoes') return mockConvocacoes
        if (url.includes('/funcoes')) throw new Error('Falha catastrófica')
        return []
      })

      render(<ConvocacoesView />)

      await waitFor(() => {
        expect(screen.getByText('Minha observação rascunho')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /gerenciar funções/i }))
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Falha catastrófica')
      })
    })
  })
})
