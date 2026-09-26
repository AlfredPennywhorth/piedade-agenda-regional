import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthView } from '../components/auth/AuthView'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', () => ({
  postPublic: vi.fn(),
  salvarTokenSessao: vi.fn(),
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

describe('AuthView — ativação e login', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('faz login por celular e PIN e salva a sessão', async () => {
    vi.mocked(apiClient.postPublic).mockResolvedValue({ sessionToken: 'sessao-login' })
    const autenticado = vi.fn()

    render(<AuthView onAuthenticated={autenticado} />)

    fireEvent.change(screen.getByLabelText('Celular'), {
      target: { value: '(11) 99999-9999' },
    })
    fireEvent.change(screen.getByLabelText('PIN de seis dígitos'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(apiClient.postPublic).toHaveBeenCalledWith('/auth/login', {
        identificador: '11999999999',
        pin: '123456',
      })
    })
    expect(apiClient.salvarTokenSessao).toHaveBeenCalledWith('sessao-login')
    expect(autenticado).toHaveBeenCalled()
  })

  it('ativa a conta usando o token recebido pela URL sem exibi-lo', async () => {
    vi.mocked(apiClient.postPublic).mockResolvedValue({ sessionToken: 'sessao-ativacao' })
    const autenticado = vi.fn()

    render(
      <AuthView
        tokenAtivacao="token-secreto-do-link"
        onAuthenticated={autenticado}
      />
    )

    expect(screen.getByRole('heading', { name: 'Ativar conta de acesso' })).toBeDefined()
    expect(screen.queryByDisplayValue('token-secreto-do-link')).toBeNull()

    fireEvent.change(screen.getByLabelText('Celular'), {
      target: { value: '11988887777' },
    })
    fireEvent.change(screen.getByLabelText('PIN de seis dígitos'), {
      target: { value: '654321' },
    })
    fireEvent.change(screen.getByLabelText('Confirmar PIN'), {
      target: { value: '654321' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ativar e entrar' }))

    await waitFor(() => {
      expect(apiClient.postPublic).toHaveBeenCalledWith('/auth/ativar', {
        token: 'token-secreto-do-link',
        celular: '11988887777',
        pin: '654321',
        confirmacaoPin: '654321',
      })
    })
    expect(apiClient.salvarTokenSessao).toHaveBeenCalledWith('sessao-ativacao')
    expect(autenticado).toHaveBeenCalled()
  })

  it('anuncia a confirmação da recuperação de PIN como status', async () => {
    vi.mocked(apiClient.postPublic).mockResolvedValue({
      message: 'Se os dados estiverem cadastrados, a solicitação será encaminhada.',
    })

    render(<AuthView onAuthenticated={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Esqueci meu PIN' }))
    fireEvent.change(screen.getByLabelText('Celular'), {
      target: { value: '11999999999' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar redefinição' }))

    const status = await screen.findByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent(/solicitação será encaminhada/i)
  })

  it('não envia PIN fora do padrão de seis dígitos', async () => {
    render(<AuthView onAuthenticated={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Celular'), {
      target: { value: '11999999999' },
    })
    fireEvent.change(screen.getByLabelText('PIN de seis dígitos'), {
      target: { value: '12345' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O PIN deve conter exatamente 6 dígitos numéricos.'
    )
    expect(apiClient.postPublic).not.toHaveBeenCalled()
  })
})
