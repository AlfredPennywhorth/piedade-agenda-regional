import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PortariaView } from '../components/portaria/PortariaView'
import * as apiClient from '../api/apiClient'
import { ApiError } from '../api/apiClient'

vi.mock('../api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/apiClient')>()
  return {
    ...actual,
    fetchWithAuth: vi.fn(),
    postWithAuth: vi.fn(),
  }
})

describe('S11 - ApiError e Portaria Check-in', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('1. ApiError e apiClient.fetchWithAuth (Comportamento de Infraestrutura)', () => {
    it('instancia ApiError corretamente com status, message e body', () => {
      const body = { jaRegistrado: true, message: 'Presença já registrada' }
      const err = new ApiError(409, 'Presença já registrada', body)

      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(ApiError)
      expect(err.name).toBe('ApiError')
      expect(err.status).toBe(409)
      expect(err.message).toBe('Presença já registrada')
      expect(err.body).toEqual(body)
    })

    it('fetchWithAuth lança ApiError preservando status, message e body em respostas não-2xx (incluindo 409 + jaRegistrado=true)', async () => {
      const mockResponseBody = {
        message: 'Presença já registrada previamente',
        jaRegistrado: true,
        checkin: { id: 'chk-100' }
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => mockResponseBody
      } as Response)

      // Executa a função real un-mocked
      const { fetchWithAuth } = await vi.importActual<typeof import('../api/apiClient')>('../api/apiClient')

      try {
        await fetchWithAuth('/checkin/qr', { method: 'POST' })
        expect.unreachable('Deveria ter lançado ApiError')
      } catch (err: any) {
        expect(err).toBeInstanceOf(ApiError)
        expect(err.status).toBe(409)
        expect(err.message).toBe('Presença já registrada previamente')
        expect(err.body).toEqual(mockResponseBody)
        expect(err.body.jaRegistrado).toBe(true)
      }
    })

    it('fetchWithAuth lança ApiError em outros erros HTTP (ex: 403 Forbidden)', async () => {
      const mockResponseBody = {
        error: 'Operador não autorizado',
        code: 'FORBIDDEN'
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => mockResponseBody
      } as Response)

      const { fetchWithAuth } = await vi.importActual<typeof import('../api/apiClient')>('../api/apiClient')

      try {
        await fetchWithAuth('/checkin/qr', { method: 'POST' })
        expect.unreachable('Deveria ter lançado ApiError')
      } catch (err: any) {
        expect(err).toBeInstanceOf(ApiError)
        expect(err.status).toBe(403)
        expect(err.message).toBe('Operador não autorizado')
        expect(err.body).toEqual(mockResponseBody)
      }
    })
  })

  describe('2. PortariaView — Check-in QR e Manual', () => {
    it('QR novo → sucesso', async () => {
      ;(apiClient.postWithAuth as any).mockResolvedValue({
        id: 'chk-1',
        forma: 'QR',
        membroId: 'mem-1'
      })

      render(<PortariaView />)

      const input = screen.getByPlaceholderText(/cole o QR Token/i)
      const button = screen.getByRole('button', { name: /Confirmar QR/i })

      fireEvent.change(input, { target: { value: 'dest-uuid-123' } })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Check-in por QR Code realizado com sucesso!')).toBeInTheDocument()
      })

      const msgDiv = screen.getByText('Check-in por QR Code realizado com sucesso!')
      expect(msgDiv.className).toContain('bg-green-100')
    })

    it('QR duplicado (409 + jaRegistrado=true) → aviso funcional', async () => {
      const duplicateError = new ApiError(409, 'Presença já registrada previamente', {
        message: 'Presença já registrada previamente',
        jaRegistrado: true,
        checkin: { id: 'chk-1' }
      })
      ;(apiClient.postWithAuth as any).mockRejectedValue(duplicateError)

      render(<PortariaView />)

      const input = screen.getByPlaceholderText(/cole o QR Token/i)
      const button = screen.getByRole('button', { name: /Confirmar QR/i })

      fireEvent.change(input, { target: { value: 'dest-uuid-dup' } })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Atenção: Presença JÁ REGISTRADA previamente!')).toBeInTheDocument()
      })

      const msgDiv = screen.getByText('Atenção: Presença JÁ REGISTRADA previamente!')
      expect(msgDiv.className).toContain('bg-amber-100')
    })

    it('Manual novo → sucesso', async () => {
      ;(apiClient.fetchWithAuth as any).mockResolvedValue({
        participantes: [
          {
            convocacaoDestinatarioId: 'dest-manual-1',
            membro: { id: 'mem-1', nome: 'Maria Silva', casaNome: 'Casa Central' },
            rsvpResposta: null,
            checkin: null
          }
        ]
      })
      ;(apiClient.postWithAuth as any).mockResolvedValue({
        id: 'chk-2',
        forma: 'MANUAL',
        membroId: 'mem-1'
      })

      render(<PortariaView />)

      // Carregar evento
      const evInput = screen.getByPlaceholderText(/Digite o ID do Evento/i)
      const loadBtn = screen.getByRole('button', { name: /Carregar Evento/i })
      fireEvent.change(evInput, { target: { value: 'ev-1' } })
      fireEvent.click(loadBtn)

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument()
      })

      const regBtn = screen.getByRole('button', { name: /Registrar Presença/i })
      fireEvent.click(regBtn)

      await waitFor(() => {
        expect(screen.getByText('Check-in manual de Maria Silva realizado com sucesso!')).toBeInTheDocument()
      })

      const msgDiv = screen.getByText('Check-in manual de Maria Silva realizado com sucesso!')
      expect(msgDiv.className).toContain('bg-green-100')
    })

    it('Manual duplicado (409 + jaRegistrado=true) → aviso funcional', async () => {
      ;(apiClient.fetchWithAuth as any).mockResolvedValue({
        participantes: [
          {
            convocacaoDestinatarioId: 'dest-manual-dup',
            membro: { id: 'mem-2', nome: 'Maria Silva', casaNome: 'Casa Central' },
            rsvpResposta: null,
            checkin: null
          }
        ]
      })

      const duplicateError = new ApiError(409, 'Presença já registrada previamente', {
        message: 'Presença já registrada previamente',
        jaRegistrado: true,
        checkin: { id: 'chk-existing' }
      })
      ;(apiClient.postWithAuth as any).mockRejectedValue(duplicateError)

      render(<PortariaView />)

      const evInput = screen.getByPlaceholderText(/Digite o ID do Evento/i)
      const loadBtn = screen.getByRole('button', { name: /Carregar Evento/i })
      fireEvent.change(evInput, { target: { value: 'ev-1' } })
      fireEvent.click(loadBtn)

      await waitFor(() => {
        expect(screen.getByText('Maria Silva')).toBeInTheDocument()
      })

      const regBtn = screen.getByRole('button', { name: /Registrar Presença/i })
      fireEvent.click(regBtn)

      await waitFor(() => {
        expect(screen.getByText('Atenção: Presença de Maria Silva JÁ REGISTRADA previamente!')).toBeInTheDocument()
      })

      const msgDiv = screen.getByText('Atenção: Presença de Maria Silva JÁ REGISTRADA previamente!')
      expect(msgDiv.className).toContain('bg-amber-100')
    })

    it('Erro 409 sem jaRegistrado=true continua tratado como ERRO', async () => {
      const genericConflictError = new ApiError(409, 'Conflito genérico de concorrência', {
        error: 'Conflito genérico de concorrência'
      })
      ;(apiClient.postWithAuth as any).mockRejectedValue(genericConflictError)

      render(<PortariaView />)

      const input = screen.getByPlaceholderText(/cole o QR Token/i)
      const button = screen.getByRole('button', { name: /Confirmar QR/i })

      fireEvent.change(input, { target: { value: 'dest-uuid-409-generic' } })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Conflito genérico de concorrência')).toBeInTheDocument()
      })

      const msgDiv = screen.getByText('Conflito genérico de concorrência')
      expect(msgDiv.className).toContain('bg-red-100')
    })

    it('Demais erros HTTP (400, 403, 404, 500) continuam tratados como ERRO', async () => {
      const forbiddenError = new ApiError(403, 'Operador não autorizado para operar portaria neste evento', {
        error: 'Operador não autorizado para operar portaria neste evento',
        code: 'FORBIDDEN'
      })
      ;(apiClient.postWithAuth as any).mockRejectedValue(forbiddenError)

      render(<PortariaView />)

      const input = screen.getByPlaceholderText(/cole o QR Token/i)
      const button = screen.getByRole('button', { name: /Confirmar QR/i })

      fireEvent.change(input, { target: { value: 'dest-uuid-forbidden' } })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Operador não autorizado para operar portaria neste evento')).toBeInTheDocument()
      })

      const msgDiv = screen.getByText('Operador não autorizado para operar portaria neste evento')
      expect(msgDiv.className).toContain('bg-red-100')
    })
  })
})
