import { useState, useEffect } from 'react'
import { CreateFuncaoSchema, UpdateFuncaoSchema } from '@piedade/shared'
import { fetchWithAuth, postWithAuth, patchWithAuth, ApiError } from '../../api/apiClient'

export interface Funcao {
  id: string
  nome: string
  codigo: string | null
  descricao: string | null
  ativo: boolean
  createdAt?: string
  updatedAt?: string
}

export function FuncoesView() {
  const [funcoes, setFuncoes] = useState<Funcao[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Form State
  const [modoForm, setModoForm] = useState<'criar' | 'editar' | null>(null)
  const [funcaoEditandoId, setFuncaoEditandoId] = useState<string | null>(null)
  const [carregandoDetalhes, setCarregandoDetalhes] = useState<boolean>(false)

  // Modal Details
  const [funcaoDetalhe, setFuncaoDetalhe] = useState<Funcao | null>(null)
  const [carregandoDetalheModal, setCarregandoDetalheModal] = useState<boolean>(false)

  // Form fields
  const [nome, setNome] = useState<string>('')
  const [codigo, setCodigo] = useState<string>('')
  const [descricao, setDescricao] = useState<string>('')
  const [ativo, setAtivo] = useState<boolean>(true)
  
  const [errosForm, setErrosForm] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<boolean>(false)

  const carregarDados = async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await fetchWithAuth<Funcao[]>('/funcoes')
      setFuncoes(data)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar as funções institucionais.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const abrirFormCriar = () => {
    setModoForm('criar')
    setFuncaoEditandoId(null)
    setNome('')
    setCodigo('')
    setDescricao('')
    setAtivo(true)
    setErrosForm({})
    setErro(null)
    setSucesso(null)
  }

  const abrirFormEditar = async (id: string) => {
    setModoForm('editar')
    setFuncaoEditandoId(id)
    setCarregandoDetalhes(true)
    setErrosForm({})
    setErro(null)
    setSucesso(null)

    try {
      const item = await fetchWithAuth<Funcao>(`/funcoes/${id}`)
      setNome(item.nome || '')
      setCodigo(item.codigo || '')
      setDescricao(item.descricao || '')
      setAtivo(item.ativo ?? true)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os detalhes da função para edição.')
      setModoForm(null)
    } finally {
      setCarregandoDetalhes(false)
    }
  }

  const verDetalhes = async (id: string) => {
    setCarregandoDetalheModal(true)
    setErro(null)
    try {
      const item = await fetchWithAuth<Funcao>(`/funcoes/${id}`)
      setFuncaoDetalhe(item)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os detalhes da função.')
    } finally {
      setCarregandoDetalheModal(false)
    }
  }

  const fecharForm = () => {
    setModoForm(null)
    setFuncaoEditandoId(null)
    setErrosForm({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrosForm({})
    setErro(null)
    setSucesso(null)

    const payload = {
      nome: nome.trim(),
      codigo: codigo.trim() ? codigo.trim() : null,
      descricao: descricao.trim() ? descricao.trim() : null,
      ativo,
    }

    if (modoForm === 'criar') {
      const parsed = CreateFuncaoSchema.safeParse(payload)
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
        await postWithAuth('/funcoes', parsed.data)
        setSucesso('Função criada com sucesso!')
        fecharForm()
        await carregarDados()
      } catch (err: any) {
        if (err instanceof ApiError && err.body?.error) {
          setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos para criação.')
        } else {
          setErro(err.message || 'Erro ao criar a função.')
        }
      } finally {
        setSalvando(false)
      }
    } else if (modoForm === 'editar' && funcaoEditandoId) {
      const parsed = UpdateFuncaoSchema.safeParse(payload)
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
        await patchWithAuth(`/funcoes/${funcaoEditandoId}`, parsed.data)
        setSucesso('Função atualizada com sucesso!')
        fecharForm()
        await carregarDados()
      } catch (err: any) {
        if (err instanceof ApiError && err.body?.error) {
          setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos para edição.')
        } else {
          setErro(err.message || 'Erro ao atualizar a função.')
        }
      } finally {
        setSalvando(false)
      }
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Catálogo de Funções</h2>
          <p className="text-xs text-slate-500">Gestão das funções institucionais disponíveis</p>
        </div>
        <button
          onClick={abrirFormCriar}
          className="bg-brand-600 hover:bg-brand-700 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          + Nova Função
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

      {modoForm && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-md space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 text-base">
              {modoForm === 'criar' ? 'Cadastrar Nova Função' : 'Editar Função'}
            </h3>
            <button
              onClick={fecharForm}
              className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
            >
              Cancelar
            </button>
          </div>

          {carregandoDetalhes ? (
            <div className="py-6 text-center text-slate-500 text-sm">Carregando dados da função...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-nome">
                  Nome da Função <span className="text-red-500">*</span>
                </label>
                <input
                  id="input-nome"
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Ancião"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                    errosForm.nome ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-200'
                  }`}
                  disabled={salvando}
                />
                {errosForm.nome && (
                  <p className="text-xs text-red-600 mt-1">{errosForm.nome}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-codigo">
                  Código (Opcional)
                </label>
                <input
                  id="input-codigo"
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ex: ANC"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                    errosForm.codigo ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-200'
                  }`}
                  disabled={salvando}
                />
                {errosForm.codigo && (
                  <p className="text-xs text-red-600 mt-1">{errosForm.codigo}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-descricao">
                  Descrição (Opcional)
                </label>
                <textarea
                  id="input-descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={3}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                    errosForm.descricao ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-200'
                  }`}
                  disabled={salvando}
                />
                {errosForm.descricao && (
                  <p className="text-xs text-red-600 mt-1">{errosForm.descricao}</p>
                )}
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
                  Função Ativa
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
                  {salvando ? 'Salvando...' : modoForm === 'criar' ? 'Salvar Função' : 'Atualizar Função'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Carregando funções...
          </div>
        ) : funcoes.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Nenhuma função cadastrada até o momento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Código</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {funcoes.map((funcao) => (
                  <tr key={funcao.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-800">
                      {funcao.nome}
                    </td>
                    <td className="p-3 text-xs text-slate-600 font-mono">
                      {funcao.codigo || '-'}
                    </td>
                    <td className="p-3">
                      {funcao.ativo ? (
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
                        onClick={() => verDetalhes(funcao.id)}
                        className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                      >
                        Detalhes
                      </button>
                      <button
                        onClick={() => abrirFormEditar(funcao.id)}
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
      {funcaoDetalhe && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div 
            className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-detalhes-titulo"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 id="modal-detalhes-titulo" className="font-bold text-slate-800 text-base">Detalhes da Função</h3>
              <button
                onClick={() => setFuncaoDetalhe(null)}
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
                  <span className="text-xs font-mono text-slate-700">{funcaoDetalhe.id}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Nome:</span>
                  <span className="font-semibold text-slate-800">{funcaoDetalhe.nome}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Código:</span>
                  <span className="font-mono text-slate-700">{funcaoDetalhe.codigo || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Descrição:</span>
                  <span className="text-slate-700">{funcaoDetalhe.descricao || 'Nenhuma descrição fornecida'}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Status:</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    funcaoDetalhe.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {funcaoDetalhe.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {funcaoDetalhe.createdAt && (
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">Data de Criação:</span>
                    <span className="text-xs text-slate-600">{new Date(funcaoDetalhe.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                )}
              </div>
            )}

            <div className="text-right pt-3 border-t border-slate-100">
              <button
                onClick={() => setFuncaoDetalhe(null)}
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
