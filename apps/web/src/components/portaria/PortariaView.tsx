import { useState, useEffect, useRef } from 'react'
import * as apiClient from '../../api/apiClient'
import { PortariaEventosResponseSchema, RetificarCheckinSchema } from '@piedade/shared'

interface Participante {
  convocacaoDestinatarioId: string
  membro: {
    id: string
    nome: string
    casaNome: string | null
  }
  rsvpResposta: string | null
  checkin: {
    id: string
    dataHoraCheckin: string
    forma: string
  } | null
}

interface CheckinResponse {
  jaRegistrado?: boolean
  message?: string
  convocacaoDestinatarioId?: string
}

interface PortariaEventoItem {
  id: string
  titulo: string
  inicioEm: string
  fimEm: string
  modalidade: string
}

export function PortariaView() {
  const [eventosDisponiveis, setEventosDisponiveis] = useState<PortariaEventoItem[]>([])
  const [isLoadingEventos, setIsLoadingEventos] = useState(true)
  const [eventoIdAtual, setEventoIdAtual] = useState('')
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [buscaNome, setBuscaNome] = useState('')
  const [qrTokenInput, setQrTokenInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'aviso' | 'erro'; texto: string } | null>(null)

  const [ultimoCheckinId, setUltimoCheckinId] = useState<string | null>(null)
  const [modalRetificacao, setModalRetificacao] = useState<{isOpen: boolean; checkinId: string; participanteNome: string; motivo: string; error: string | null; isSubmitting: boolean} | null>(null)

  const qrInputRef = useRef<HTMLInputElement>(null)
  const currentEvIdRef = useRef('')
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let mounted = true
    const carregarEventos = async () => {
      try {
        const data = await apiClient.fetchWithAuth('/portaria/eventos')
        const result = PortariaEventosResponseSchema.safeParse(data)
        if (result.success && mounted) {
          setEventosDisponiveis(result.data.data)
        } else if (!result.success && mounted) {
          setMensagem({ tipo: 'erro', texto: 'Falha na validação do contrato de eventos.' })
        }
      } catch (err: unknown) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar eventos autorizados.'
          setMensagem({ tipo: 'erro', texto: errorMessage })
        }
      } finally {
        if (mounted) setIsLoadingEventos(false)
      }
    }
    carregarEventos()
    return () => {
      mounted = false
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (eventoIdAtual && !loading) {
      qrInputRef.current?.focus()
    }
  }, [eventoIdAtual, loading])

  const carregarParticipantes = async (evId: string) => {
    setLoading(true)
    try {
      const data = await apiClient.fetchWithAuth<{ participantes: Participante[] }>(`/portaria/eventos/${evId}/participantes`)
      if (currentEvIdRef.current === evId) {
        setParticipantes(data.participantes || [])
      }
    } catch (err: unknown) {
      if (currentEvIdRef.current === evId) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar participantes do evento.'
        setMensagem({ tipo: 'erro', texto: errorMessage })
      }
    } finally {
      if (currentEvIdRef.current === evId) {
        setLoading(false)
      }
    }
  }

  const handleSelecionarEvento = (evId: string) => {
    setEventoIdAtual(evId)
    currentEvIdRef.current = evId
    setParticipantes([])
    setBuscaNome('')
    setQrTokenInput('')
    setMensagem(null)
    setUltimoCheckinId(null)
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)

    if (evId) {
      carregarParticipantes(evId)
    }
  }

  const triggerHighlight = (id: string | undefined) => {
    if (!id) return
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    setUltimoCheckinId(id)
    highlightTimeoutRef.current = setTimeout(() => {
      setUltimoCheckinId(null)
    }, 5000)
  }

  const handleCheckinQr = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!qrTokenInput.trim()) return
    setLoading(true)
    setMensagem(null)
    try {
      const res = await apiClient.postWithAuth<CheckinResponse>('/checkin/qr', { qrToken: qrTokenInput.trim() })
      if (res.jaRegistrado) {
        setMensagem({ tipo: 'aviso', texto: 'Atenção: Presença JÁ REGISTRADA previamente!' })
      } else {
        setMensagem({ tipo: 'sucesso', texto: `Check-in por QR Code realizado com sucesso!` })
        triggerHighlight(res.convocacaoDestinatarioId)
      }
      setQrTokenInput('')
      if (eventoIdAtual) await carregarParticipantes(eventoIdAtual)
    } catch (err: unknown) {
      if (err instanceof apiClient.ApiError && err.status === 409 && (err.body as CheckinResponse)?.jaRegistrado === true) {
        setMensagem({ tipo: 'aviso', texto: 'Atenção: Presença JÁ REGISTRADA previamente!' })
        setQrTokenInput('')
        if (eventoIdAtual) await carregarParticipantes(eventoIdAtual)
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Falha ao validar QR Code.'
        setMensagem({ tipo: 'erro', texto: errorMessage })
      }
    } finally {
      setLoading(false)
      qrInputRef.current?.focus()
    }
  }

  const handleCheckinManual = async (destinatarioId: string, nomeMembro: string) => {
    setLoading(true)
    setMensagem(null)
    try {
      const res = await apiClient.postWithAuth<CheckinResponse>('/checkin/manual', { convocacaoDestinatarioId: destinatarioId })
      if (res.jaRegistrado) {
        setMensagem({ tipo: 'aviso', texto: `Atenção: Presença de ${nomeMembro} JÁ REGISTRADA previamente!` })
      } else {
        setMensagem({ tipo: 'sucesso', texto: `Check-in manual de ${nomeMembro} realizado com sucesso!` })
        triggerHighlight(res.convocacaoDestinatarioId)
      }
      if (eventoIdAtual) await carregarParticipantes(eventoIdAtual)
    } catch (err: unknown) {
      if (err instanceof apiClient.ApiError && err.status === 409 && (err.body as CheckinResponse)?.jaRegistrado === true) {
        setMensagem({ tipo: 'aviso', texto: `Atenção: Presença de ${nomeMembro} JÁ REGISTRADA previamente!` })
        if (eventoIdAtual) await carregarParticipantes(eventoIdAtual)
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Falha ao registrar check-in manual.'
        setMensagem({ tipo: 'erro', texto: errorMessage })
      }
    } finally {
      setLoading(false)
      qrInputRef.current?.focus()
    }
  }

  const formatarDataHora = (isoStr: string) => {
    const d = new Date(isoStr)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const getRsvpLabel = (rsvp: string | null) => {
    switch (rsvp) {
      case 'PARTICIPAREI': return { label: 'Participará', color: 'bg-blue-100 text-blue-800 border-blue-200' }
      case 'NAO_PARTICIPAREI': return { label: 'Não participará', color: 'bg-red-100 text-red-800 border-red-200' }
      case 'NAO_SEI': return { label: 'Indefinido', color: 'bg-orange-100 text-orange-800 border-orange-200' }
      default: return { label: 'Sem resposta', color: 'bg-slate-100 text-slate-600 border-slate-200' }
    }
  }

  const filtrados = participantes.filter(p =>
    p.membro.nome.toLowerCase().includes(buscaNome.toLowerCase()) ||
    (p.membro.casaNome && p.membro.casaNome.toLowerCase().includes(buscaNome.toLowerCase()))
  )

  const participantesOrdenados = [...filtrados].sort((a, b) => {
    const aCheck = a.checkin !== null
    const bCheck = b.checkin !== null
    if (aCheck === bCheck) return 0
    return aCheck ? 1 : -1
  })


  const handleCloseModal = () => {
    setModalRetificacao(null)
    setTimeout(() => {
      if (!loading && eventoIdAtual) {
        qrInputRef.current?.focus()
      }
    }, 10)
  }

  const handleRetificarSubmit = async () => {
    if (!modalRetificacao) return

    const result = RetificarCheckinSchema.safeParse({ motivo: modalRetificacao.motivo })
    if (!result.success) {
      setModalRetificacao(prev => prev ? { ...prev, error: 'O motivo deve ter entre 5 e 100 caracteres válidos.' } : null)
      return
    }

    setModalRetificacao(prev => prev ? { ...prev, isSubmitting: true, error: null } : null)

    try {
      await apiClient.postWithAuth(`/checkin/${modalRetificacao.checkinId}/retificar`, { motivo: result.data.motivo })

      setMensagem({ tipo: 'sucesso', texto: 'Check-in retificado com sucesso.' })
      setUltimoCheckinId(null)
      if (eventoIdAtual) {
        await carregarParticipantes(eventoIdAtual)
      }
      handleCloseModal()
    } catch (err: unknown) {
      let errorMsg = 'Erro inesperado ao retificar check-in.'
      if (err instanceof apiClient.ApiError) {
        if (err.status === 403) errorMsg = 'Sem autorização para retificar neste evento.'
        else if (err.status === 404) errorMsg = 'Check-in não encontrado.'
        else if (err.status === 409) errorMsg = 'Check-in já foi retificado por outra operação.'
      }
      setModalRetificacao(prev => prev ? { ...prev, isSubmitting: false, error: errorMsg } : null)
    }
  }

  const totalEsperado = participantes.length
  const presentes = participantes.filter(p => p.checkin !== null).length
  const pendentes = totalEsperado - presentes

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="bg-brand-900 text-white p-6 rounded-2xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Operação de Portaria</h2>
          <p className="text-brand-200 text-sm mt-1">Controle de presença e validação de check-in</p>
        </div>
      </div>

      {/* Seção de Seleção de Evento */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-semibold text-slate-800">1. Selecionar Evento</h3>
        {isLoadingEventos ? (
          <p className="text-slate-500 text-sm">Carregando eventos autorizados...</p>
        ) : eventosDisponiveis.length === 0 ? (
          <div role="alert" className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium text-center">
            Nenhum evento ativo com autorização de operação encontrado para hoje
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              value={eventoIdAtual}
              onChange={(e) => handleSelecionarEvento(e.target.value)}
              disabled={loading}
              className="flex-1 p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="">Selecione um evento para iniciar a portaria...</option>
              {eventosDisponiveis.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.titulo} — {formatarDataHora(ev.inicioEm)} às {formatarDataHora(ev.fimEm)} ({ev.modalidade})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Feedback Visual Inequívoco */}
      {mensagem && (
        <div
          role="alert"
          className={`p-4 rounded-xl text-base font-semibold border text-center animate-in fade-in ${
            mensagem.tipo === 'sucesso'
              ? 'bg-green-100 border-green-300 text-green-900'
              : mensagem.tipo === 'aviso'
              ? 'bg-amber-100 border-amber-300 text-amber-900'
              : 'bg-red-100 border-red-300 text-red-900'
          }`}
        >
          {mensagem.texto}
        </div>
      )}

      {/* Leitura por QR Code */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          2. Check-in por QR Code
        </h3>
        <form onSubmit={handleCheckinQr} className="flex gap-2">
          <input
            type="text"
            ref={qrInputRef}
            autoFocus
            value={qrTokenInput}
            onChange={(e) => setQrTokenInput(e.target.value)}
            disabled={!eventoIdAtual || loading}
            placeholder={eventoIdAtual ? "Aproxime o leitor ou cole o QR Token..." : "Selecione um evento primeiro..."}
            className="flex-1 p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono"
          />
          <button
            type="submit"
            disabled={loading || !qrTokenInput.trim() || !eventoIdAtual}
            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition-colors min-w-[140px]"
          >
            Confirmar QR
          </button>
        </form>
      </div>

      {/* Check-in Manual / Busca por Participantes */}
      {eventoIdAtual && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-base font-semibold text-slate-800">3. Fila de Participantes</h3>
            <div className="flex items-center gap-2 text-sm font-medium" role="group" aria-label="Contadores">
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200">Total: {totalEsperado}</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full border border-green-200">Presentes: {presentes}</span>
              <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full border border-amber-200">Pendentes: {pendentes}</span>
            </div>
          </div>

          <input
            type="text"
            value={buscaNome}
            onChange={(e) => setBuscaNome(e.target.value)}
            placeholder="Buscar por nome do participante ou casa..."
            className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />

          <div className="space-y-3 max-h-[500px] overflow-y-auto pt-2">
            {participantesOrdenados.length === 0 ? (
              <p className="text-center text-slate-500 py-6 text-sm">Nenhum participante encontrado.</p>
            ) : (
              participantesOrdenados.map((p) => {
                const rsvp = getRsvpLabel(p.rsvpResposta)
                const isHighlight = ultimoCheckinId === p.convocacaoDestinatarioId

                return (
                  <div
                    key={p.membro.id}
                    data-testid={`row-${p.convocacaoDestinatarioId}`}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all duration-500 ${
                      isHighlight ? 'bg-brand-50 border-brand-300 ring-2 ring-brand-300 shadow-md transform scale-[1.01]' :
                      p.checkin ? 'bg-green-50/60 border-green-200' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <h4 className="font-semibold text-slate-900 text-base">{p.membro.nome}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{p.membro.casaNome || 'Sem casa vinculada'}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${rsvp.color}`}>
                          {rsvp.label}
                        </span>
                        {p.checkin ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-200 text-green-800 uppercase">
                            Presente ({p.checkin.forma} - {formatarDataHora(p.checkin.dataHoraCheckin)})
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 uppercase">
                            Esperado
                          </span>
                        )}
                      </div>
                    </div>

                                          <div className="mt-2 sm:mt-0 flex flex-col gap-2 items-end">
                        {p.checkin ? (
                          <>
                            <span className="inline-block px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg shadow-sm">
                              Confirmado
                            </span>
                            <button
                              onClick={() => setModalRetificacao({
                                isOpen: true,
                                checkinId: p.checkin!.id,
                                participanteNome: p.membro.nome,
                                motivo: '',
                                error: null,
                                isSubmitting: false
                              })}
                              disabled={loading}
                              className="text-xs font-medium text-slate-500 hover:text-slate-700 underline"
                            >
                              Retificar check-in
                            </button>
                          </>
                        ) : (
                        <button
                          onClick={() => handleCheckinManual(p.convocacaoDestinatarioId, p.membro.nome)}
                          disabled={loading}
                          className="px-5 py-2.5 bg-brand-600 text-white font-medium rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
                        >
                          Registrar Presença
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {modalRetificacao && modalRetificacao.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="modal-retificar-title" className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
            <div className="p-6 space-y-4">
              <h2 id="modal-retificar-title" className="text-lg font-semibold text-slate-900">
                Retificar Check-in
              </h2>
              <p className="text-sm text-slate-600">
                Participante: <span className="font-medium text-slate-800">{modalRetificacao.participanteNome}</span>
              </p>

              {modalRetificacao.error && (
                <div role="alert" className="p-3 bg-red-100 border border-red-300 text-red-900 text-sm rounded-lg">
                  {modalRetificacao.error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="motivo-retificacao" className="block text-sm font-medium text-slate-700">
                  Motivo da retificação
                </label>
                <textarea
                  id="motivo-retificacao"
                  autoFocus
                  rows={3}
                  disabled={modalRetificacao.isSubmitting}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Ex: Erro operacional..."
                  value={modalRetificacao.motivo}
                  onChange={e => setModalRetificacao(prev => prev ? { ...prev, motivo: e.target.value, error: null } : null)}
                />
                <p className="text-xs text-amber-700 font-medium bg-amber-50 p-2 rounded border border-amber-200">
                  Descreva apenas o erro operacional. Não informe dados pessoais ou sensíveis.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
              <button
                onClick={handleCloseModal}
                disabled={modalRetificacao.isSubmitting}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRetificarSubmit}
                disabled={modalRetificacao.isSubmitting}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {modalRetificacao.isSubmitting ? 'Confirmando...' : 'Confirmar retificação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
