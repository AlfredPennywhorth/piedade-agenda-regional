import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificacoesControl } from '../components/notificacoes/NotificacoesControl'
import * as apiClient from '../api/apiClient'
import { EventoDetalhe } from '../components/agenda/EventoDetalhe'

vi.mock('../api/apiClient')

describe('S10 - Notificações Frontend', () => {
  let mockPushManager: any
  let mockServiceWorkerReady: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockPushManager = {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockResolvedValue({
        endpoint: 'https://push.example.com',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' }
      })
    }

    mockServiceWorkerReady = Promise.resolve({
      pushManager: mockPushManager
    })

    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: { ready: mockServiceWorkerReady },
      writable: true
    })

    Object.defineProperty(window, 'PushManager', { value: {}, writable: true })
    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted')
      },
      writable: true
    })

    import.meta.env.VITE_VAPID_PUBLIC_KEY = 'BCqXYZ'
  })

  it('não chama requestPermission no mount', async () => {
    render(<NotificacoesControl />)
    expect(window.Notification.requestPermission).not.toHaveBeenCalled()
  })

  it('chama requestPermission ao clicar em ativar e faz subscribe', async () => {
    vi.mocked(apiClient.fetchWithAuth).mockResolvedValue({})

    render(<NotificacoesControl />)
    const btn = await screen.findByText('Ativar Notificações')
    fireEvent.click(btn)

    expect(window.Notification.requestPermission).toHaveBeenCalled()

    await waitFor(() => {
      expect(mockPushManager.subscribe).toHaveBeenCalled()
      expect(apiClient.fetchWithAuth).toHaveBeenCalledWith('/minha-agenda/notificacoes/subscribe', expect.any(Object))
    })
  })

  it('se permissão negada, não tenta subscribe', async () => {
    window.Notification.requestPermission = vi.fn().mockResolvedValue('denied')

    render(<NotificacoesControl />)
    const btn = await screen.findByText('Ativar Notificações')
    fireEvent.click(btn)

    await waitFor(() => {
      expect(mockPushManager.subscribe).not.toHaveBeenCalled()
      expect(screen.getByText('Não autorizado')).toBeInTheDocument()
    })
  })

  it('desativar chama backend e unsubscribe', async () => {
    const mockUnsubscribe = vi.fn().mockResolvedValue(true)
    mockPushManager.getSubscription.mockResolvedValue({
      endpoint: 'https://test.push',
      unsubscribe: mockUnsubscribe
    })

    render(<NotificacoesControl />)
    const btn = await screen.findByText('Desativar Notificações')
    fireEvent.click(btn)

    await waitFor(() => {
      expect(apiClient.fetchWithAuth).toHaveBeenCalledWith(expect.stringContaining('/minha-agenda/notificacoes/unsubscribe'), expect.objectContaining({ method: 'DELETE' }))
      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  it('mostra estado não suportado se PushManager não existir', async () => {
    Object.defineProperty(window, 'PushManager', { value: undefined, writable: true })
    
    render(<NotificacoesControl />)
    expect(await screen.findByText('Não suportado')).toBeInTheDocument()
  })
})

describe('S10 - Compartilhamento WhatsApp e Segurança SW', () => {
  it('wa.me possui link com texto codificado e sem dados sensíveis', () => {
    const mockWindowOpen = vi.fn()
    vi.stubGlobal('window', { ...window, open: mockWindowOpen })
    
    const mockItem = {
      destinatarioId: '1',
      eventoId: '1',
      convocacaoId: '1',
      evento: { titulo: 'Teste WP', inicioEm: '2024-01-01T10:00:00Z', fimEm: '2024-01-01T12:00:00Z', modalidade: 'ONLINE', possuiManha: true },
      convocacao: { status: 'ATIVA', exigeRsvp: false },
      rsvp: null
    }

    render(<EventoDetalhe item={mockItem as any} onClose={() => {}} />)
    
    const shareBtn = screen.getByTitle('Compartilhar no WhatsApp')
    fireEvent.click(shareBtn)

    expect(mockWindowOpen).toHaveBeenCalled()
    const calledUrl = mockWindowOpen.mock.calls[0][0]
    expect(calledUrl).toContain('wa.me/?text=')
    expect(calledUrl).not.toContain('undefined')
  })
})
