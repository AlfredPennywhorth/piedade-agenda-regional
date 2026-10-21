import { useRef, useState } from 'react'
import { CentralAjuda } from './CentralAjuda'

/** Ajuda local para telas fora do MainLayout; sem acesso aos artigos administrativos. */
export function AjudaIsolada({
  assunto,
  assuntosPermitidos = ['inicio', assunto],
}: {
  assunto: string
  assuntosPermitidos?: readonly string[]
}) {
  const [aberta, setAberta] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => setAberta(true)}
        className="my-2 rounded-lg border border-white bg-brand-900 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-900"
      >
        Ajuda
      </button>
      {aberta && (
        <CentralAjuda
          assunto={assunto}
          assuntosPermitidos={assuntosPermitidos}
          retornoFoco={botao.current}
          onClose={() => setAberta(false)}
        />
      )}
    </>
  )
}
