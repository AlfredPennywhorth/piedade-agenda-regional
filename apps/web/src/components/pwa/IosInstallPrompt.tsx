import { useEffect, useState } from 'react'

const DISPENSA_STORAGE_KEY = 'pwa-ios-install-dismissed-at'
const DISPENSA_DIAS = 14
const DISPENSA_MS = DISPENSA_DIAS * 24 * 60 * 60 * 1000

type NavigatorStandalone = Navigator & {
  standalone?: boolean
}

function dispositivoIos() {
  const userAgent = window.navigator.userAgent.toLocaleLowerCase('en-US')
  const iosClassico = /iphone|ipad|ipod/.test(userAgent)
  const ipadModoDesktop =
    window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1
  return iosClassico || ipadModoDesktop
}

function navegadorSafariIos() {
  const userAgent = window.navigator.userAgent.toLocaleLowerCase('en-US')
  return (
    userAgent.includes('safari') &&
    !/(crios|fxios|edgios|opios|duckduckgo|gsa)/.test(userAgent)
  )
}

function emModoStandalone() {
  return (
    (window.navigator as NavigatorStandalone).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  )
}

function avisoDispensadoRecentemente() {
  try {
    const valor = window.localStorage.getItem(DISPENSA_STORAGE_KEY)
    if (!valor) return false
    const timestamp = Number(valor)
    return Number.isFinite(timestamp) && Date.now() - timestamp < DISPENSA_MS
  } catch {
    return false
  }
}

function registrarDispensa() {
  try {
    window.localStorage.setItem(DISPENSA_STORAGE_KEY, String(Date.now()))
  } catch {
    // Falha de storage não deve impedir o usuário de fechar o aviso.
  }
}

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16V3m0 0 4 4m-4-4L8 7M5 11v8h14v-8"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-5 w-5 items-center justify-center rounded border border-current text-base leading-none"
    >
      +
    </span>
  )
}

export function IosInstallPrompt() {
  const [visivel, setVisivel] = useState(false)
  const safariIos = navegadorSafariIos()

  useEffect(() => {
    setVisivel(
      dispositivoIos() &&
      !emModoStandalone() &&
      !avisoDispensadoRecentemente()
    )
  }, [])

  if (!visivel) return null

  const dispensar = () => {
    registrarDispensa()
    setVisivel(false)
  }

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="ios-install-title"
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="ios-install-title" className="text-base font-semibold text-slate-900">
            Instale a Agenda neste dispositivo
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Abra a Agenda pela Tela de Início, como um aplicativo.
          </p>
        </div>
        <button
          type="button"
          onClick={dispensar}
          aria-label="Fechar orientação de instalação"
          className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
        >
          ×
        </button>
      </div>

      {safariIos ? (
        <ol className="mt-4 space-y-3 text-sm text-slate-700">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-brand-700">
              <ShareIcon />
            </span>
            <span>
              <strong>1.</strong> No navegador, toque em <strong>Compartilhar</strong>.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 text-brand-700">
              <PlusIcon />
            </span>
            <span>
              <strong>2.</strong> Role a lista e escolha <strong>Adicionar à Tela de Início</strong>.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-slate-100 px-1 text-xs font-semibold text-slate-700"
            >
              3
            </span>
            <span>
              Toque em <strong>Adicionar</strong> no canto superior direito.
            </span>
          </li>
        </ol>
      ) : (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          Para instalar pela Tela de Início, abra este endereço no Safari e continue a partir dele.
        </p>
      )}

      <button
        type="button"
        onClick={dispensar}
        className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Agora não
      </button>
    </aside>
  )
}

export const iosInstallPromptInternals = {
  DISPENSA_STORAGE_KEY,
  DISPENSA_MS,
}
