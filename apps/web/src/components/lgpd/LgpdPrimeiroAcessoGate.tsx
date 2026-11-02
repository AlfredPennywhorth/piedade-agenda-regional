import { useEffect, useState, type ReactNode } from 'react'
import { fetchWithAuth, postWithAuth, ApiError } from '../../api/apiClient'

type AvisoPrivacidade = {
  versao: string
  titulo: string
  paragrafos: string[]
  hash: string
  ciente: boolean
  registradoEm: string | null
}

export function LgpdPrimeiroAcessoGate({ children, onSair, onCienciaRegistrada }: {
  children: ReactNode
  onSair: () => Promise<void>
  onCienciaRegistrada?: () => Promise<void> | void
}) {
  const [aviso, setAviso] = useState<AvisoPrivacidade | null>(null)
  const [consultando, setConsultando] = useState(true)
  const [lido, setLido] = useState(false)
  const [ciente, setCiente] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const consultar = async () => {
    setConsultando(true)
    setErro('')
    try {
      setAviso(await fetchWithAuth<AvisoPrivacidade>('/lgpd'))
    } catch {
      setErro('Não foi possível consultar o aviso de privacidade. Tente novamente.')
    } finally {
      setConsultando(false)
    }
  }
  useEffect(() => { void consultar() }, [])

  if (!consultando && aviso?.ciente) return <>{children}</>

  const registrar = async () => {
    if (!aviso || !lido || !ciente) return
    setEnviando(true)
    setErro('')
    try {
      await postWithAuth('/lgpd/ciencia', {
        versao: aviso.versao,
        hash: aviso.hash,
        leituraConfirmada: true,
        tratamentoNecessarioCiente: true,
      })
      await onCienciaRegistrada?.()
      await consultar()
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível salvar sua confirmação.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-lg space-y-5" aria-labelledby="titulo-lgpd">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Agenda Regional São Paulo</p>
          <h1 id="titulo-lgpd" className="text-xl sm:text-2xl font-bold text-slate-900">Privacidade e proteção dos dados</h1>
          <p className="text-sm text-slate-600">
            Antes de utilizar a Agenda, consulte as finalidades de tratamento dos dados pessoais necessários ao serviço.
            Sua confirmação fica registrada por pessoa e por versão do aviso.
          </p>
        </header>

        {aviso && !aviso.ciente && (
          <>
            <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-sm leading-6 text-slate-700" tabIndex={0} aria-label="Texto integral do aviso de privacidade">
              <h2 className="font-bold text-slate-900">{aviso.titulo}</h2>
              {aviso.paragrafos.map((p, index) => <p key={index}>{p}</p>)}
              <p className="text-xs text-slate-500">Versão {aviso.versao}.</p>
            </div>
            <div className="space-y-3">
              <label className="flex items-start gap-3 text-sm text-slate-800">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={lido}
                  onChange={e => setLido(e.target.checked)} />
                <span>Confirmo que li o Aviso de Privacidade e conheço as finalidades informadas.</span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-800">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={ciente}
                  onChange={e => setCiente(e.target.checked)} />
                <span>Estou ciente de que o tratamento dos dados mínimos descritos é necessário para autenticação,
                  organização das reuniões, convocações e controle de presença da Agenda Regional.</span>
              </label>
            </div>
          </>
        )}

        {erro && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
        {consultando && <p role="status" className="text-sm text-slate-600">Verificando a ciência do aviso...</p>}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <button type="button" onClick={() => void onSair()}
            className="rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-700">
            Sair
          </button>
          {!aviso && <button type="button" onClick={() => void consultar()}
            className="rounded-lg bg-brand-700 px-4 py-3 font-semibold text-white">Tentar novamente</button>}
          {aviso && !aviso.ciente && <button type="button" onClick={() => void registrar()}
            disabled={!lido || !ciente || enviando || consultando}
            className="rounded-lg bg-brand-700 px-4 py-3 font-semibold text-white disabled:opacity-50">
            {enviando ? 'Registrando ciência...' : 'Confirmar ciência e acessar a Agenda'}
          </button>}
        </div>
      </section>
    </main>
  )
}
