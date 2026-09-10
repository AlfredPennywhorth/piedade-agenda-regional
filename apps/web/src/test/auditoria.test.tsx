import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AuditoriaView } from '../components/auditoria/AuditoriaView'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/apiClient')>()
  return {
    ...actual,
    fetchWithAuth: vi.fn(),
  }
})

describe('S12 — AuditoriaView (Frontend)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('deve carregar e exibir lista de logs de auditoria', async () => {
    const mockAuditResponse = {
      items: [
        {
          id: 'log-1',
          acao: 'EVENTO_CRIADO',
          atorMembroId: 'mem-100',
          atorNome: 'João Silva',
          recursoTipo: 'EVENTO',
          recursoId: 'ev-999',
          escopoTipo: 'REGIONAL',
          escopoId: 'reg-sp',
          contexto: { titulo: 'Novo Evento Auditado' },
          ip: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          criadoEm: '2026-10-01T10:00:00.000Z'
        }
      ],
      pagination: {
        total: 1,
        page: 1,
        limit: 20,
        pages: 1
      }
    }

    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue(mockAuditResponse)

    render(<AuditoriaView />)

    expect(screen.getByText('Trilha de Auditoria')).toBeInTheDocument()
    expect(await screen.findByText('EVENTO_CRIADO')).toBeInTheDocument()
    expect(await screen.findByText('João Silva')).toBeInTheDocument()
    expect(await screen.findByText('Ver Detalhes')).toBeInTheDocument()
  })

  it('deve abrir modal de detalhes ao clicar em Ver Detalhes', async () => {
    const mockAuditResponse = {
      items: [
        {
          id: 'log-1',
          acao: 'CHECKIN_QR',
          atorMembroId: 'mem-100',
          atorNome: 'Maria Operadora',
          recursoTipo: 'CHECKIN',
          recursoId: 'chk-1',
          escopoTipo: 'SETOR',
          escopoId: 'set-1',
          contexto: { forma: 'QR', eventoId: 'ev-1' },
          ip: null,
          userAgent: null,
          criadoEm: '2026-10-01T10:00:00.000Z'
        }
      ],
      pagination: { total: 1, page: 1, limit: 20, pages: 1 }
    }

    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue(mockAuditResponse)

    render(<AuditoriaView />)

    const detailsBtn = await screen.findByText('Ver Detalhes')
    fireEvent.click(detailsBtn)

    expect(await screen.findByText('Contexto do Evento de Auditoria')).toBeInTheDocument()
  })
})
