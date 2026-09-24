import { FormEvent, useEffect, useState } from 'react'
import { ApiError, fetchPublic, postPublic } from '../../api/apiClient'

interface CadastroInfo {
  evento: {
    id: string
    titulo: string
    inicioEm: string
    fimEm: string
  }
}

interface CadastroConvidadoProps {
  token: string
}

export function CadastroConvidadoView({ token }: CadastroConvidadoProps) {
  const [info, setInfo] = useState<CadastroInfo | null>(null)
  const [nome, setNome] = useState('')
  const [localidade, setLocalidade] = useState('')
  const [referencia, setReferencia] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [erro, setErro] = useState('')
  const [tituloIndisponivel, setTituloIndisponivel] = useState('Cadastro indisponível')
  const [enviado, setEnviado] = useState(false)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true

    fetchPublic<CadastroInfo>(`/portaria-publica/cadastro/${encodeURIComponent(token)}`)
      .then(data => {
        if (ativo) setInfo(data)
      })
      .catch(error => {
        if (!ativo) return

        if (error instanceof ApiError) {
          const code = (error.body as { code?: string } | undefined)?.code

          if (code === 'PORTARIA_FECHADA') {
            setTituloIndisponivel('Reunião encerrada')
            setErro('A Portaria desta reunião já foi fechada. Não é mais possível enviar novos cadastros.')
          } else if (code === 'CREDENCIAL_EXPIRADA') {
            setTituloIndisponivel('Cadastro encerrado')
            setErro('O período de cadastro de convidados desta reunião terminou.')
          } else if (code === 'CREDENCIAL_INDISPONIVEL') {
            setTituloIndisponivel('Link indisponível')
            setErro('Este link não está mais ativo. Se a Portaria ainda estiver aberta, solicite um novo link ao porteiro.')
          } else if (code === 'NOT_FOUND') {
            setTituloIndisponivel('Link inválido')
            setErro('Este link de cadastro não foi reconhecido.')
          } else {
            setErro(error.message)
          }
        } else {
          setErro('Não foi possível abrir o cadastro.')
        }
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })

    return () => {
      ativo = false
    }
  }, [token])

  const enviar = async (event: FormEvent) => {
    event.preventDefault()
    setErro('')

    try {
      await postPublic(
        `/portaria-publica/cadastro/${encodeURIComponent(token)}`,
        {
          nome,
          localidade,
          referencia: referencia || null,
          observacoes: observacoes || null,
        }
      )
      setEnviado(true)
    } catch (error) {
      if (error instanceof ApiError) {
        const code = (error.body as { code?: string } | undefined)?.code
        if (code === 'PORTARIA_FECHADA') {
          setInfo(null)
          setTituloIndisponivel('Reunião encerrada')
          setErro('A Portaria desta reunião foi fechada antes do envio. Não é mais possível concluir o cadastro.')
          return
        }
        if (code === 'CREDENCIAL_EXPIRADA') {
          setInfo(null)
          setTituloIndisponivel('Cadastro encerrado')
          setErro('O período de cadastro de convidados desta reunião terminou antes do envio.')
          return
        }
        if (code === 'CREDENCIAL_INDISPONIVEL') {
          setInfo(null)
          setTituloIndisponivel('Link indisponível')
          setErro('Este link deixou de estar ativo. Se a Portaria ainda estiver aberta, solicite um novo link ao porteiro.')
          return
        }
        setErro(error.message)
      } else {
        setErro('Não foi possível enviar o cadastro.')
      }
    }
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-sm text-slate-600">Abrindo cadastro da reunião...</p>
      </main>
    )
  }

  if (!info) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h1 className="text-xl font-semibold text-slate-900">{tituloIndisponivel}</h1>
          <p role="alert" className="mt-3 text-sm text-red-700">{erro}</p>
        </div>
      </main>
    )
  }

  if (enviado) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm border border-slate-200 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Cadastro enviado</h1>
          <p className="mt-3 text-sm text-slate-600">
            Seus dados foram recebidos. Apresente-se ao porteiro para validar sua presença.
          </p>
          <p className="mt-4 text-sm font-medium text-slate-800">{info.evento.titulo}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-sm border border-slate-200">
        <h1 className="text-xl font-semibold text-slate-900">Cadastro de convidado</h1>
        <p className="mt-1 text-sm text-slate-600">{info.evento.titulo}</p>
        <p className="mt-3 text-xs text-slate-500">
          Preencha seus dados. A presença será confirmada pelo porteiro na entrada.
        </p>

        <form onSubmit={enviar} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Nome completo</span>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              required
              maxLength={120}
              autoComplete="name"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Localidade / Casa de Oração</span>
            <input
              value={localidade}
              onChange={e => setLocalidade(e.target.value)}
              required
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Referência</span>
            <input
              value={referencia}
              onChange={e => setReferencia(e.target.value)}
              maxLength={120}
              placeholder="Ex.: convidado de João"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Observações</span>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              maxLength={300}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
            />
          </label>

          {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}

          <button
            type="submit"
            className="w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Enviar cadastro
          </button>
        </form>
      </div>
    </main>
  )
}
