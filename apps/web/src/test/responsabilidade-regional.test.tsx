import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ResponsabilidadeRegionalGate } from '../components/governanca/ResponsabilidadeRegionalGate'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', () => {
  class ApiError extends Error {
    status: number
    body: unknown
    constructor(status: number, message: string, body: unknown) {
      super(message)
      this.status = status
      this.body = body
    }
  }
  return {
    ApiError,
    fetchWithAuth: vi.fn(),
    postWithAuth: vi.fn(),
  }
})

describe('ResponsabilidadeRegionalGate', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('não bloqueia usuário sem responsabilidade regional', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockRejectedValue(
      new apiClient.ApiError(403, 'Responsabilidade não atribuída', {})
    )

    render(
      <ResponsabilidadeRegionalGate>
        <div>Conteúdo autorizado</div>
      </ResponsabilidadeRegionalGate>
    )

    expect(await screen.findByText('Conteúdo autorizado')).toBeDefined()
  })

  it('exige confirmação e registra ciência versionada do PMO', async () => {
    vi.mocked(apiClient.fetchWithAuth)
      .mockResolvedValueOnce({
        tipo: 'RESPONSAVEL_REGIONAL_PMO',
        natureza: 'CIENCIA_DE_RESPONSABILIDADE',
        versao: '2026-09-21.v1',
        texto: 'Texto integral das responsabilidades.',
        acessos: [
          {
            acessoContaId: 'acesso-pmo',
            regionalId: 'regional-1',
            ciente: false,
            cienteEm: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        tipo: 'RESPONSAVEL_REGIONAL_PMO',
        natureza: 'CIENCIA_DE_RESPONSABILIDADE',
        versao: '2026-09-21.v1',
        texto: 'Texto integral das responsabilidades.',
        acessos: [
          {
            acessoContaId: 'acesso-pmo',
            regionalId: 'regional-1',
            ciente: true,
            cienteEm: '2026-09-21T12:00:00Z',
          },
        ],
      })
    vi.mocked(apiClient.postWithAuth).mockResolvedValue({ message: 'Ciência registrada' })

    render(
      <ResponsabilidadeRegionalGate>
        <div>Conteúdo autorizado</div>
      </ResponsabilidadeRegionalGate>
    )

    expect(await screen.findByText('Ciência do responsável PMO')).toBeDefined()
    expect(screen.getByText('Texto integral das responsabilidades.')).toBeDefined()
    expect(screen.queryByText('Conteúdo autorizado')).toBeNull()

    fireEvent.click(
      screen.getByLabelText(
        'Li e estou ciente das responsabilidades atribuídas ao PMO da Regional.'
      )
    )
    fireEvent.click(screen.getByRole('button', { name: 'Registrar ciência e continuar' }))

    await waitFor(() => {
      expect(apiClient.postWithAuth).toHaveBeenCalledWith(
        '/governanca/responsabilidade-regional/ciencia',
        {
          acessoContaId: 'acesso-pmo',
          versao: '2026-09-21.v1',
          ciente: true,
        }
      )
    })
    expect(await screen.findByText('Conteúdo autorizado')).toBeDefined()
  })
})
