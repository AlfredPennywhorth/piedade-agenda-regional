import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

  it('limpa o evento selecionado quando a busca deixa de exibi-lo', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url: string) => {
      if (url === '/eventos') {
        return [
          { id: 'ev-123', titulo: 'Assembleia Regional', inicioEm: '2026-10-01T09:00:00Z', ativo: true },
          { id: 'ev-456', titulo: 'Reunião Administrativa', inicioEm: '2026-10-02T09:00:00Z', ativo: true },
        ]
      }
      return []
    })

    render(<RelatoriosView />)
    fireEvent.click(screen.getByText('Relatório do Evento'))

    const select = await screen.findByRole('combobox', { name: /selecionar evento/i }) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'ev-123' } })
    expect(select.value).toBe('ev-123')

    fireEvent.change(screen.getByRole('textbox', { name: /pesquisar evento/i }), {
      target: { value: 'Administrativa' },
    })

    await waitFor(() => expect(select.value).toBe(''))
    expect(screen.getByRole('button', { name: /buscar relatório/i })).toBeDisabled()
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
  it('envia os filtros nominais atuais e ignora respostas anteriores', async () => {
    let resolverPrimeira: ((value: any) => void) | undefined
    const urls: string[] = []
    const dadosEvento = {
      evento: { id: 'ev-123', titulo: 'Reunião de Teste', inicioEm: '2026-10-01T09:00:00Z', fimEm: '2026-10-01T12:00:00Z', modalidade: 'PRESENCIAL' },
      totalConvocados: 1, totalConfirmados: 1, totalRecusados: 0, totalNaoSei: 0,
      totalSemResposta: 0, totalPresencas: 1, presencasConfirmados: 1,
      taxaEngajamentoRsvp: 100, taxaPresencaConvocados: 100, taxaPresencaConfirmados: 100,
    }
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url: string) => {
      if (url === '/eventos') return [{ id: 'ev-123', titulo: 'Reunião de Teste', inicioEm: '2026-10-01T09:00:00Z', ativo: true }]
      if (url.endsWith('/presencas?')) return []
      if (url.includes('/presencas?')) {
        urls.push(url)
        if (new URL(url, 'http://localhost').searchParams.get('busca') === 'A') return new Promise(resolve => { resolverPrimeira = resolve })
        return [{ destinatarioId: 'dest-2', membroNome: 'Atual', casaNome: 'Casa', respostaRsvp: 'PARTICIPAREI', presente: true }]
      }
      return dadosEvento
    })
    render(<RelatoriosView />)
    fireEvent.click(screen.getByText('Relatório do Evento'))
    fireEvent.change(await screen.findByRole('combobox', { name: /selecionar evento/i }), { target: { value: 'ev-123' } })
    fireEvent.click(screen.getByText('Buscar Relatório'))
    await screen.findByPlaceholderText('Filtrar por nome...')
    const campoNome = screen.getByPlaceholderText('Filtrar por nome...')
    fireEvent.change(campoNome, { target: { value: 'A' } })
    await waitFor(() => expect(resolverPrimeira).toBeDefined())
    fireEvent.change(campoNome, { target: { value: 'Atual' } })
    await screen.findByText('Atual')
    resolverPrimeira?.([{ destinatarioId: 'dest-antigo', membroNome: 'Antigo', casaNome: 'Casa', respostaRsvp: 'PARTICIPAREI', presente: true }])
    await waitFor(() => expect(screen.queryByText('Antigo')).not.toBeInTheDocument())
    expect(urls.some(url => new URL(url, 'http://localhost').searchParams.get('busca') === 'A')).toBe(true)
    expect(urls.some(url => url.includes('busca=Atual'))).toBe(true)
    fireEvent.change(screen.getByDisplayValue('Todos Status RSVP'), { target: { value: 'PARTICIPAREI' } })
    await waitFor(() => expect(urls.some(url => url.includes('statusRsvp=PARTICIPAREI') && url.includes('busca=Atual'))).toBe(true))
  })

})
