import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PerfilView } from '../components/perfil/PerfilView'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../api/apiClient')>('../api/apiClient')
  return {
    ...actual,
    fetchWithAuth: vi.fn(),
    patchWithAuth: vi.fn(),
    postWithAuth: vi.fn(),
    limparTokenSessao: vi.fn(),
  }
})

describe('PerfilView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve exibir a data de ordenação em formato brasileiro', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValueOnce({
      id: 'membro-1',
      nome: 'Pessoa Teste',
      celular: '11999999999',
      codigoCarteirinha: '123',
      dataOrdenacao: '2010-03-15',
      casaId: 'casa-1',
      casa: {
        nome: 'Jardim Teste',
        codigo: '001',
        setor: 'Setor Teste',
        administracao: 'Administração Teste',
        regional: 'Regional São Paulo',
      },
      ativo: true,
      autenticacaoAtiva: true,
      ativadoEm: '2026-09-01T00:00:00.000Z',
      conta: {
        id: 'conta-1',
        status: 'ATIVA',
      },
    } as any)

    render(<PerfilView />)

    await waitFor(() => {
      expect(screen.getByText('15/03/2010')).toBeInTheDocument()
    })
    expect(apiClient.fetchWithAuth).toHaveBeenCalledWith('/auth/me')
  })

  it('deve sinalizar quando a data de ordenação não estiver informada no cadastro', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValueOnce({
      id: 'membro-1',
      nome: 'Pessoa Teste',
      celular: '11999999999',
      codigoCarteirinha: '123',
      dataOrdenacao: null,
      casaId: 'casa-1',
      casa: {
        nome: 'Jardim Teste',
        codigo: '001',
        setor: 'Setor Teste',
        administracao: 'Administração Teste',
        regional: 'Regional São Paulo',
      },
      ativo: true,
      autenticacaoAtiva: true,
      ativadoEm: '2026-09-01T00:00:00.000Z',
      conta: {
        id: 'conta-1',
        status: 'ATIVA',
      },
    } as any)

    render(<PerfilView />)

    await waitFor(() => {
      expect(screen.getByText('Não informada')).toBeInTheDocument()
    })
  })
})
