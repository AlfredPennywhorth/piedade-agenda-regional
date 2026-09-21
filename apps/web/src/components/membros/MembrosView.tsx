import { useState, useEffect } from 'react'
import { CreateMembroSchema, UpdateMembroSchema } from '@piedade/shared'
import { fetchWithAuth, postWithAuth, patchWithAuth, ApiError } from '../../api/apiClient'
import type { Casa } from '../casas/CasasView'

export interface Membro {
  id: string
  nome: string
  dataOrdenacao: string
  codigoCarteirinha: string
  celular: string | null
  casaId: string
  ativo: boolean
  createdAt?: string
  updatedAt?: string
}

export function MembrosView() {
  const [membros, setMembros] = useState<Membro[]>([])
  const [casas, setCasas] = useState<Casa[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Filtro
  const [filtroCasaId, setFiltroCasaId] = useState<string>('')

  // Form State
  const [modoForm, setModoForm] = useState<'criar' | 'editar' | null>(null)
  const [membroEditandoId, setMembroEditandoId] = useState<string | null>(null)
  const [carregandoDetalhes, setCarregandoDetalhes] = useState<boolean>(false)

  // Modal Details
  const [membroDetalhe, setMembroDetalhe] = useState<Membro | null>(null)
  const [carregandoDetalheModal, setCarregandoDetalheModal] = useState<boolean>(false)

  // Form fields
  const [casaId, setCasaId] = useState<string>('')
  const [nome, setNome] = useState<string>('')
  const [dataOrdenacao, setDataOrdenacao] = useState<string>('')
  const [codigoCarteirinha, setCodigoCarteirinha] = useState<string>('')
  const [celular, setCelular] = useState<string>('')
  const [ativo, setAtivo] = useState<boolean>(true)
  
  const [errosForm, setErrosForm] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<boolean>(false)

  const carregarDados = async () => {
    setLoading(true)
    setErro(null)
    try {
      const [membrosData, casasData] = await Promise.all([
        fetchWithAuth<Membro[]>('/membros'),
        fetchWithAuth<Casa[]>('/casas'),
      ])
      setMembros(membrosData)
      setCasas(casasData)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os dados de membros e casas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const abrirFormCriar = () => {
    setModoForm('criar')
    setMembroEditandoId(null)
    setCasaId(filtroCasaId || (casas.length > 0 ? casas[0].id : ''))
    setNome('')
    setDataOrdenacao('')
    setCodigoCarteirinha('')
    setCelular('')
    setAtivo(true)
    setErrosForm({})
    setErro(null)
    setSucesso(null)
  }

  const abrirFormEditar = async (id: string) => {
    setModoForm('editar')
    setMembroEditandoId(id)
    setCarregandoDetalhes(true)
    setErrosForm({})
    setErro(null)
    setSucesso(null)

    try {
      const item = await fetchWithAuth<Membro>(`/membros/${id}`)
      setCasaId(item.casaId || '')
      setNome(item.nome || '')
      setDataOrdenacao(item.dataOrdenacao ? item.dataOrdenacao.substring(0, 10) : '')
      setCodigoCarteirinha(item.codigoCarteirinha || '')
      setCelular(item.celular || '')
      setAtivo(item.ativo ?? true)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os detalhes do membro para edição.')
      setModoForm(null)
    } finally {
      setCarregandoDetalhes(false)
    }
  }

  const verDetalhes = async (id: string) => {
    setCarregandoDetalheModal(true)
    setErro(null)
    try {
      const item = await fetchWithAuth<Membro>(`/membros/${id}`)
      setMembroDetalhe(item)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os detalhes do membro.')
    } finally {
      setCarregandoDetalheModal(false)
    }
  }

  const fecharForm = () => {
    setModoForm(null)
    setMembroEditandoId(null)
    setErrosForm({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrosForm({})
    setErro(null)
    setSucesso(null)

    const payload = {
      casaId,
      nome: nome.trim(),
      dataOrdenacao: dataOrdenacao.trim(),
      codigoCarteirinha: codigoCarteirinha.trim(),
      celular: celular.trim() ? celular.trim() : null,
      ativo,
    }

    if (modoForm === 'criar') {
      const parsed = CreateMembroSchema.safeParse(payload)
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {}
        parsed.error.issues.forEach((issue) => {
          if (issue.path[0]) {
            fieldErrors[String(issue.path[0])] = issue.message
          }
        })
        setErrosForm(fieldErrors)
        return
      }

      setSalvando(true)
      try {
        await postWithAuth('/membros', parsed.data)
        setSucesso('Membro criado com sucesso!')
        fecharForm()
        await carregarDados()
      } catch (err: any) {
        if (err instanceof ApiError && err.body?.error) {
          setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos para criação.')
        } else {
          setErro(err.message || 'Erro ao criar o membro.')
        }
      } finally {
        setSalvando(false)
      }
    } else if (modoForm === 'editar' && membroEditandoId) {
      const parsed = UpdateMembroSchema.safeParse(payload)
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {}
        parsed.error.issues.forEach((issue) => {
          if (issue.path[0]) {
            fieldErrors[String(issue.path[0])] = issue.message
          }
        })
        setErrosForm(fieldErrors)
        return
      }

      setSalvando(true)
      try {
        await patchWithAuth(`/membros/${membroEditandoId}`, parsed.data)
        setSucesso('Membro atualizado com sucesso!')
        fecharForm()
        await carregarDados()
      } catch (err: any) {
        if (err instanceof ApiError && err.body?.error) {
          setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos para edição.')
        } else {
          setErro(err.message || 'Erro ao atualizar o membro.')
        }
      } finally {
        setSalvando(false)
      }
    }
  }

  const membrosFiltrados = membros.filter((m) => {
    if (!filtroCasaId) return true
    return m.casaId === filtroCasaId
  })

  const getCasaNome = (cId: string) => {
    const c = casas.find((item) => item.id === cId)
    return c ? c.nome : cId
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Diretório de Membros</h2>
          <p className="text-xs text-slate-500">Listagem, cadastro e atualização de Membros</p>
        </div>
        <button
          onClick={abrirFormCriar}
          className="bg-brand-600 hover:bg-brand-700 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          + Novo Membro
        </button>
      </div>

      {erro && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm flex justify-between items-center">
          <span>{erro}</span>
          <button onClick={() => setErro(null)} className="text-red-500 hover:text-red-700 font-bold ml-2">✕</button>
        </div>
      )}

      {sucesso && (
        <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm flex justify-between items-center">
          <span>{sucesso}</span>
          <button onClick={() => setSucesso(null)} className="text-emerald-500 hover:text-emerald-700 font-bold ml-2">✕</button>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-2">
          <label htmlFor="select-filtro-casa" className="text-xs font-semibold text-slate-700">
            Filtrar por Casa:
          </label>
          <select
            id="select-filtro-casa"
            value={filtroCasaId}
            onChange={(e) => setFiltroCasaId(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="">Todas as Casas</option>
            {casas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} {c.codigo ? `(${c.codigo})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Exibindo {membrosFiltrados.length} de {membros.length} membros
        </div>
      </div>

      {modoForm && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-md space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 text-base">
              {modoForm === 'criar' ? 'Cadastrar Novo Membro' : 'Editar Membro'}
            </h3>
            <button
              onClick={fecharForm}
              className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
            >
              Cancelar
            </button>
          </div>

          {carregandoDetalhes ? (
            <div className="py-6 text-center text-slate-500 text-sm">Carregando dados do membro...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-casa">
                  Casa de Oração <span className="text-red-500">*</span>
                </label>
                <select
                  id="input-casa"
                  value={casaId}
                  onChange={(e) => setCasaId(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                    errosForm.casaId ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-200'
                  }`}
                  disabled={salvando}
                >
                  <option value="">Selecione uma Casa de Oração...</option>
                  {casas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} {c.codigo ? `(${c.codigo})` : ''}
                    </option>
                  ))}
                </select>
                {errosForm.casaId && (
                  <p className="text-xs text-red-600 mt-1">{errosForm.casaId}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-nome">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  id="input-nome"
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                    errosForm.nome ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-200'
                  }`}
                  disabled={salvando}
                />
                {errosForm.nome && (
                  <p className="text-xs text-red-600 mt-1">{errosForm.nome}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-carteirinha">
                    Código da Carteirinha <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="input-carteirinha"
                    type="text"
                    value={codigoCarteirinha}
                    onChange={(e) => setCodigoCarteirinha(e.target.value)}
                    autoComplete="off"
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                      errosForm.codigoCarteirinha ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-200'
                    }`}
                    disabled={salvando}
                  />
                  {errosForm.codigoCarteirinha && (
                    <p className="text-xs text-red-600 mt-1">{errosForm.codigoCarteirinha}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-ordenacao">
                    Data de Ordenação <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="input-ordenacao"
                    type="date"
                    value={dataOrdenacao}
                    onChange={(e) => setDataOrdenacao(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                      errosForm.dataOrdenacao ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-200'
                    }`}
                    disabled={salvando}
                  />
                  {errosForm.dataOrdenacao && (
                    <p className="text-xs text-red-600 mt-1">{errosForm.dataOrdenacao}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-celular">
                    Celular (Opcional)
                  </label>
                  <input
                    id="input-celular"
                    type="text"
                    value={celular}
                    onChange={(e) => setCelular(e.target.value)}
                    placeholder="Ex: 11999999999"
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                      errosForm.celular ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-200'
                    }`}
                    disabled={salvando}
                  />
                  {errosForm.celular && (
                    <p className="text-xs text-red-600 mt-1">{errosForm.celular}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  id="input-ativo"
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  disabled={salvando}
                />
                <label htmlFor="input-ativo" className="text-sm text-slate-700 font-medium">
                  Membro Ativo
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={fecharForm}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
                  disabled={salvando}
                >
                  {salvando ? 'Salvando...' : modoForm === 'criar' ? 'Salvar Membro' : 'Atualizar Membro'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Carregando membros...
          </div>
        ) : membrosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            {filtroCasaId
              ? 'Nenhum membro encontrado para a casa selecionada.'
              : 'Nenhum membro cadastrado até o momento.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Casa de Oração</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {membrosFiltrados.map((membro) => (
                  <tr key={membro.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-800">
                      {membro.nome}
                    </td>
                    <td className="p-3 text-xs text-slate-600 font-medium">
                      {getCasaNome(membro.casaId)}
                    </td>
                    <td className="p-3">
                      {membro.ativo ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => verDetalhes(membro.id)}
                        className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                      >
                        Detalhes
                      </button>
                      <button
                        onClick={() => abrirFormEditar(membro.id)}
                        className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1 bg-brand-50 hover:bg-brand-100 rounded transition-colors"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {membroDetalhe && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div 
            className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-detalhes-titulo"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 id="modal-detalhes-titulo" className="font-bold text-slate-800 text-base">Detalhes do Membro</h3>
              <button
                onClick={() => setMembroDetalhe(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {carregandoDetalheModal ? (
              <div className="py-6 text-center text-slate-500 text-sm">Carregando detalhes...</div>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">ID:</span>
                  <span className="text-xs font-mono text-slate-700">{membroDetalhe.id}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Nome:</span>
                  <span className="font-semibold text-slate-800">{membroDetalhe.nome}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Casa de Oração:</span>
                  <span className="text-slate-700 font-medium">{getCasaNome(membroDetalhe.casaId)}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Código da Carteirinha:</span>
                  <span className="text-slate-700">{membroDetalhe.codigoCarteirinha}</span>
                </div>
                {membroDetalhe.dataOrdenacao && (
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">Data de Ordenação:</span>
                    <span className="text-slate-700">
                      {new Date(membroDetalhe.dataOrdenacao).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </span>
                  </div>
                )}
                {membroDetalhe.celular && (
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">Celular:</span>
                    <span className="text-slate-700">{membroDetalhe.celular}</span>
                  </div>
                )}
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Status:</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    membroDetalhe.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {membroDetalhe.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {membroDetalhe.createdAt && (
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">Data de Criação:</span>
                    <span className="text-xs text-slate-600">{new Date(membroDetalhe.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                )}
              </div>
            )}

            <div className="text-right pt-3 border-t border-slate-100">
              <button
                onClick={() => setMembroDetalhe(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
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
