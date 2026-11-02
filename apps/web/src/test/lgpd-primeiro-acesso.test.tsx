import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LgpdPrimeiroAcessoGate } from '../components/lgpd/LgpdPrimeiroAcessoGate'
import * as apiClient from '../api/apiClient'

vi.mock('../api/apiClient', () => ({
  fetchWithAuth: vi.fn(),
  postWithAuth: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) { super(message); this.status = status }
  },
}))

const aviso = {
  titulo: 'Aviso de Privacidade',
  versao: '2026-11-01.1',
  hash: 'hash-teste',
  paragrafos: ['Tratamento de nome e celular para autenticação.'],
  registradoEm: null,
  ciente: false,
}

describe('LGPD — gate de primeiro acesso', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue(aviso)
  })

  it('bloqueia a Agenda até as duas confirmações e registra versão e hash', async () => {
    vi.mocked(apiClient.postWithAuth).mockResolvedValue({ ciente: true })
    const onCienciaRegistrada = vi.fn().mockResolvedValue(undefined)
    render(
      <LgpdPrimeiroAcessoGate onSair={vi.fn()} onCienciaRegistrada={onCienciaRegistrada}>
        <div>Conteúdo protegido da Agenda</div>
      </LgpdPrimeiroAcessoGate>
    )
    expect(await screen.findByText('Tratamento de nome e celular para autenticação.')).toBeInTheDocument()
    expect(screen.queryByText('Conteúdo protegido da Agenda')).not.toBeInTheDocument()

    const registrar = screen.getByRole('button', { name: /Confirmar ciência e acessar/i })
    expect(registrar).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/Confirmo que li o Aviso/i))
    expect(registrar).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/Estou ciente de que o tratamento/i))
    expect(registrar).toBeEnabled()
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue({ ...aviso, ciente: true, registradoEm: '2026-11-01' })
    fireEvent.click(registrar)
    await waitFor(() => expect(apiClient.postWithAuth).toHaveBeenCalledWith('/lgpd/ciencia', {
      versao: aviso.versao, hash: aviso.hash,
      leituraConfirmada: true, tratamentoNecessarioCiente: true,
    }))
    expect(await screen.findByText('Conteúdo protegido da Agenda')).toBeInTheDocument()
    expect(onCienciaRegistrada).toHaveBeenCalledTimes(1)
  })

  it('permite sair sem registrar ciência', async () => {
    const onSair = vi.fn().mockResolvedValue(undefined)
    render(<LgpdPrimeiroAcessoGate onSair={onSair}><div>Protegido</div></LgpdPrimeiroAcessoGate>)
    await screen.findByText('Tratamento de nome e celular para autenticação.')
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(onSair).toHaveBeenCalledTimes(1)
    expect(apiClient.postWithAuth).not.toHaveBeenCalled()
  })
})
