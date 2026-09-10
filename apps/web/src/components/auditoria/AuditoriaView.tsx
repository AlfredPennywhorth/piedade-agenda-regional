import { useState, useEffect } from 'react'
import * as apiClient from '../../api/apiClient'

interface AuditLogItem {
  id: string
  acao: string
  atorMembroId: string
  atorNome: string | null
  recursoTipo: string
  recursoId: string
  escopoTipo: string | null
  escopoId: string | null
  contexto: Record<string, any> | null
  ip: string | null
  userAgent: string | null
  criadoEm: string
}

interface AuditResponse {
  items: AuditLogItem[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export function AuditoriaView() {
  const [items, setItems] = useState<AuditLogItem[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Filtros
  const [filtroAcao, setFiltroAcao] = useState('')
  const [filtroRecursoTipo, setFiltroRecursoTipo] = useState('')
  const [detalhesJson, setDetalhesJson] = useState<Record<string, any> | null>(null)

  const carregarLogs = async (pagina = page) => {
    setLoading(true)
    setErro(null)
    try {
      const params = new URLSearchParams({
        page: String(pagina),
        limit: '20',
      })
      if (filtroAcao) params.append('acao', filtroAcao)
      if (filtroRecursoTipo) params.append('recursoTipo', filtroRecursoTipo)

      const res = await apiClient.fetchWithAuth<AuditResponse>(`/auditoria?${params.toString()}`)
      setItems(res.items || [])
      setTotalPages(res.pagination.pages || 1)
      setPage(res.pagination.page || 1)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar a trilha de auditoria.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarLogs(1)
  }, [filtroAcao, filtroRecursoTipo])

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Trilha de Auditoria</h2>
          <p className="text-xs text-slate-500">Registro completo de operações do sistema (Fail-Closed)</p>
        </div>
        <button
          onClick={() => carregarLogs(page)}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-1.5 rounded-lg border border-slate-300 transition-colors"
        >
          Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Filtrar por Ação</label>
          <select
            value={filtroAcao}
            onChange={(e) => setFiltroAcao(e.target.value)}
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">Todas as Ações</option>
            <option value="EVENTO_CRIADO">EVENTO_CRIADO</option>
            <option value="EVENTO_ATUALIZADO">EVENTO_ATUALIZADO</option>
            <option value="CONVOCACAO_PUBLICADA">CONVOCACAO_PUBLICADA</option>
            <option value="CONVOCACAO_CANCELADA">CONVOCACAO_CANCELADA</option>
            <option value="RSVP_REGISTRADO">RSVP_REGISTRADO</option>
            <option value="CHECKIN_QR">CHECKIN_QR</option>
            <option value="CHECKIN_MANUAL">CHECKIN_MANUAL</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Recurso</label>
          <select
            value={filtroRecursoTipo}
            onChange={(e) => setFiltroRecursoTipo(e.target.value)}
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">Todos os Recursos</option>
            <option value="EVENTO">EVENTO</option>
            <option value="CONVOCACAO">CONVOCACAO</option>
            <option value="RSVP">RSVP</option>
            <option value="CHECKIN">CHECKIN</option>
          </select>
        </div>
      </div>

      {erro && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
          {erro}
        </div>
      )}

      {/* Tabela de Audit Logs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3">Data / Hora</th>
                <th className="p-3">Ação</th>
                <th className="p-3">Ator</th>
                <th className="p-3">Recurso</th>
                <th className="p-3">Escopo</th>
                <th className="p-3">Contexto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="p-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(log.criadoEm).toLocaleString('pt-BR')}
                  </td>
                  <td className="p-3">
                    <span className="text-xs px-2 py-0.5 rounded-md font-mono font-medium bg-slate-100 text-slate-800">
                      {log.acao}
                    </span>
                  </td>
                  <td className="p-3 font-medium text-slate-800 text-xs">
                    {log.atorNome || log.atorMembroId.substring(0, 8) + '...'}
                  </td>
                  <td className="p-3 text-xs text-slate-600">
                    <span className="font-semibold">{log.recursoTipo}</span> ({log.recursoId.substring(0, 8)})
                  </td>
                  <td className="p-3 text-xs text-slate-500">
                    {log.escopoTipo ? `${log.escopoTipo}` : '-'}
                  </td>
                  <td className="p-3">
                    {log.contexto ? (
                      <button
                        onClick={() => setDetalhesJson(log.contexto)}
                        className="text-xs text-brand-600 hover:underline font-medium"
                      >
                        Ver Detalhes
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}

              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    Nenhum registro de auditoria encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-600">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => carregarLogs(page - 1)}
              className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => carregarLogs(page + 1)}
              className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* Modal JSON Contexto */}
      {detalhesJson && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-4 space-y-4 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-800 text-sm">Contexto do Evento de Auditoria</h3>
              <button onClick={() => setDetalhesJson(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs font-mono overflow-x-auto max-h-60">
              {JSON.stringify(detalhesJson, null, 2)}
            </pre>
            <div className="text-right">
              <button
                onClick={() => setDetalhesJson(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
