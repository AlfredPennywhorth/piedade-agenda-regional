import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CadastroConvidadoView } from '../components/portaria/CadastroConvidadoView'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', () => ({
  fetchPublic: vi.fn(),
  postPublic: vi.fn(),
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

describe('CadastroConvidadoView — PORT-02', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.fetchPublic).mockResolvedValue({
      evento: {
        id: 'evento-1',
        titulo: 'Reunião Regional',
        inicioEm: '2099-01-01T10:00:00.000Z',
        fimEm: '2099-01-01T20:00:00.000Z',
      },
      campos: {},
    })
  })

  it('abre formulário público sem exigir autenticação', async () => {
    render(<CadastroConvidadoView token="token-publico" />)

    expect(await screen.findByText('Cadastro de convidado')).toBeInTheDocument()
    expect(screen.getByText('Reunião Regional')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome completo')).toBeInTheDocument()
    expect(screen.getByLabelText('Localidade / Casa de Oração')).toBeInTheDocument()
  })

  it('exibe estado de reunião encerrada quando a Portaria foi fechada', async () => {
    vi.mocked(apiClient.fetchPublic).mockRejectedValueOnce(
      new apiClient.ApiError(409, 'Portaria fechada', { code: 'PORTARIA_FECHADA' })
    )

    render(<CadastroConvidadoView token="token-fechado" />)

    expect(await screen.findByText('Reunião encerrada')).toBeInTheDocument()
    expect(
      screen.getByText('A Portaria desta reunião já foi fechada. Não é mais possível enviar novos cadastros.')
    ).toBeInTheDocument()
  })

  it('exibe estado de cadastro encerrado quando a credencial expirou', async () => {
    vi.mocked(apiClient.fetchPublic).mockRejectedValueOnce(
      new apiClient.ApiError(410, 'Credencial expirada', { code: 'CREDENCIAL_EXPIRADA' })
    )

    render(<CadastroConvidadoView token="token-expirado" />)

    expect(await screen.findByText('Cadastro encerrado')).toBeInTheDocument()
    expect(screen.getByText('O período de cadastro de convidados desta reunião terminou.')).toBeInTheDocument()
  })

  it('exibe estado de link indisponível quando a credencial foi revogada', async () => {
    vi.mocked(apiClient.fetchPublic).mockRejectedValueOnce(
      new apiClient.ApiError(409, 'Credencial indisponível', { code: 'CREDENCIAL_INDISPONIVEL' })
    )

    render(<CadastroConvidadoView token="token-revogado" />)

    expect(await screen.findByText('Link indisponível')).toBeInTheDocument()
    expect(
      screen.getByText('Este link não está mais ativo. Se a Portaria ainda estiver aberta, solicite um novo link ao porteiro.')
    ).toBeInTheDocument()
  })

  it('envia nome e localidade e orienta aguardar validação do porteiro', async () => {
    vi.mocked(apiClient.postPublic).mockResolvedValue({
      cadastrado: true,
      convidado: {
        id: 'convidado-1',
        nome: 'Visitante',
        localidade: 'Casa Centro',
        status: 'PENDENTE',
      },
    })

    render(<CadastroConvidadoView token="token-publico" />)

    await screen.findByText('Cadastro de convidado')

    fireEvent.change(screen.getByLabelText('Nome completo'), {
      target: { value: 'Visitante' },
    })
    fireEvent.change(screen.getByLabelText('Localidade / Casa de Oração'), {
      target: { value: 'Casa Centro' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar cadastro' }))

    await waitFor(() => {
      expect(apiClient.postPublic).toHaveBeenCalledWith(
        '/portaria-publica/cadastro/token-publico',
        expect.objectContaining({
          nome: 'Visitante',
          localidade: 'Casa Centro',
        })
      )
    })

    expect(await screen.findByText('Cadastro enviado')).toBeInTheDocument()
    expect(
      screen.getByText(/Apresente-se ao porteiro para validar sua presença/i)
    ).toBeInTheDocument()
  })
})
