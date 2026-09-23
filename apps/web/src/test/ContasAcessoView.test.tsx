import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ContasAcessoView } from '../components/acessos/ContasAcessoView'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', () => ({
  fetchWithAuth: vi.fn(),
  postWithAuth: vi.fn(),
  patchWithAuth: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    body: unknown
    constructor(status: number, message: string, body: unknown) {
      super(message)
      this.status = status
      this.body = body
    }
  },
}))

const contaAtiva = {
  membroId: 'membro-1',
  nome: 'Pessoa Teste',
  celular: '11999990000',
  codigoCarteirinha: 'CARTEIRA-1',
  dataOrdenacao: '2000-01-01',
  regionalId: 'regional-1',
  contaAcessoId: 'conta-1',
  status: 'ATIVA',
  ativadoEm: '2026-01-01T00:00:00.000Z',
  acessos: [
    {
      id: 'acesso-1',
      perfilCodigo: 'USUARIO_COMUM',
      escopoTipo: 'CASA',
      escopoId: 'casa-1',
    },
  ],
}

describe('ContasAcessoView — PR-ACC-05', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue([contaAtiva])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('lista somente os dados administrativos retornados pela API', async () => {
    render(<ContasAcessoView />)

    expect(await screen.findByText('Pessoa Teste')).toBeDefined()
    expect(screen.getByText('11999990000')).toBeDefined()
    expect(screen.getByText(/CARTEIRA-1/)).toBeDefined()
    expect(screen.getByText(/USUARIO_COMUM/)).toBeDefined()
    expect(apiClient.fetchWithAuth).toHaveBeenCalledWith('/admin/acessos')
  })

  it('confirma o bloqueio e atualiza a listagem', async () => {
    vi.mocked(apiClient.patchWithAuth).mockResolvedValue({
      membroId: 'membro-1',
      contaAcessoId: 'conta-1',
      status: 'BLOQUEADA',
    })

    render(<ContasAcessoView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Bloquear' }))

    await waitFor(() => {
      expect(apiClient.patchWithAuth).toHaveBeenCalledWith(
        '/admin/acessos/membros/membro-1/status',
        { status: 'BLOQUEADA' }
      )
    })
    expect(window.confirm).toHaveBeenCalled()
    expect(await screen.findByText('Conta bloqueada e sessões revogadas.')).toBeDefined()
  })

  it('gera link temporário de redefinição sem persistir o token no cliente', async () => {
    vi.mocked(apiClient.postWithAuth).mockResolvedValue({
      token: 'token-temporario',
      expiraEm: '2099-01-01T00:00:00.000Z',
      membroId: 'membro-1',
    })

    render(<ContasAcessoView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Redefinir PIN' }))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith(
        '/admin/acessos/membros/membro-1/reset-pin',
        {}
      )
    })
    const campo = await screen.findByLabelText('Link temporário')
    expect((campo as HTMLInputElement).value).toContain('ativacao=token-temporario')
    expect(localStorage.getItem('token-temporario')).toBeNull()
  })

  it('revoga sessões após confirmação explícita', async () => {
    vi.mocked(apiClient.postWithAuth).mockResolvedValue({
      message: 'Sessões revogadas',
      membroId: 'membro-1',
      contaAcessoId: 'conta-1',
    })

    render(<ContasAcessoView />)
    fireEvent.click(await screen.findByRole('button', { name: 'Revogar sessões' }))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith(
        '/admin/acessos/membros/membro-1/revogar-sessoes',
        {}
      )
    })
    expect(await screen.findByText('Todas as sessões da conta foram revogadas.')).toBeDefined()
  })
})
