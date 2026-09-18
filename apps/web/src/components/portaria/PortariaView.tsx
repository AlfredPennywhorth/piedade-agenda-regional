import { useState, useEffect, useRef } from 'react'
import * as apiClient from '../../api/apiClient'
import { PortariaEventosResponseSchema } from '@piedade/shared'

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

  const qrInputRef = useRef<HTMLInputElement>(null)
  const currentEvIdRef = useRef('')

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
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (eventoIdAtual) {
      qrInputRef.current?.focus()
    }
  }, [eventoIdAtual])

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
    
    if (evId) {
      carregarParticipantes(evId)
    }
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

  const filtrados = participantes.filter(p =>
    p.membro.nome.toLowerCase().includes(buscaNome.toLowerCase()) ||
    (p.membro.casaNome && p.membro.casaNome.toLowerCase().includes(buscaNome.toLowerCase()))
  )

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
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h3 className="text-base font-semibold text-slate-800">3. Check-in Manual (Lista de Participantes)</h3>
            <span className="text-xs bg-slate-100 text-slate-700 font-medium px-3 py-1 rounded-full">
              Total: {participantes.length} convocados
            </span>
          </div>

          <input
            type="text"
            value={buscaNome}
            onChange={(e) => setBuscaNome(e.target.value)}
            placeholder="Buscar por nome do participante ou casa..."
            className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />

          <div className="space-y-3 max-h-[500px] overflow-y-auto pt-2">
            {filtrados.length === 0 ? (
              <p className="text-center text-slate-500 py-6 text-sm">Nenhum participante encontrado.</p>
            ) : (
              filtrados.map((p) => (
                <div
                  key={p.membro.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors ${
                    p.checkin ? 'bg-green-50/60 border-green-200' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <h4 className="font-semibold text-slate-900 text-base">{p.membro.nome}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{p.membro.casaNome || 'Sem casa vinculada'}</p>
                    <div className="flex items-center gap-2 mt-1">
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

                  <div>
                    {p.checkin ? (
                      <span className="inline-block px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg shadow-sm">
                        ✓ Confirmado
                      </span>
                    ) : (
                      <button
                        onClick={() => handleCheckinManual(p.convocacaoDestinatarioId, p.membro.nome)}
                        disabled={loading}
                        className="px-5 py-2.5 bg-brand-600 text-white font-medium rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        Registrar Presença
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
