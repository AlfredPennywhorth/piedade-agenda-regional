import { useState } from 'react'
import * as apiClient from '../../api/apiClient'

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

export function PortariaView() {
  const [eventoIdInput, setEventoIdInput] = useState('')
  const [eventoIdAtual, setEventoIdAtual] = useState('')
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [buscaNome, setBuscaNome] = useState('')
  const [qrTokenInput, setQrTokenInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'aviso' | 'erro'; texto: string } | null>(null)

  const carregarParticipantes = async (evId: string) => {
    if (!evId.trim()) return
    setLoading(true)
    setMensagem(null)
    try {
      const data = await apiClient.fetchWithAuth<{ participantes: Participante[] }>(`/portaria/eventos/${evId}/participantes`)
      setParticipantes(data.participantes || [])
      setEventoIdAtual(evId)
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message || 'Erro ao carregar participantes do evento.' })
    } finally {
      setLoading(false)
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
      if (eventoIdAtual) carregarParticipantes(eventoIdAtual)
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message || 'Falha ao validar QR Code.' })
    } finally {
      setLoading(false)
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
      if (eventoIdAtual) carregarParticipantes(eventoIdAtual)
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message || 'Falha ao registrar check-in manual.' })
    } finally {
      setLoading(false)
    }
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
        <div className="flex gap-2">
          <input
            type="text"
            value={eventoIdInput}
            onChange={(e) => setEventoIdInput(e.target.value)}
            placeholder="Digite o ID do Evento..."
            className="flex-1 p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
          <button
            onClick={() => carregarParticipantes(eventoIdInput)}
            disabled={loading || !eventoIdInput.trim()}
            className="px-6 py-3 bg-brand-600 text-white font-medium rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Carregando...' : 'Carregar Evento'}
          </button>
        </div>
      </div>

      {/* Feedback Visual Inequívoco */}
      {mensagem && (
        <div
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
            value={qrTokenInput}
            onChange={(e) => setQrTokenInput(e.target.value)}
            placeholder="Aproxime o leitor ou cole o QR Token..."
            className="flex-1 p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono"
          />
          <button
            type="submit"
            disabled={loading || !qrTokenInput.trim()}
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
                      {p.rsvpResposta && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 uppercase">
                          RSVP: {p.rsvpResposta}
                        </span>
                      )}
                      {p.checkin && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-200 text-green-800 uppercase">
                          Presente ({p.checkin.forma})
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
