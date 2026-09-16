import { useState, useEffect, useMemo } from 'react'
import { CreateGrupoTrabalhoSchema, UpdateGrupoTrabalhoSchema } from '@piedade/shared'
import { fetchWithAuth, postWithAuth, patchWithAuth, ApiError } from '../../api/apiClient'

export interface Regional {
  id: string
  nome: string
}

export interface Administracao {
  id: string
  nome: string
}

export interface Setor {
  id: string
  nome: string
}

export interface GrupoTrabalho {
  id: string
  nome: string
  ativo: boolean
  regionalId: string | null
  administracaoId: string | null
  setorId: string | null
  createdAt?: string
  updatedAt?: string
}

export function GruposTrabalhoView() {
  const [grupos, setGrupos] = useState<GrupoTrabalho[]>([])
  const [regionais, setRegionais] = useState<Regional[]>([])
  const [administracoes, setAdministracoes] = useState<Administracao[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Filtro
  const [filtroEscopo, setFiltroEscopo] = useState<'todos' | 'regional' | 'administracao' | 'setor'>('todos')

  // Estado do modal/modo de formulário (null = fechado, 'criar' = novo, 'editar' = editando)
  const [modoForm, setModoForm] = useState<'criar' | 'editar' | null>(null)
  const [grupoEditandoId, setGrupoEditandoId] = useState<string | null>(null)
  const [carregandoDetalhes, setCarregandoDetalhes] = useState<boolean>(false)

  // Estado do detalhe visualizado
  const [grupoDetalhe, setGrupoDetalhe] = useState<GrupoTrabalho | null>(null)
  const [carregandoDetalheModal, setCarregandoDetalheModal] = useState<boolean>(false)

  // Campos do formulário
  const [nome, setNome] = useState<string>('')
  const [ativo, setAtivo] = useState<boolean>(true)
  const [tipoEscopo, setTipoEscopo] = useState<'regional' | 'administracao' | 'setor'>('regional')
  const [regionalId, setRegionalId] = useState<string>('')
  const [administracaoId, setAdministracaoId] = useState<string>('')
  const [setorId, setSetorId] = useState<string>('')
  const [errosForm, setErrosForm] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<boolean>(false)

  const carregarDados = async () => {
    setLoading(true)
    setErro(null)
    try {
      const [gruposData, regData, admData, setoData] = await Promise.all([
        fetchWithAuth<GrupoTrabalho[]>('/grupos-trabalho'),
        fetchWithAuth<Regional[]>('/regionais'),
        fetchWithAuth<Administracao[]>('/administracoes'),
        fetchWithAuth<Setor[]>('/setores'),
      ])
      setGrupos(gruposData)
      setRegionais(regData)
      setAdministracoes(admData)
      setSetores(setoData)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const abrirFormCriar = () => {
    setModoForm('criar')
    setGrupoEditandoId(null)
    setNome('')
    setAtivo(true)
    setTipoEscopo('regional')
    setRegionalId('')
    setAdministracaoId('')
    setSetorId('')
    setErrosForm({})
    setErro(null)
    setSucesso(null)
  }

  const abrirFormEditar = async (id: string) => {
    setModoForm('editar')
    setGrupoEditandoId(id)
    setCarregandoDetalhes(true)
    setErrosForm({})
    setErro(null)
    setSucesso(null)

    try {
      const item = await fetchWithAuth<GrupoTrabalho>(`/grupos-trabalho/${id}`)
      setNome(item.nome || '')
      setAtivo(item.ativo ?? true)
      
      if (item.regionalId) {
        setTipoEscopo('regional')
        setRegionalId(item.regionalId)
        setAdministracaoId('')
        setSetorId('')
      } else if (item.administracaoId) {
        setTipoEscopo('administracao')
        setRegionalId('')
        setAdministracaoId(item.administracaoId)
        setSetorId('')
      } else if (item.setorId) {
        setTipoEscopo('setor')
        setRegionalId('')
        setAdministracaoId('')
        setSetorId(item.setorId)
      } else {
        setTipoEscopo('regional')
        setRegionalId('')
        setAdministracaoId('')
        setSetorId('')
      }
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os detalhes do grupo para edição.')
      setModoForm(null)
    } finally {
      setCarregandoDetalhes(false)
    }
  }

  const verDetalhes = async (id: string) => {
    setCarregandoDetalheModal(true)
    setErro(null)
    try {
      const item = await fetchWithAuth<GrupoTrabalho>(`/grupos-trabalho/${id}`)
      setGrupoDetalhe(item)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os detalhes do grupo.')
    } finally {
      setCarregandoDetalheModal(false)
    }
  }

  const fecharForm = () => {
    setModoForm(null)
    setGrupoEditandoId(null)
    setErrosForm({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrosForm({})
    setErro(null)
    setSucesso(null)

    let reqRegionalId = null
    let reqAdmId = null
    let reqSetorId = null

    if (tipoEscopo === 'regional') {
      reqRegionalId = regionalId || null
    } else if (tipoEscopo === 'administracao') {
      reqAdmId = administracaoId || null
    } else if (tipoEscopo === 'setor') {
      reqSetorId = setorId || null
    }

    if (!reqRegionalId && !reqAdmId && !reqSetorId) {
      setErrosForm({ escopo: 'Selecione a localidade do escopo escolhido.' })
      return
    }

    const payload = {
      nome: nome.trim(),
      ativo,
      regionalId: reqRegionalId,
      administracaoId: reqAdmId,
      setorId: reqSetorId,
    }

    if (modoForm === 'criar') {
      const parsed = CreateGrupoTrabalhoSchema.safeParse(payload)
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
        await postWithAuth('/grupos-trabalho', parsed.data)
        setSucesso('Grupo de Trabalho criado com sucesso!')
        fecharForm()
        await carregarDados()
      } catch (err: any) {
        if (err instanceof ApiError && err.body?.error) {
          setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos para criação.')
        } else {
          setErro(err.message || 'Erro ao criar o grupo de trabalho.')
        }
      } finally {
        setSalvando(false)
      }
    } else if (modoForm === 'editar' && grupoEditandoId) {
      const parsed = UpdateGrupoTrabalhoSchema.safeParse(payload)
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
        await patchWithAuth(`/grupos-trabalho/${grupoEditandoId}`, parsed.data)
        setSucesso('Grupo de Trabalho atualizado com sucesso!')
        fecharForm()
        await carregarDados()
      } catch (err: any) {
        if (err instanceof ApiError && err.body?.error) {
          setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos para edição.')
        } else {
          setErro(err.message || 'Erro ao atualizar o grupo de trabalho.')
        }
      } finally {
        setSalvando(false)
      }
    }
  }

  const gruposFiltrados = useMemo(() => {
    if (filtroEscopo === 'todos') return grupos;
    return grupos.filter(g => {
      if (filtroEscopo === 'regional') return !!g.regionalId;
      if (filtroEscopo === 'administracao') return !!g.administracaoId;
      if (filtroEscopo === 'setor') return !!g.setorId;
      return true;
    });
  }, [grupos, filtroEscopo]);

  const getNomeEscopo = (grupo: GrupoTrabalho) => {
    if (grupo.regionalId) {
      const reg = regionais.find(r => r.id === grupo.regionalId)
      return `Regional: ${reg ? reg.nome : grupo.regionalId}`
    }
    if (grupo.administracaoId) {
      const adm = administracoes.find(a => a.id === grupo.administracaoId)
      return `Administração: ${adm ? adm.nome : grupo.administracaoId}`
    }
    if (grupo.setorId) {
      const seto = setores.find(s => s.id === grupo.setorId)
      return `Setor: ${seto ? seto.nome : grupo.setorId}`
    }
    return '-'
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Gestão de Grupos de Trabalho</h2>
          <p className="text-xs text-slate-500">Listagem, cadastro e atualização de Grupos de Trabalho (S01)</p>
        </div>
        <button
          onClick={abrirFormCriar}
          className="bg-brand-600 hover:bg-brand-700 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          + Novo Grupo
        </button>
      </div>

      {/* Filtro */}
      <div className="flex items-center space-x-2 mb-4">
        <label htmlFor="filtro-escopo" className="text-sm font-medium text-slate-700">Filtrar por Escopo:</label>
        <select
          id="filtro-escopo"
          value={filtroEscopo}
          onChange={(e) => setFiltroEscopo(e.target.value as any)}
          className="px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <option value="todos">Todos</option>
          <option value="regional">Regional</option>
          <option value="administracao">Administração</option>
          <option value="setor">Setor</option>
        </select>
      </div>

      {/* Mensagens Globais de Erro e Sucesso */}
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

      {/* Form de Criação / Edição */}
      {modoForm && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-md space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 text-base">
              {modoForm === 'criar' ? 'Cadastrar Novo Grupo' : 'Editar Grupo'}
            </h3>
            <button
              onClick={fecharForm}
              className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
            >
              Cancelar
            </button>
          </div>

          {carregandoDetalhes ? (
            <div className="py-6 text-center text-slate-500 text-sm">Carregando dados do grupo...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-nome">
                  Nome do Grupo <span className="text-red-500">*</span>
                </label>
                <input
                  id="input-nome"
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Jovens, Casais"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tipo de Escopo <span className="text-red-500">*</span>
                </label>
                <div className="flex space-x-4 mb-2">
                  <label className="inline-flex items-center">
                    <input type="radio" value="regional" checked={tipoEscopo === 'regional'} onChange={() => { setTipoEscopo('regional'); setAdministracaoId(''); setSetorId(''); }} className="form-radio text-brand-600" disabled={salvando} />
                    <span className="ml-2 text-sm text-slate-700">Regional</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input type="radio" value="administracao" checked={tipoEscopo === 'administracao'} onChange={() => { setTipoEscopo('administracao'); setRegionalId(''); setSetorId(''); }} className="form-radio text-brand-600" disabled={salvando} />
                    <span className="ml-2 text-sm text-slate-700">Administração</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input type="radio" value="setor" checked={tipoEscopo === 'setor'} onChange={() => { setTipoEscopo('setor'); setRegionalId(''); setAdministracaoId(''); }} className="form-radio text-brand-600" disabled={salvando} />
                    <span className="ml-2 text-sm text-slate-700">Setor</span>
                  </label>
                </div>
              </div>

              {tipoEscopo === 'regional' && (
                <div>
                  <label htmlFor="select-regional" className="block text-xs font-semibold text-slate-700 mb-1">Regional <span className="text-red-500">*</span></label>
                  <select id="select-regional" value={regionalId} onChange={(e) => setRegionalId(e.target.value)} disabled={salvando} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200">
                    <option value="">Selecione...</option>
                    {regionais.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                  </select>
                </div>
              )}
              {tipoEscopo === 'administracao' && (
                <div>
                  <label htmlFor="select-administracao" className="block text-xs font-semibold text-slate-700 mb-1">Administração <span className="text-red-500">*</span></label>
                  <select id="select-administracao" value={administracaoId} onChange={(e) => setAdministracaoId(e.target.value)} disabled={salvando} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200">
                    <option value="">Selecione...</option>
                    {administracoes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>
              )}
              {tipoEscopo === 'setor' && (
                <div>
                  <label htmlFor="select-setor" className="block text-xs font-semibold text-slate-700 mb-1">Setor <span className="text-red-500">*</span></label>
                  <select id="select-setor" value={setorId} onChange={(e) => setSetorId(e.target.value)} disabled={salvando} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200">
                    <option value="">Selecione...</option>
                    {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>
              )}
              {errosForm.escopo && (
                <p className="text-xs text-red-600 mt-1">{errosForm.escopo}</p>
              )}

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
                  Grupo Ativo
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
                  {salvando ? 'Salvando...' : modoForm === 'criar' ? 'Salvar Grupo' : 'Atualizar Grupo'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Lista de Grupos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Carregando grupos de trabalho...
          </div>
        ) : gruposFiltrados.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Nenhum grupo de trabalho encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Escopo</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gruposFiltrados.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-800">
                      {g.nome}
                    </td>
                    <td className="p-3 text-xs text-slate-600">
                      {getNomeEscopo(g)}
                    </td>
                    <td className="p-3">
                      {g.ativo ? (
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
                        onClick={() => verDetalhes(g.id)}
                        className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                      >
                        Detalhes
                      </button>
                      <button
                        onClick={() => abrirFormEditar(g.id)}
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
      {grupoDetalhe && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div 
            className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-detalhes-titulo"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 id="modal-detalhes-titulo" className="font-bold text-slate-800 text-base">Detalhes do Grupo de Trabalho</h3>
              <button
                onClick={() => setGrupoDetalhe(null)}
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
                  <span className="text-xs font-mono text-slate-700">{grupoDetalhe.id}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Nome:</span>
                  <span className="font-semibold text-slate-800">{grupoDetalhe.nome}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Escopo:</span>
                  <span className="text-slate-700">{getNomeEscopo(grupoDetalhe)}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Status:</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    grupoDetalhe.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {grupoDetalhe.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {grupoDetalhe.createdAt && (
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">Data de Criação:</span>
                    <span className="text-xs text-slate-600">{new Date(grupoDetalhe.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                )}
              </div>
            )}

            <div className="text-right pt-3 border-t border-slate-100">
              <button
                onClick={() => setGrupoDetalhe(null)}
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
