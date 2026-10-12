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

