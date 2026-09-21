import { FormEvent, useState } from 'react'
import { ativacaoSchema, loginSchema } from '@piedade/shared'
import { ApiError, postPublic, salvarTokenSessao } from '../../api/apiClient'

interface AuthViewProps {
  tokenAtivacao?: string | null
  onAuthenticated: () => void | Promise<void>
  onCancelarAtivacao?: () => void
}

type RespostaSessao = { sessionToken: string }

export function AuthView({
  tokenAtivacao,
  onAuthenticated,
  onCancelarAtivacao,
}: AuthViewProps) {
  const ativando = Boolean(tokenAtivacao)
  const [celular, setCelular] = useState('')
  const [pin, setPin] = useState('')
  const [confirmacaoPin, setConfirmacaoPin] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setErro(null)

    const validacao = ativando
      ? ativacaoSchema.safeParse({
          token: tokenAtivacao,
          celular,
          pin,
          confirmacaoPin,
        })
      : loginSchema.safeParse({ identificador: celular, pin })

    if (!validacao.success) {
      setErro(validacao.error.issues[0]?.message ?? 'Confira os dados informados.')
      return
    }

    setEnviando(true)
    try {
      const resposta = ativando
        ? await postPublic<RespostaSessao>('/auth/ativar', validacao.data)
        : await postPublic<RespostaSessao>('/auth/login', validacao.data)

      salvarTokenSessao(resposta.sessionToken)
      await onAuthenticated()
    } catch (error) {
      if (error instanceof ApiError) {
        setErro(
          error.status === 429
            ? 'Muitas tentativas. Aguarde alguns instantes e tente novamente.'
            : error.message
        )
      } else {
        setErro('Não foi possível concluir o acesso. Tente novamente.')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <section className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-lg p-6 space-y-6">
        <header className="space-y-2 text-center">
          <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
            Agenda Regional São Paulo
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            {ativando ? 'Ativar conta de acesso' : 'Entrar'}
          </h1>
          <p className="text-sm text-slate-600">
            {ativando
              ? 'Confirme seu celular cadastrado e escolha um PIN pessoal de seis dígitos.'
              : 'Use o celular cadastrado e seu PIN pessoal.'}
          </p>
        </header>

        {erro && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="auth-celular" className="block text-sm font-semibold text-slate-700 mb-1">
              Celular
            </label>
            <input
              id="auth-celular"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={celular}
              onChange={event => setCelular(event.target.value)}
              placeholder="(11) 99999-9999"
              disabled={enviando}
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>

          <div>
            <label htmlFor="auth-pin" className="block text-sm font-semibold text-slate-700 mb-1">
              PIN de seis dígitos
            </label>
            <input
              id="auth-pin"
              type="password"
              inputMode="numeric"
              autoComplete={ativando ? 'new-password' : 'current-password'}
              maxLength={6}
              value={pin}
              onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={enviando}
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base tracking-[0.35em] focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>

          {ativando && (
            <div>
              <label htmlFor="auth-confirmacao-pin" className="block text-sm font-semibold text-slate-700 mb-1">
                Confirmar PIN
              </label>
              <input
                id="auth-confirmacao-pin"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={confirmacaoPin}
                onChange={event =>
                  setConfirmacaoPin(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
                disabled={enviando}
                className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base tracking-[0.35em] focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-brand-700 px-4 py-3 font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {enviando ? 'Processando...' : ativando ? 'Ativar e entrar' : 'Entrar'}
          </button>

          {ativando && onCancelarAtivacao && (
            <button
              type="button"
              onClick={onCancelarAtivacao}
              disabled={enviando}
              className="w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Voltar para o login
            </button>
          )}
        </form>

        <p className="text-xs text-slate-500 text-center">
          O PIN é pessoal. Não compartilhe links de ativação, PINs ou códigos de sessão.
        </p>
      </section>
    </main>
  )
}
