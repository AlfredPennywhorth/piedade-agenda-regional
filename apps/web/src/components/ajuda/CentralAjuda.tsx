import { useEffect, useRef, useState } from 'react'
import type { CapacidadesFrontend } from '../layout/MainLayout'
import { obterArtigos, pesquisarArtigos } from './artigos'

export function CentralAjuda({
  capacidades,
  assunto,
  retornoFoco,
  onClose,
  assuntosPermitidos,
}: {
  capacidades?: CapacidadesFrontend
  assunto: string
  retornoFoco: HTMLElement | null
  assuntosPermitidos?: readonly string[]
  onClose: () => void
}) {
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState(assunto)
  const dialogo = useRef<HTMLDialogElement>(null)
  const buscaRef = useRef<HTMLInputElement>(null)
  const artigos = obterArtigos(capacidades, assuntosPermitidos)
  const artigo = artigos.find(a => a.id === selecionado)
  const voltarCentral = () => {
    setSelecionado('')
    setBusca('')
    if (dialogo.current) dialogo.current.scrollTop = 0
    buscaRef.current?.focus()
  }

  useEffect(() => {
    const focoAnterior = retornoFoco
    const dialog = dialogo.current
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (focoAnterior?.isConnected) focoAnterior.focus()
    }
  }, [])

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="titulo-ajuda"
      onCancel={onClose}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_1rem)] max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 text-slate-900 shadow-xl backdrop:bg-slate-900/50 sm:p-6"
    >
      <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center justify-between gap-3 bg-white py-2">
        <h2 id="titulo-ajuda" className="text-lg font-semibold">
          Central de Ajuda
        </h2>
        {(artigo || busca) && (
          <button
            type="button"
            onClick={voltarCentral}
            className="rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-900"
          >
            Voltar à Central de Ajuda
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2">
          Fechar ajuda
        </button>
      </div>
      <label className="block text-sm font-medium" htmlFor="buscar-ajuda">
        Pesquisar ajuda por assunto ou código de tela
      </label>
      <input
        ref={buscaRef}
        autoFocus
        id="buscar-ajuda"
        type="search"
        value={busca}
        onChange={e => {
          setBusca(e.target.value)
          setSelecionado('')
        }}
        className="mt-1 mb-4 w-full rounded-lg border border-slate-300 p-3"
      />
      {artigo ? (
        <article>
          <h3 className="text-lg font-semibold">{artigo.titulo}</h3>
          <p className="my-2 text-xs text-slate-500">{artigo.codigos.join(' · ')}</p>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {artigo.passos.map(p => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          <h4 className="mt-4 font-semibold">Cuidados e permissões</h4>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
            {artigo.cuidados.map(p => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </article>
      ) : (
        <div>
          <p role="status" className="mb-2 text-sm text-slate-600">
            {pesquisarArtigos(artigos, busca).length} assuntos disponíveis para seu perfil
          </p>
          <ul className="space-y-2">
            {pesquisarArtigos(artigos, busca).map(a => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setSelecionado(a.id)}
                  className="w-full rounded-lg bg-slate-100 p-3 text-left"
                >
                  {a.titulo}
                  <span className="block text-xs text-slate-500">{a.codigos.join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
          {pesquisarArtigos(artigos, busca).length === 0 && (
            <p>Nenhum assunto encontrado. Tente outro termo ou código.</p>
          )}
        </div>
      )}
      <p data-screen-code="AGD-SHR-006" className="mt-5 text-xs text-slate-500">
        Tela AGD-SHR-006
      </p>
      <p className="mt-5 text-xs text-slate-500">
        Orientações conforme seu perfil. Para solicitar suporte, informe o código da tela e a
        mensagem de erro, sem dados pessoais.
      </p>
    </dialog>
  )
}
