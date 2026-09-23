import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RelatoriosView } from '../components/relatorios/RelatoriosView'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/apiClient')>()
  return {
    ...actual,
    fetchWithAuth: vi.fn(),
  }
})

describe('S12 — RelatoriosView (Frontend)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('deve disponibilizar seletor amigável de evento no relatório', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url: string) => {
      if (url === '/eventos') {
        return [{ id: 'ev-123', titulo: 'Assembleia Regional', inicioEm: '2026-10-01T09:00:00Z', ativo: true }]
      }
      return []
    })

    render(<RelatoriosView />)
    fireEvent.click(screen.getByText('Relatório do Evento'))

    expect(screen.getByPlaceholderText(/Pesquisar evento por nome/i)).toBeInTheDocument()
    const select = await screen.findByRole('combobox', { name: /selecionar evento/i })
    expect(select).toHaveTextContent('Assembleia Regional')
    expect(screen.queryByPlaceholderText(/Digite o ID do Evento/i)).not.toBeInTheDocument()
  })

  it('deve buscar e exibir relatório consolidado e lista nominal', async () => {
    const mockRelatorio = {
      evento: {
        id: 'ev-123',
        titulo: 'Assembleia Regional',
        inicioEm: '2026-10-01T09:00:00Z',
        fimEm: '2026-10-01T12:00:00Z',
        modalidade: 'PRESENCIAL'
      },
      totalConvocados: 10,
      totalConfirmados: 8,
      totalRecusados: 1,
      totalNaoSei: 0,
      totalSemResposta: 1,
      totalPresencas: 7,
      presencasConfirmados: 7,
      taxaEngajamentoRsvp: 90,
      taxaPresencaConvocados: 70,
      taxaPresencaConfirmados: 87.5
    }

    const mockPresencas = [
      {
        destinatarioId: 'dest-1',
        membroId: 'mem-1',
        membroNome: 'Carlos Eduardo',
        membroCelular: '11999998888',
        casaNome: 'Casa Alpha',
        respostaRsvp: 'PARTICIPAREI',
        periodosParticipacao: [],
        presente: true,
        formaCheckin: 'QR',
        dataHoraCheckin: '2026-10-01T09:05:00Z'
      }
    ]

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url: string) => {
      if (url === '/eventos') {
        return [{ id: 'ev-123', titulo: 'Assembleia Regional', inicioEm: '2026-10-01T09:00:00Z', ativo: true }]
      }
      if (url.includes('/relatorios/eventos/ev-123/presencas')) {
        return mockPresencas
      }
      if (url.includes('/relatorios/eventos/ev-123')) {
        return mockRelatorio
      }
      throw new Error('Not found')
    })

    render(<RelatoriosView />)
    fireEvent.click(screen.getByText('Relatório do Evento'))

    const select = await screen.findByRole('combobox', { name: /selecionar evento/i })
    fireEvent.change(select, { target: { value: 'ev-123' } })

    const btn = screen.getByText('Buscar Relatório')
    fireEvent.click(btn)

    expect(await screen.findByText('Assembleia Regional')).toBeInTheDocument()
    expect(await screen.findByText('Carlos Eduardo')).toBeInTheDocument()
    expect(await screen.findByText('Casa Alpha')).toBeInTheDocument()
  })

  it('deve alternar para relatório agregado e buscar por escopo', async () => {
    const mockAgregado = {
      escopo: { escopoTipo: 'REGIONAL', escopoId: 'reg-sp' },
      totalEventos: 2,
      totalConvocacoesMaterializadas: 2,
      totalConvocados: 50,
      totalConfirmados: 40,
      totalPresencas: 35,
      mediaPresencaPorEvento: 17.5,
      taxaPresencaGeral: 70,
      eventos: [
        {
          id: 'ev-1',
          titulo: 'Evento 1',
          inicioEm: '2026-10-01T09:00:00Z',
          modalidade: 'PRESENCIAL',
          totalConvocados: 25,
          totalConfirmados: 20,
          totalPresencas: 18,
          taxaPresenca: 72
        }
      ]
    }

    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url: string) => {
      if (url === '/eventos') return []
      return mockAgregado
    })

    render(<RelatoriosView />)

    const tabAgregado = screen.getByText('Relatório Agregado')
    fireEvent.click(tabAgregado)

    const inputEscopoId = screen.getByPlaceholderText(/ID da Regional/i)
    fireEvent.change(inputEscopoId, { target: { value: 'reg-sp' } })

    const btnGerar = screen.getByText('Gerar Relatório Agregado')
    fireEvent.click(btnGerar)

    expect(await screen.findByText('Evento 1')).toBeInTheDocument()
  })
})
