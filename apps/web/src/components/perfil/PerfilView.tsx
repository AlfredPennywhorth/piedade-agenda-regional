import { FormEvent, useEffect, useState } from 'react'
import { alterarPinSchema, atualizarPerfilSchema } from '@piedade/shared'
import {
  ApiError,
  fetchWithAuth,
  limparTokenSessao,
  patchWithAuth,
  postWithAuth,
} from '../../api/apiClient'

interface PerfilData {
  id: string
  nome: string
  celular: string | null
  codigoCarteirinha: string | null
  dataOrdenacao: string | null
  casaId: string
  casa: {
    nome: string
    codigo: string | null
    setor: string
    administracao: string
    regional: string
  }
  ativo: boolean
  autenticacaoAtiva: boolean
  ativadoEm: string | null
  conta: {
    id: string
    status: string
  }
}

export function PerfilView() {
  const [perfil, setPerfil] = useState<PerfilData | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  const [celular, setCelular] = useState('')
  const [pinAtualCelular, setPinAtualCelular] = useState('')
  const [salvandoCelular, setSalvandoCelular] = useState(false)

  const [pinAtual, setPinAtual] = useState('')
  const [novoPin, setNovoPin] = useState('')
  const [confirmacaoNovoPin, setConfirmacaoNovoPin] = useState('')
  const [salvandoPin, setSalvandoPin] = useState(false)

  const carregar = async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await fetchWithAuth<PerfilData>('/auth/me')
      setPerfil(data)
      setCelular(data.celular || '')
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível carregar seu perfil.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const salvarCelular = async (event: FormEvent) => {
    event.preventDefault()
    setErro(null)
    setSucesso(null)

    const parsed = atualizarPerfilSchema.safeParse({
      celular,
      pinAtual: pinAtualCelular,
    })

    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? 'Confira os dados informados.')
      return
    }

    setSalvandoCelular(true)
    try {
      const resposta = await patchWithAuth<{ message: string; celular: string }>(
        '/auth/me',
        parsed.data
      )
      setSucesso(resposta.message)
      setPinAtualCelular('')
      await carregar()
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível atualizar o celular.')
    } finally {
      setSalvandoCelular(false)
    }
  }

  const alterarPin = async (event: FormEvent) => {
    event.preventDefault()
    setErro(null)
    setSucesso(null)

    const parsed = alterarPinSchema.safeParse({
      pinAtual,
      novoPin,
      confirmacaoNovoPin,
    })

    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? 'Confira os PINs informados.')
      return
    }

    setSalvandoPin(true)
    try {
      const resposta = await postWithAuth<{ message: string; requerNovoLogin: boolean }>(
        '/auth/me/alterar-pin',
        parsed.data
      )
      setSucesso(resposta.message)

      if (resposta.requerNovoLogin) {
        limparTokenSessao()
        window.setTimeout(() => window.location.reload(), 1200)
      }
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível alterar o PIN.')
    } finally {
      setSalvandoPin(false)
    }
  }

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="p-8 text-center text-sm text-slate-500">
        Carregando seu cadastro...
      </div>
    )
  }

  if (!perfil) {
    return (
      <div className="p-6">
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {erro || 'Perfil indisponível.'}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Meu Cadastro</h2>
        <p className="text-xs text-slate-500">
          Consulte seus dados institucionais e mantenha seus dados de acesso atualizados.
        </p>
      </div>

      {erro && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {sucesso && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {sucesso}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-slate-800">Dados institucionais</h3>
          <p className="text-xs text-slate-500">
            Estes dados são mantidos administrativamente e não podem ser alterados nesta tela.
          </p>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs font-semibold text-slate-500">Nome</dt>
            <dd className="font-medium text-slate-800">{perfil.nome}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-500">Código da carteirinha</dt>
            <dd className="font-mono text-slate-800">{perfil.codigoCarteirinha || 'Não informado'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-500">Data de ordenação</dt>
            <dd className="text-slate-800">{perfil.dataOrdenacao || 'Não informada'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-500">Status da conta</dt>
            <dd className="text-slate-800">{perfil.conta.status}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold text-slate-500">Casa de Oração</dt>
            <dd className="text-slate-800">
              {perfil.casa.nome}
              {perfil.casa.codigo ? ` (${perfil.casa.codigo})` : ''}
            </dd>
            <dd className="text-xs text-slate-500 mt-1">
              {perfil.casa.regional} · {perfil.casa.administracao} · Setor {perfil.casa.setor}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-slate-800">Celular de acesso</h3>
          <p className="text-xs text-slate-500">
            O celular é usado como identificador no login. Confirme seu PIN atual para alterá-lo.
          </p>
        </div>

        <form onSubmit={salvarCelular} className="space-y-3">
          <div>
            <label htmlFor="perfil-celular" className="block text-xs font-semibold text-slate-700 mb-1">
              Celular
            </label>
            <input
              id="perfil-celular"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={celular}
              onChange={event => setCelular(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              disabled={salvandoCelular}
            />
          </div>

          <div>
            <label htmlFor="perfil-pin-celular" className="block text-xs font-semibold text-slate-700 mb-1">
              PIN atual
            </label>
            <input
              id="perfil-pin-celular"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={6}
              value={pinAtualCelular}
              onChange={event => setPinAtualCelular(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-[0.3em]"
              disabled={salvandoCelular}
            />
          </div>

          <button
            type="submit"
            disabled={salvandoCelular}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {salvandoCelular ? 'Salvando...' : 'Atualizar celular'}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-slate-800">Alterar PIN</h3>
          <p className="text-xs text-slate-500">
            Após a alteração, todas as sessões serão encerradas e será necessário entrar novamente.
          </p>
        </div>

        <form onSubmit={alterarPin} className="space-y-3">
          <div>
            <label htmlFor="perfil-pin-atual" className="block text-xs font-semibold text-slate-700 mb-1">
              PIN atual
            </label>
            <input
              id="perfil-pin-atual"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={6}
              value={pinAtual}
              onChange={event => setPinAtual(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-[0.3em]"
              disabled={salvandoPin}
            />
          </div>

          <div>
            <label htmlFor="perfil-novo-pin" className="block text-xs font-semibold text-slate-700 mb-1">
              Novo PIN
            </label>
            <input
              id="perfil-novo-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={novoPin}
              onChange={event => setNovoPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-[0.3em]"
              disabled={salvandoPin}
            />
          </div>

          <div>
            <label htmlFor="perfil-confirmar-pin" className="block text-xs font-semibold text-slate-700 mb-1">
              Confirmar novo PIN
            </label>
            <input
              id="perfil-confirmar-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={confirmacaoNovoPin}
              onChange={event => setConfirmacaoNovoPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-[0.3em]"
              disabled={salvandoPin}
            />
          </div>

          <button
            type="submit"
            disabled={salvandoPin}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {salvandoPin ? 'Alterando...' : 'Alterar PIN'}
          </button>
        </form>
      </section>
    </div>
  )
}
