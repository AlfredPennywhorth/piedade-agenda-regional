import { useState, useEffect, useRef } from 'react'
import { fetchWithAuth, ApiError } from '../../api/apiClient'
import type { AcompanhamentoRsvpResponse } from '@piedade/shared'

interface Props {
  convocacaoId: string
  onClose: () => void
}

const mapStatusRsvpLabel: Record<string, string> = {
  PARTICIPAREI: 'Participarei',
  NAO_PARTICIPAREI: 'Não Participarei',
  NAO_SEI: 'Não Sei',
  SEM_RESPOSTA: 'Sem Resposta'
}

const mapStatusRsvpColor: Record<string, string> = {
  PARTICIPAREI: 'bg-green-100 text-green-800',
  NAO_PARTICIPAREI: 'bg-red-100 text-red-800',
  NAO_SEI: 'bg-yellow-100 text-yellow-800',
  SEM_RESPOSTA: 'bg-slate-100 text-slate-800'
}

export function AcompanhamentoRsvpModal({ convocacaoId, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' ? document.activeElement as HTMLElement | null : null
  )
  const [data, setData] = useState<AcompanhamentoRsvpResponse['data']>([])
  const [meta, setMeta] = useState<AcompanhamentoRsvpResponse['meta']>({ page: 1, lastPage: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAcompanhamento = async (page: number) => {
    setLoading(true)
    setError(null)
    setData([])
    try {
      const response = await fetchWithAuth<AcompanhamentoRsvpResponse>(
        `/convocacoes/${convocacaoId}/acompanhamento-rsvp?page=${page}&limit=50`
      )
      setData(response.data)
      setMeta(response.meta)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 403) {
        setError('Acesso não autorizado para acompanhar RSVP desta convocação')
      } else if (err instanceof ApiError) {
        setError(err.message || 'Erro ao carregar acompanhamento de RSVP')
      } else if (err instanceof Error) {
        setError(err.message || 'Erro ao carregar acompanhamento de RSVP')
      } else {
        setError('Erro ao carregar acompanhamento de RSVP')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAcompanhamento(1)
  }, [convocacaoId])

  useEffect(() => {
    closeButtonRef.current?.focus()
    return () => triggerRef.current?.focus()
  }, [])

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return

    const focusaveis = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    )
    if (focusaveis.length === 0) return

    const primeiro = focusaveis[0]
    const ultimo = focusaveis[focusaveis.length - 1]
    if (event.shiftKey && document.activeElement === primeiro) {
      event.preventDefault()
      ultimo.focus()
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault()
      primeiro.focus()
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="acompanhamento-dialog-title"
      onKeyDown={handleDialogKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 id="acompanhamento-dialog-title" className="text-xl font-bold text-slate-900">
              Acompanhamento RSVP
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Total de destinatários: {meta.total}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
            aria-label="Fechar"
          >
            &times;
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error ? (
            <div role="alert" className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
              {error}
            </div>
          ) : loading && data.length === 0 ? (
            <div className="flex justify-center py-8 text-slate-500">
              Carregando destinatários...
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200 text-slate-500">
              Nenhum destinatário encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Nome do Membro
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Resposta RSVP
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {data.map(item => (
                    <tr key={item.destinatarioId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {item.membroNome}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${mapStatusRsvpColor[item.respostaRsvp] || mapStatusRsvpColor.SEM_RESPOSTA}`}>
                          {mapStatusRsvpLabel[item.respostaRsvp] || mapStatusRsvpLabel.SEM_RESPOSTA}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-between items-center shrink-0">
          <div className="text-sm text-slate-600">
            {loading && data.length > 0 ? 'Atualizando...' : `Página ${meta.page} de ${meta.lastPage}`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchAcompanhamento(meta.page - 1)}
              disabled={loading || meta.page <= 1 || !!error}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={() => fetchAcompanhamento(meta.page + 1)}
              disabled={loading || meta.page >= meta.lastPage || !!error}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próximo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
