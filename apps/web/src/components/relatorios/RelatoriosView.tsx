import { useState } from 'react'
import * as apiClient from '../../api/apiClient'
import { RelatoriosPresencaView } from './RelatoriosPresencaView'

interface RelatorioEventoData {
  evento: {
    id: string
    titulo: string
    inicioEm: string
    fimEm: string
    modalidade: string
  }
  totalConvocados: number
  totalConfirmados: number
  totalRecusados: number
  totalNaoSei: number
  totalSemResposta: number
  totalPresencas: number
  presencasConfirmados: number
  taxaEngajamentoRsvp: number
  taxaPresencaConvocados: number
  taxaPresencaConfirmados: number
}

interface ItemPresenca {
  destinatarioId: string
  membroId: string
  membroNome: string
  membroCelular: string | null
  casaNome: string
  respostaRsvp: string
  periodosParticipacao: string[]
  presente: boolean
  formaCheckin: string | null
  dataHoraCheckin: string | null
}

interface RelatorioAgregadoData {
  escopo: { escopoTipo: string; escopoId: string }
  totalEventos: number
  totalConvocacoesMaterializadas: number
  totalConvocados: number
  totalConfirmados: number
  totalPresencas: number
  mediaPresencaPorEvento: number
  taxaPresencaGeral: number
  eventos: {
    id: string
    titulo: string
    inicioEm: string
    modalidade: string
    totalConvocados: number
    totalConfirmados: number
    totalPresencas: number
    taxaPresenca: number
  }[]
}

export function RelatoriosView() {
  const [modo, setModo] = useState<'evento' | 'agregado' | 'presencas'>('presencas')

  // Estado Relatório do Evento
  const [eventoIdInput, setEventoIdInput] = useState('')
  const [relatorioEvento, setRelatorioEvento] = useState<RelatorioEventoData | null>(null)
  const [presencas, setPresencas] = useState<ItemPresenca[]>([])
  const [loadingEvento, setLoadingEvento] = useState(false)
  const [erroEvento, setErroEvento] = useState<string | null>(null)

  // Filtros Nominal
  const [filtroRsvp, setFiltroRsvp] = useState<string>('')
  const [filtroPresente, setFiltroPresente] = useState<string>('')
  const [buscaNome, setBuscaNome] = useState<string>('')

  // Estado Relatório Agregado
  const [escopoTipo, setEscopoTipo] = useState<'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO'>('REGIONAL')
  const [escopoId, setEscopoId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [relatorioAgregado, setRelatorioAgregado] = useState<RelatorioAgregadoData | null>(null)
  const [loadingAgregado, setLoadingAgregado] = useState(false)
  const [erroAgregado, setErroAgregado] = useState<string | null>(null)

  const carregarRelatorioEvento = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!eventoIdInput.trim()) return
    setLoadingEvento(true)
    setErroEvento(null)
    try {
      const data = await apiClient.fetchWithAuth<RelatorioEventoData>(`/relatorios/eventos/${eventoIdInput.trim()}`)
      setRelatorioEvento(data)
      await carregarPresencas(eventoIdInput.trim())
    } catch (err: any) {
      setErroEvento(err.message || 'Erro ao carregar relatório do evento.')
      setRelatorioEvento(null)
      setPresencas([])
    } finally {
      setLoadingEvento(false)
    }
  }

  const carregarPresencas = async (evId: string) => {
    let url = `/relatorios/eventos/${evId}/presencas?`
    const params = new URLSearchParams()
    if (filtroRsvp) params.append('statusRsvp', filtroRsvp)
    if (filtroPresente) params.append('presente', filtroPresente)
    if (buscaNome) params.append('busca', buscaNome)
    url += params.toString()

    try {
      const list = await apiClient.fetchWithAuth<ItemPresenca[]>(url)
      setPresencas(list)
    } catch (err: any) {
      console.error(err)
    }
  }

  const carregarAgregado = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!escopoId.trim()) return
    setLoadingAgregado(true)
    setErroAgregado(null)
    try {
      const params = new URLSearchParams({
        escopoTipo,
        escopoId: escopoId.trim(),
      })
      if (dataInicio) params.append('dataInicio', dataInicio)
      if (dataFim) params.append('dataFim', dataFim)

      const data = await apiClient.fetchWithAuth<RelatorioAgregadoData>(`/relatorios/agregado?${params.toString()}`)
      setRelatorioAgregado(data)
    } catch (err: any) {
      setErroAgregado(err.message || 'Erro ao carregar relatório agregado.')
      setRelatorioAgregado(null)
    } finally {
      setLoadingAgregado(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Tab Select */}
      <div className="flex border-b border-slate-200 mb-4">
        <button
          onClick={() => setModo('evento')}
          className={`py-2 px-4 font-semibold text-sm border-b-2 transition-colors ${
            modo === 'evento' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Relatório do Evento
        </button>
        <button
          onClick={() => setModo('presencas')}
          className={`py-2 px-4 font-semibold text-sm border-b-2 transition-colors ${
            modo === 'presencas' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Presenças
        </button>
        <button
          onClick={() => setModo('agregado')}
          className={`py-2 px-4 font-semibold text-sm border-b-2 transition-colors ${
            modo === 'agregado' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Relatório Agregado
        </button>
      </div>

      {modo === 'presencas' && <RelatoriosPresencaView />}

      {modo === 'evento' && (
        <div className="space-y-6">
          <form onSubmit={carregarRelatorioEvento} className="flex gap-2">
            <input
              type="text"
              placeholder="Digite o ID do Evento (UUID)"
              value={eventoIdInput}
              onChange={(e) => setEventoIdInput(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={loadingEvento}
              className="bg-brand-600 hover:bg-brand-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {loadingEvento ? 'Carregando...' : 'Buscar Relatório'}
            </button>
          </form>

          {erroEvento && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
              {erroEvento}
            </div>
          )}

          {relatorioEvento && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold text-slate-800 mb-1">{relatorioEvento.evento.titulo}</h2>
                <p className="text-xs text-slate-500 mb-4">
                  Início: {new Date(relatorioEvento.evento.inicioEm).toLocaleString('pt-BR')} | Modalidade: {relatorioEvento.evento.modalidade}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                    <span className="text-xs text-slate-500">Convocados</span>
                    <p className="text-xl font-bold text-slate-800">{relatorioEvento.totalConvocados}</p>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-center">
                    <span className="text-xs text-emerald-700">Confirmados</span>
                    <p className="text-xl font-bold text-emerald-800">{relatorioEvento.totalConfirmados}</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-center">
                    <span className="text-xs text-blue-700">Presenças</span>
                    <p className="text-xl font-bold text-blue-800">{relatorioEvento.totalPresencas}</p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-center">
                    <span className="text-xs text-purple-700">Taxa Presença</span>
                    <p className="text-xl font-bold text-purple-800">{relatorioEvento.taxaPresencaConvocados}%</p>
                  </div>
                </div>
              </div>

              {/* Attendance List */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
                <h3 className="font-semibold text-slate-800">Lista Nominal de Participantes</h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Filtrar por nome..."
                    value={buscaNome}
                    onChange={(e) => {
                      setBuscaNome(e.target.value)
                      carregarPresencas(eventoIdInput)
                    }}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                  />
                  <select
                    value={filtroRsvp}
                    onChange={(e) => {
                      setFiltroRsvp(e.target.value)
                      carregarPresencas(eventoIdInput)
                    }}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">Todos Status RSVP</option>
                    <option value="PARTICIPAREI">Confirmado (PARTICIPAREI)</option>
                    <option value="NAO_PARTICIPAREI">Recusado (NAO_PARTICIPAREI)</option>
                    <option value="NAO_SEI">Não Sei</option>
                    <option value="SEM_RESPOSTA">Sem Resposta</option>
                  </select>
                  <select
                    value={filtroPresente}
                    onChange={(e) => {
                      setFiltroPresente(e.target.value)
                      carregarPresencas(eventoIdInput)
                    }}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">Todas as Presenças</option>
                    <option value="true">Presente</option>
                    <option value="false">Ausente</option>
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2">Nome</th>
                        <th className="p-2">Casa</th>
                        <th className="p-2">RSVP</th>
                        <th className="p-2">Presença</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {presencas.map((p) => (
                        <tr key={p.destinatarioId} className="hover:bg-slate-50">
                          <td className="p-2 font-medium text-slate-800">{p.membroNome}</td>
                          <td className="p-2 text-slate-500">{p.casaNome}</td>
                          <td className="p-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              p.respostaRsvp === 'PARTICIPAREI' ? 'bg-emerald-100 text-emerald-800' :
                              p.respostaRsvp === 'NAO_PARTICIPAREI' ? 'bg-red-100 text-red-800' :
                              p.respostaRsvp === 'NAO_SEI' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {p.respostaRsvp}
                            </span>
                          </td>
                          <td className="p-2">
                            {p.presente ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                                Presente ({p.formaCheckin})
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                                Ausente
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}

                      {presencas.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-slate-400">
                            Nenhum participante encontrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {modo === 'agregado' && (
        <div className="space-y-6">
          <form onSubmit={carregarAgregado} className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Escopo</label>
                <select
                  value={escopoTipo}
                  onChange={(e) => setEscopoTipo(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="REGIONAL">Regional</option>
                  <option value="ADMINISTRACAO">Administração</option>
                  <option value="SETOR">Setor</option>
                  <option value="CASA">Casa</option>
                  <option value="GRUPO_TRABALHO">Grupo de Trabalho</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ID do Escopo (UUID)</label>
                <input
                  type="text"
                  placeholder="ID da Regional/Setor/etc"
                  value={escopoId}
                  onChange={(e) => setEscopoId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Data Início (Opcional)</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Data Fim (Opcional)</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingAgregado}
              className="bg-brand-600 hover:bg-brand-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 w-full sm:w-auto"
            >
              {loadingAgregado ? 'Gerando Relatório...' : 'Gerar Relatório Agregado'}
            </button>
          </form>

          {erroAgregado && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
              {erroAgregado}
            </div>
          )}

          {relatorioAgregado && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                  <span className="text-xs text-slate-500">Total Eventos</span>
                  <p className="text-xl font-bold text-slate-800">{relatorioAgregado.totalEventos}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                  <span className="text-xs text-slate-500">Total Convocados</span>
                  <p className="text-xl font-bold text-slate-800">{relatorioAgregado.totalConvocados}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-center">
                  <span className="text-xs text-blue-700">Total Presencas</span>
                  <p className="text-xl font-bold text-blue-800">{relatorioAgregado.totalPresencas}</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-center">
                  <span className="text-xs text-purple-700">Taxa Presença Geral</span>
                  <p className="text-xl font-bold text-purple-800">{relatorioAgregado.taxaPresencaGeral}%</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-3">Eventos do Escopo</h3>
                <div className="space-y-2">
                  {relatorioAgregado.eventos.map((ev) => (
                    <div key={ev.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{ev.titulo}</p>
                        <p className="text-xs text-slate-500">{new Date(ev.inicioEm).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-brand-700">{ev.totalPresencas} / {ev.totalConvocados} presenças</span>
                        <p className="text-xs text-slate-500">{ev.taxaPresenca}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
