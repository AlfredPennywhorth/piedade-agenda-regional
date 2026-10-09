import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IosInstallPrompt, iosInstallPromptInternals } from '../components/pwa/IosInstallPrompt'

function configurarNavigatorIos({ standalone = false }: { standalone?: boolean } = {}) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  })
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: 'iPhone',
  })
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: 5,
  })
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: standalone,
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  })
}

function configurarNavigatorIpadDesktop() {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
  })
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: 'MacIntel',
  })
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: 5,
  })
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: false,
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  })
}

function configurarNavigatorChromeIos() {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/154.0.0.0 Mobile/15E148 Safari/604.1',
  })
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: 'iPhone',
  })
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: 5,
  })
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: false,
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  })
}

function configurarNavigatorBraveIos() {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1 Brave/1.78',
  })
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: 'iPhone',
  })
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: 5,
  })
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: false,
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  })
}

function configurarNavigatorDesktop() {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/154.0.0.0',
  })
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: 'Win32',
  })
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: 0,
  })
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: false,
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  })
}

describe('IosInstallPrompt', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('exibe orientação em iPhone fora do modo standalone', async () => {
    configurarNavigatorIos()

    render(<IosInstallPrompt />)

    expect(await screen.findByText('Instale a Agenda neste dispositivo')).toBeDefined()
    expect(screen.getByText(/Adicionar à Tela de Início/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Agora não' })).toBeDefined()
  })

  it('exibe orientação neutra em iPad no modo desktop', async () => {
    configurarNavigatorIpadDesktop()

    render(<IosInstallPrompt />)

    expect(await screen.findByText('Instale a Agenda neste dispositivo')).toBeDefined()
    expect(screen.getByText(/No navegador, toque em/)).toBeDefined()
    expect(screen.queryByText(/iPhone/i)).toBeNull()
    expect(screen.queryByText(/Safari/i)).toBeNull()
  })

  it('não mostra o passo a passo de Adicionar à Tela de Início fora do Safari', async () => {
    configurarNavigatorChromeIos()

    render(<IosInstallPrompt />)

    expect(await screen.findByText('Instale a Agenda neste dispositivo')).toBeDefined()
    expect(screen.getByText(/abra este endereço no Safari/i)).toBeDefined()
    expect(screen.queryByText(/Adicionar à Tela de Início/)).toBeNull()
  })

  it('não mostra o tutorial completo no Brave para iOS', async () => {
    configurarNavigatorBraveIos()

    render(<IosInstallPrompt />)

    expect(await screen.findByText('Instale a Agenda neste dispositivo')).toBeDefined()
    expect(screen.getByText(/abra este endereço no Safari/i)).toBeDefined()
    expect(screen.queryByText(/Adicionar à Tela de Início/)).toBeNull()
  })

  it('não exibe em desktop', () => {
    configurarNavigatorDesktop()

    render(<IosInstallPrompt />)

    expect(screen.queryByText('Instale a Agenda neste dispositivo')).toBeNull()
  })

  it('não exibe quando já está instalado em modo standalone', () => {
    configurarNavigatorIos({ standalone: true })

    render(<IosInstallPrompt />)

    expect(screen.queryByText('Instale a Agenda neste dispositivo')).toBeNull()
  })

  it('persiste dispensa e não volta a exibir dentro de 14 dias', () => {
    configurarNavigatorIos()
    const agora = 1_800_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(agora)

    const { unmount } = render(<IosInstallPrompt />)
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }))

    expect(window.localStorage.getItem(iosInstallPromptInternals.DISPENSA_STORAGE_KEY))
      .toBe(String(agora))

    unmount()
    render(<IosInstallPrompt />)

    expect(screen.queryByText('Instale a Agenda neste dispositivo')).toBeNull()
  })

  it('volta a exibir após expirar o período de dispensa', async () => {
    configurarNavigatorIos()
    const agora = 1_800_000_000_000
    window.localStorage.setItem(
      iosInstallPromptInternals.DISPENSA_STORAGE_KEY,
      String(agora - iosInstallPromptInternals.DISPENSA_MS - 1)
    )
    vi.spyOn(Date, 'now').mockReturnValue(agora)

    render(<IosInstallPrompt />)

    expect(await screen.findByText('Instale a Agenda neste dispositivo')).toBeDefined()
  })
})
