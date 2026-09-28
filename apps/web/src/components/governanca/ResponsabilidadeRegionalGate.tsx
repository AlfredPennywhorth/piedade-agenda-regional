import { ReactNode, useEffect, useState } from 'react'
import { ApiError, fetchWithAuth, postWithAuth } from '../../api/apiClient'

interface AcessoResponsabilidade {
  acessoContaId: string
  regionalId: string
  regionalNome?: string | null
  ciente: boolean
  cienteEm: string | null
}

interface Responsabilidade {
  tipo: string
  natureza: string
  versao: string
  texto: string
  acessos: AcessoResponsabilidade[]
}

interface Props {
  children: ReactNode
  onCienciaRegistrada?: () => Promise<void> | void
}

export function ResponsabilidadeRegionalGate({ children, onCienciaRegistrada }: Props) {
  const [responsabilidade, setResponsabilidade] = useState<Responsabilidade | null>(null)
  const [verificado, setVerificado] = useState(false)
  const [confirmado, setConfirmado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const consultar = async () => {
    try {
      const data = await fetchWithAuth<Responsabilidade>(
        '/governanca/responsabilidade-regional'
      )
      setResponsabilidade(data)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setResponsabilidade(null)
      } else {
        setErro('Não foi possível verificar as responsabilidades de acesso.')
      }
    } finally {
      setVerificado(true)
    }
  }

  useEffect(() => {
    consultar()
  }, [])

  if (!verificado) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-600">Verificando responsabilidades...</p>
      </main>
    )
  }

  if (!responsabilidade) return <>{children}</>
  const responsabilidadeAtual = responsabilidade
  const pendente = responsabilidadeAtual.acessos.find(acesso => !acesso.ciente)
  if (!pendente) return <>{children}</>

  const registrar = async () => {
    if (!confirmado) {
      setErro('Marque a confirmação de ciência para continuar.')
      return
    }

    setEnviando(true)
    setErro(null)
    try {
      await postWithAuth('/governanca/responsabilidade-regional/ciencia', {
        acessoContaId: pendente.acessoContaId,
        versao: responsabilidadeAtual.versao,
        ciente: true,
      })
      await onCienciaRegistrada?.()
      await consultar()
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível registrar a ciência.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <section className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-lg p-6 space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Responsabilidade da Regional
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Ciência do responsável PMO
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Regional vinculada: {pendente.regionalNome || pendente.regionalId}
          </p>
        </header>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm leading-6 text-slate-700">
          {responsabilidadeAtual.texto}
        </div>

        <p className="text-xs text-slate-500">
          Versão do texto: {responsabilidadeAtual.versao}. Esta confirmação registra ciência das
          responsabilidades e não é solicitação de consentimento.
        </p>

        {erro && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={confirmado}
            onChange={event => setConfirmado(event.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>Li e estou ciente das responsabilidades atribuídas ao PMO da Regional.</span>
        </label>

        <button
          type="button"
          onClick={registrar}
          disabled={enviando}
          className="w-full rounded-lg bg-brand-700 px-4 py-3 font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {enviando ? 'Registrando...' : 'Registrar ciência e continuar'}
        </button>
      </section>
    </main>
  )
}
