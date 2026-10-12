import { useEffect, useState } from 'react'

const ambiente = import.meta.env.VITE_APP_ENV === 'beta' ? 'BETA' : import.meta.env.VITE_APP_ENV === 'production' ? 'PRODUÇÃO' : (window.location.hostname.startsWith('beta.') ? 'BETA' : 'PRODUÇÃO')
const sha = (import.meta.env.VITE_BUILD_SHA || 'desenvolvimento').slice(0, 7)
const versao = import.meta.env.VITE_APP_VERSION || '1.1.0'

export function IdentificacaoVersao({ claro = false }: { claro?: boolean }) {
  return (
    <span className={claro ? 'text-xs text-brand-100' : 'text-xs text-slate-500'} data-testid="versao-pwa">
      {ambiente} · v{versao} · build {sha}
    </span>
  )
}

export function AvisoAtualizacaoPwa() {
  const [aguardando, setAguardando] = useState<ServiceWorker | null>(null)
  const [adiado, setAdiado] = useState(false)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let registro: ServiceWorkerRegistration | null = null
    let desmontado = false
    const solicitarAtualizacao = () => {
      if (document.visibilityState === 'visible') void registro?.update().catch(() => {})
    }
    const observar = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting && navigator.serviceWorker.controller) setAguardando(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const instalando = reg.installing
        instalando?.addEventListener('statechange', () => {
          if (instalando.state === 'installed' && navigator.serviceWorker.controller) {
            setAguardando(reg.waiting || instalando)
            setAdiado(false)
          }
        })
      })
    }
    void navigator.serviceWorker.ready.then(reg => {
      if (desmontado) return
      registro = reg
      observar(reg)
      solicitarAtualizacao()
    }).catch(() => {})
    const verificar = () => solicitarAtualizacao()
    window.addEventListener('focus', verificar)
    document.addEventListener('visibilitychange', solicitarAtualizacao)
    const timer = window.setInterval(verificar, 60 * 60 * 1000)
    return () => {
      desmontado = true
      window.removeEventListener('focus', verificar)
      document.removeEventListener('visibilitychange', solicitarAtualizacao)
      window.clearInterval(timer)
    }
  }, [])

  const atualizar = () => {
    if (!aguardando) return
    if (!window.confirm('Atualizar a Agenda agora? Salve qualquer formulário em edição antes de continuar.')) return
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
    aguardando.postMessage({ type: 'SKIP_WAITING' })
  }

  if (!aguardando || adiado) return null
  return (
    <div role="status" className="fixed bottom-16 inset-x-3 z-[80] mx-auto max-w-md rounded-xl border border-blue-200 bg-white p-4 shadow-xl text-sm text-slate-900">
      <p className="font-semibold">Nova versão da Agenda disponível</p>
      <p className="mt-1 text-slate-600">Salve os dados que estiver editando antes de atualizar.</p>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setAdiado(true)} className="rounded-lg border px-3 py-2">Depois</button>
        <button type="button" onClick={atualizar} className="rounded-lg bg-blue-800 px-3 py-2 text-white">Atualizar agora</button>
      </div>
    </div>
  )
}
