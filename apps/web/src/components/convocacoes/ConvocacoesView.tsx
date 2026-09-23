import { useState, useEffect } from 'react'
import { ConvocacaoCreate, ConvocacaoUpdate, ConvocacaoCreatePayload, ConvocacaoUpdatePayload, Convocacao } from '@piedade/shared'
import { fetchWithAuth, postWithAuth, patchWithAuth, ApiError } from '../../api/apiClient'
import { ConvocacaoFuncoesModal } from './ConvocacaoFuncoesModal'
import { AcompanhamentoRsvpModal } from './AcompanhamentoRsvpModal'
interface EventoLookup {
  id: string
  titulo: string
  inicioEm: string
  fimEm: string
  ativo?: boolean
}

export function ConvocacoesView() {
  const [convocacoes, setConvocacoes] = useState<Convocacao[]>([])
  const [eventosLookup, setEventosLookup] = useState<EventoLookup[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [gerenciandoFuncoesId, setGerenciandoFuncoesId] = useState<string | null>(null)
  const [acompanhamentoConvocacaoId, setAcompanhamentoConvocacaoId] = useState<string | null>(null)

  const [formData, setFormData] = useState<ConvocacaoCreatePayload>({
    eventoId: '',
    observacoes: '',
  })
  const [errosForm, setErrosForm] = useState<Record<string, string>>({})

  const [actionConfirm, setActionConfirm] = useState<{ type: 'PUBLICAR' | 'CANCELAR', convocacao: Convocacao } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleActionConfirm = async () => {
    if (!actionConfirm) return
    setActionLoading(true)
    setActionError(null)
    
    try {
      if (actionConfirm.type === 'PUBLICAR') {
        await postWithAuth(`/convocacoes/${actionConfirm.convocacao.id}/publicar`, {})
      } else {
        await postWithAuth(`/convocacoes/${actionConfirm.convocacao.id}/cancelar`, {})
      }
      setActionConfirm(null)
      carregarDados()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409 && actionConfirm.type === 'PUBLICAR') {
        setActionError('A convocação foi alterada concorrentemente. Por favor, recarregue a lista e tente novamente.')
      } else if (err instanceof ApiError) {
        setActionError(err.message || 'Erro ao processar requisição')
      } else if (err instanceof Error) {
        setActionError(err.message || 'Erro ao processar requisição')
      } else {
        setActionError('Erro ao processar requisição')
      }
    } finally {
      setActionLoading(false)
    }
  }

  const carregarDados = async () => {
    setLoading(true)
    setErro(null)
    try {
      const [convData, eventosData] = await Promise.all([
        fetchWithAuth<Convocacao[]>('/convocacoes'),
        fetchWithAuth<EventoLookup[]>('/eventos')
      ])
      setConvocacoes(convData || [])
      setEventosLookup(eventosData || [])
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErro(err.message)
      } else {
        setErro('Erro ao carregar convocações')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const abrirFormCriar = () => {
    setEditandoId(null)
    setFormData({ eventoId: '', observacoes: '' })
    setErrosForm({})
    setFormOpen(true)
  }

  const handleClickEditar = (item: Convocacao) => {
    if (item.status !== 'RASCUNHO') {
      setErro(`Não é possível editar uma convocação com status ${item.status}. Somente rascunhos podem ser editados.`)
      return
    }
    setEditandoId(item.id)
    setFormData({
      eventoId: item.eventoId,
      observacoes: item.observacoes || ''
    })
    setErrosForm({})
    setFormOpen(true)
  }

  const handleCloseForm = () => {
    if (!salvando) {
      setFormOpen(false)
      setEditandoId(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrosForm({})

    let requisicao: Promise<unknown>

    if (editandoId) {
      const payload: ConvocacaoUpdatePayload = { observacoes: formData.observacoes }
      const validacao = ConvocacaoUpdate.safeParse(payload)
      if (!validacao.success) {
        const novosErros: Record<string, string> = {}
        validacao.error.issues.forEach(issue => {
          novosErros[issue.path[0] as string] = issue.message
        })
        setErrosForm(novosErros)
        return
      }
      requisicao = patchWithAuth(`/convocacoes/${editandoId}`, payload)
    } else {
      const payload: ConvocacaoCreatePayload = { eventoId: formData.eventoId, observacoes: formData.observacoes }
      const validacao = ConvocacaoCreate.safeParse(payload)
      if (!validacao.success) {
        const novosErros: Record<string, string> = {}
        validacao.error.issues.forEach(issue => {
          novosErros[issue.path[0] as string] = issue.message
        })
        setErrosForm(novosErros)
        return
      }
      requisicao = postWithAuth('/convocacoes', payload)
    }

    setSalvando(true)
    try {
      await requisicao
      setFormOpen(false)
      carregarDados()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrosForm({ root: err.message })
      } else {
        setErrosForm({ root: 'Erro ao salvar convocação' })
      }
    } finally {
      setSalvando(false)
    }
  }

  const formatarEvento = (evento: EventoLookup) => {
    const data = new Date(evento.inicioEm)
    const dataHora = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(data)

    return `${evento.titulo} — ${dataHora}`
  }

  const getNomeEvento = (eventoId: string) => {
    const ev = eventosLookup.find(e => e.id === eventoId)
    return ev ? formatarEvento(ev) : 'Evento não encontrado'
  }

  const eventosDisponiveis = eventosLookup
    .filter(ev => {
      if (editandoId && ev.id === formData.eventoId) return true
      if (ev.ativo === false) return false
      return new Date(ev.fimEm).getTime() >= Date.now()
    })
    .sort((a, b) => new Date(a.inicioEm).getTime() - new Date(b.inicioEm).getTime())

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Convocações</h2>
          <p className="text-slate-600">Gerencie os rascunhos de convocações</p>
        </div>
        <button
          onClick={abrirFormCriar}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
        >
          Novo Rascunho
        </button>
      </div>

      {erro && (
        <div role="alert" className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
          {erro}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-8 text-slate-500">
          Carregando convocações...
        </div>
      ) : convocacoes.length === 0 ? (
        <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500">Nenhuma convocação encontrada.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <ul className="divide-y divide-slate-200">
            {convocacoes.map(conv => (
              <li key={conv.id} className="p-4 hover:bg-slate-50 flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{getNomeEvento(conv.eventoId)}</h3>
                  <p className="text-sm text-slate-500">
                    Status: <span className="font-medium text-slate-700">{conv.status}</span>
                  </p>
                  {conv.observacoes && (
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">{conv.observacoes}</p>
                  )}
                </div>
                <div className="flex items-start gap-2 flex-wrap justify-end">
                  {conv.status === 'RASCUNHO' && (
                    <button
                      onClick={() => setActionConfirm({ type: 'PUBLICAR', convocacao: conv })}
                      className="text-green-600 hover:text-green-800 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                    >
                      Publicar
                    </button>
                  )}
                  {conv.status === 'RASCUNHO' && (
                    <button
                      onClick={() => setGerenciandoFuncoesId(conv.id)}
                      className="text-slate-600 hover:text-slate-800 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Gerenciar Funções
                    </button>
                  )}
                  {conv.status === 'PUBLICADA' && (
                    <button
                      onClick={() => setAcompanhamentoConvocacaoId(conv.id)}
                      className="text-brand-600 hover:text-brand-800 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
                    >
                      Acompanhar RSVP
                    </button>
                  )}
                  <button
                    onClick={() => handleClickEditar(conv)}
                    className="text-brand-600 hover:text-brand-800 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
                  >
                    Editar
                  </button>
                  {conv.status !== 'CANCELADA' && (
                    <button
                      onClick={() => setActionConfirm({ type: 'CANCELAR', convocacao: conv })}
                      className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {formOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h2 id="dialog-title" className="text-xl font-bold text-slate-900">
                {editandoId ? 'Editar Rascunho' : 'Nova Convocação'}
              </h2>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {errosForm.root && (
                <div role="alert" className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 text-sm">
                  {errosForm.root}
                </div>
              )}

              <form id="convocacao-form" onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Evento
                  </label>
                  <select
                    value={formData.eventoId}
                    onChange={(e) => setFormData({ ...formData, eventoId: e.target.value })}
                    disabled={!!editandoId || salvando}
                    className={`w-full p-2 border rounded-lg bg-white ${editandoId ? 'bg-slate-100' : ''} ${errosForm.eventoId ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'} focus:ring-2 outline-none transition-all`}
                  >
                    <option value="">Selecione um evento</option>
                    {eventosDisponiveis.map(ev => (
                      <option key={ev.id} value={ev.id}>{formatarEvento(ev)}</option>
                    ))}
                  </select>
                  {errosForm.eventoId && (
                    <p className="text-red-500 text-sm mt-1">{errosForm.eventoId}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    value={formData.observacoes || ''}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    disabled={salvando}
                    rows={4}
                    className={`w-full p-2 border rounded-lg ${errosForm.observacoes ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'} focus:ring-2 outline-none transition-all`}
                  />
                  {errosForm.observacoes && (
                    <p className="text-red-500 text-sm mt-1">{errosForm.observacoes}</p>
                  )}
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={handleCloseForm}
                disabled={salvando}
                className="px-4 py-2 text-slate-700 font-medium hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="convocacao-form"
                disabled={salvando}
                className="px-4 py-2 bg-brand-600 text-white font-medium hover:bg-brand-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {actionConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h2 id="confirm-dialog-title" className="text-xl font-bold text-slate-900">
                {actionConfirm.type === 'PUBLICAR' ? 'Publicar Convocação' : 'Cancelar Convocação'}
              </h2>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-slate-700">
              {actionError && (
                <div role="alert" className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 text-sm">
                  {actionError}
                </div>
              )}
              {actionConfirm.type === 'PUBLICAR' ? (
                <p>
                  Ao confirmar a publicação, os destinatários e suas evidências serão materializados e a edição ficará bloqueada.
                </p>
              ) : (
                <p>
                  Ao cancelar a convocação, eventos futuros vinculados deixarão de valer, preservando o histórico.
                </p>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => !actionLoading && (setActionConfirm(null), setActionError(null))}
                disabled={actionLoading}
                className="px-4 py-2 text-slate-700 font-medium hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleActionConfirm}
                disabled={actionLoading}
                className={`px-4 py-2 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 ${actionConfirm.type === 'PUBLICAR' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {actionLoading ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {gerenciandoFuncoesId && (
        <ConvocacaoFuncoesModal
          convocacaoId={gerenciandoFuncoesId}
          onClose={() => setGerenciandoFuncoesId(null)}
        />
      )}

      {acompanhamentoConvocacaoId && (
        <AcompanhamentoRsvpModal
          convocacaoId={acompanhamentoConvocacaoId}
          onClose={() => setAcompanhamentoConvocacaoId(null)}
        />
      )}
    </div>
  )
}
