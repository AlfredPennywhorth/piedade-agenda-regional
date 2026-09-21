import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RelatoriosPresencaView } from '../components/relatorios/RelatoriosPresencaView'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', async importOriginal => {
  const actual = await importOriginal<typeof import('../api/apiClient')>()
  return { ...actual, fetchWithAuth: vi.fn() }
})

const lookups: Record<string, unknown> = {
  '/eventos': [{ id: 'evento-1', titulo: 'Reunião Regional', inicioEm: '2026-09-01T10:00:00.000Z', ativo: true }],
  '/membros': [{ id: 'm1', nome: 'Membro Alvo', casaId: 'casa-1', ativo: true }],
  '/regionais': [{ id: 'reg-1', nome: 'Regional São Paulo', ativo: true }],
  '/administracoes': [{ id: 'adm-1', regionalId: 'reg-1', nome: 'Administração Central', ativo: true }],
  '/setores': [{ id: 'setor-1', administracaoId: 'adm-1', nome: 'Setor Centro', ativo: true }],
  '/casas': [{ id: 'casa-1', setorId: 'setor-1', nome: 'Casa Centro', ativo: true }],
  '/grupos-trabalho': [{ id: 'gt-1', nome: 'Fundo Musical', regionalId: 'reg-1', ativo: true }],
}

describe('REL-PRES-03 — seletores amigáveis dos relatórios de presença', () => {
  beforeEach(() => vi.resetAllMocks())

  it('pesquisa e seleciona reunião por nome antes de consultar', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url: string) => {
      if (url in lookups) return lookups[url]
      if (url === '/relatorios/presencas/eventos/evento-1/final') {
        return {
          fonte: 'SNAPSHOT_FECHAMENTO',
          evento: { id: 'evento-1', titulo: 'Reunião Regional', inicioEm: '2026-09-01T10:00:00.000Z', fimEm: '2026-09-01T12:00:00.000Z' },
          fechamento: { id: 'fech-1', fechadoEm: '2026-09-01T12:10:00.000Z', fechadoPorMembroId: 'porteiro-1' },
          resumo: { totalConvocados: 2, totalConvocadosPresentes: 1, totalConvocadosAusentes: 1, totalConvidadosValidados: 1, totalConvidadosPendentes: 0, totalPresentes: 2 },
          itens: [{ tipoPessoa: 'MEMBRO', origemId: 'm1', nome: 'Ana', localidade: 'Casa Centro', situacao: 'PRESENTE', respostaRsvp: 'PARTICIPAREI', formaPresenca: 'QR', registradoEm: '2026-09-01T10:05:00.000Z' }],
        }
      }
      throw new Error(`URL não simulada: ${url}`)
    })

    render(<RelatoriosPresencaView />)
    expect(await screen.findByRole('option', { name: /Reunião Regional/i })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Pesquisar reunião'), { target: { value: 'Regional' } })
    fireEvent.change(screen.getByLabelText('Selecionar reunião'), { target: { value: 'evento-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }))

    expect(await screen.findByText('Reunião Regional')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
  })

  it('pesquisa e seleciona membro por nome para consultar histórico', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url: string) => {
      if (url in lookups) return lookups[url]
      if (url.startsWith('/relatorios/presencas/membros/m1')) {
        return {
          membro: { id: 'm1', nome: 'Membro Alvo' },
          periodo: { dataInicio: '2026-08-01T00:00:00.000Z', dataFim: null },
          resumo: { totalReunioes: 2, totalPresentes: 1, totalAusentes: 1, taxaPresenca: 50 },
          reunioes: [{ eventoId: 'ev-1', eventoTitulo: 'Reunião A', inicioEm: '2026-09-01T10:00:00.000Z', fimEm: '2026-09-01T12:00:00.000Z', fechadoEm: '2026-09-01T12:10:00.000Z', situacao: 'PRESENTE', respostaRsvp: 'PARTICIPAREI', formaPresenca: 'MANUAL', registradoEm: '2026-09-01T10:05:00.000Z', localidade: 'Casa Centro' }],
        }
      }
      throw new Error(`URL não simulada: ${url}`)
    })

    render(<RelatoriosPresencaView />)
    fireEvent.click(screen.getByRole('button', { name: 'Histórico do membro' }))
    expect(await screen.findByRole('option', { name: 'Membro Alvo' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Pesquisar membro'), { target: { value: 'Membro' } })
    fireEvent.change(screen.getByLabelText('Selecionar membro'), { target: { value: 'm1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar histórico' }))

    expect(await screen.findByText('Reunião A')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('usa hierarquia Regional → Administração → Setor no consolidado', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url: string) => {
      if (url in lookups) return lookups[url]
      if (url.startsWith('/relatorios/presencas/periodo?')) {
        return {
          escopo: { escopoTipo: 'SETOR', escopoId: 'setor-1' },
          periodo: { dataInicio: null, dataFim: null },
          resumo: { totalEventos: 2, totalConvocados: 10, totalConvocadosPresentes: 8, totalConvocadosAusentes: 2, totalConvidadosValidados: 3, totalConvidadosPendentes: 1, totalPresentes: 11, taxaPresencaConvocados: 80 },
          eventos: [{ eventoId: 'ev-1', titulo: 'Reunião do Setor', inicioEm: '2026-09-01T10:00:00.000Z', fechadoEm: '2026-09-01T12:00:00.000Z', totalConvocados: 5, totalConvocadosPresentes: 4, totalConvocadosAusentes: 1, totalConvidadosValidados: 2, totalConvidadosPendentes: 0, totalPresentes: 6 }],
        }
      }
      throw new Error(`URL não simulada: ${url}`)
    })

    render(<RelatoriosPresencaView />)
    fireEvent.click(screen.getByRole('button', { name: 'Período / escopo' }))
    expect(await screen.findByRole('option', { name: 'Regional São Paulo' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tipo de escopo'), { target: { value: 'SETOR' } })
    fireEvent.change(screen.getByLabelText('Regional'), { target: { value: 'reg-1' } })
    fireEvent.change(screen.getByLabelText('Administração'), { target: { value: 'adm-1' } })
    fireEvent.change(screen.getByLabelText('Setor'), { target: { value: 'setor-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consolidar período' }))

    expect(await screen.findByText('Reunião do Setor')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('filtra GTs pela Regional escolhida', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockImplementation(async (url: string) => {
      if (url in lookups) return lookups[url]
      return {}
    })

    render(<RelatoriosPresencaView />)
    fireEvent.click(screen.getByRole('button', { name: 'Período / escopo' }))
    await screen.findByRole('option', { name: 'Regional São Paulo' })
    fireEvent.change(screen.getByLabelText('Tipo de escopo'), { target: { value: 'GRUPO_TRABALHO' } })
    fireEvent.change(screen.getByLabelText('Regional'), { target: { value: 'reg-1' } })

    expect(screen.getByRole('option', { name: 'Fundo Musical' })).toBeInTheDocument()
  })
})
