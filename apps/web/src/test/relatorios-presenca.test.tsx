import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RelatoriosPresencaView } from '../components/relatorios/RelatoriosPresencaView'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', async importOriginal => {
  const actual = await importOriginal<typeof import('../api/apiClient')>()
  return {
    ...actual,
    fetchWithAuth: vi.fn(),
  }
})

describe('REL-PRES-02 — interface de relatórios de presença', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('consulta a lista final de uma reunião', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue({
      fonte: 'SNAPSHOT_FECHAMENTO',
      evento: {
        id: 'evento-1',
        titulo: 'Reunião Regional',
        inicioEm: '2026-09-01T10:00:00.000Z',
        fimEm: '2026-09-01T12:00:00.000Z',
      },
      fechamento: {
        id: 'fech-1',
        fechadoEm: '2026-09-01T12:10:00.000Z',
        fechadoPorMembroId: 'porteiro-1',
      },
      resumo: {
        totalConvocados: 2,
        totalConvocadosPresentes: 1,
        totalConvocadosAusentes: 1,
        totalConvidadosValidados: 1,
        totalConvidadosPendentes: 0,
        totalPresentes: 2,
      },
      itens: [
        {
          tipoPessoa: 'MEMBRO',
          origemId: 'm1',
          nome: 'Ana',
          localidade: 'Casa Centro',
          situacao: 'PRESENTE',
          respostaRsvp: 'PARTICIPAREI',
          formaPresenca: 'QR',
          registradoEm: '2026-09-01T10:05:00.000Z',
        },
      ],
    })

    render(<RelatoriosPresencaView />)

    fireEvent.change(screen.getByLabelText('ID do evento'), {
      target: { value: 'evento-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }))

    expect(await screen.findByText('Reunião Regional')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Casa Centro')).toBeInTheDocument()
    expect(apiClient.fetchWithAuth).toHaveBeenCalledWith(
      '/relatorios/presencas/eventos/evento-1/final'
    )
  })

  it('consulta histórico de um membro com período', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue({
      membro: { id: 'm1', nome: 'Membro Alvo' },
      periodo: { dataInicio: '2026-08-01T00:00:00.000Z', dataFim: null },
      resumo: {
        totalReunioes: 2,
        totalPresentes: 1,
        totalAusentes: 1,
        taxaPresenca: 50,
      },
      reunioes: [
        {
          eventoId: 'ev-1',
          eventoTitulo: 'Reunião A',
          inicioEm: '2026-09-01T10:00:00.000Z',
          fimEm: '2026-09-01T12:00:00.000Z',
          fechadoEm: '2026-09-01T12:10:00.000Z',
          situacao: 'PRESENTE',
          respostaRsvp: 'PARTICIPAREI',
          formaPresenca: 'MANUAL',
          registradoEm: '2026-09-01T10:05:00.000Z',
          localidade: 'Casa Centro',
        },
      ],
    })

    render(<RelatoriosPresencaView />)
    fireEvent.click(screen.getByRole('button', { name: 'Histórico do membro' }))

    fireEvent.change(screen.getByLabelText('ID do membro'), {
      target: { value: 'm1' },
    })
    fireEvent.change(screen.getByLabelText('Data inicial do membro'), {
      target: { value: '2026-08-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar histórico' }))

    expect(await screen.findByText('Membro Alvo')).toBeInTheDocument()
    expect(screen.getByText('Reunião A')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('consolida presença por período e escopo', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue({
      escopo: { escopoTipo: 'SETOR', escopoId: 'setor-1' },
      periodo: {
        dataInicio: '2026-08-01T00:00:00.000Z',
        dataFim: '2026-09-30T23:59:59.999Z',
      },
      resumo: {
        totalEventos: 2,
        totalConvocados: 10,
        totalConvocadosPresentes: 8,
        totalConvocadosAusentes: 2,
        totalConvidadosValidados: 3,
        totalConvidadosPendentes: 1,
        totalPresentes: 11,
        taxaPresencaConvocados: 80,
      },
      eventos: [
        {
          eventoId: 'ev-1',
          titulo: 'Reunião do Setor',
          inicioEm: '2026-09-01T10:00:00.000Z',
          fechadoEm: '2026-09-01T12:00:00.000Z',
          totalConvocados: 5,
          totalConvocadosPresentes: 4,
          totalConvocadosAusentes: 1,
          totalConvidadosValidados: 2,
          totalConvidadosPendentes: 0,
          totalPresentes: 6,
        },
      ],
    })

    render(<RelatoriosPresencaView />)
    fireEvent.click(screen.getByRole('button', { name: 'Período / escopo' }))

    fireEvent.change(screen.getByLabelText('Tipo de escopo'), {
      target: { value: 'SETOR' },
    })
    fireEvent.change(screen.getByLabelText('ID do escopo'), {
      target: { value: 'setor-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Consolidar período' }))

    expect(await screen.findByText('Reunião do Setor')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
  })
})
