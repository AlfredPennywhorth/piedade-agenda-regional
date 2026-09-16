import { useState, useEffect } from 'react'
import { CreateAdministracaoSchema, UpdateAdministracaoSchema } from '@piedade/shared'
import { fetchWithAuth, postWithAuth, patchWithAuth, ApiError } from '../../api/apiClient'
import type { Regional } from '../regionais/RegionaisView'

export interface Administracao {
  id: string
  regionalId: string
  nome: string
  codigo: string | null
  ativo: boolean
  createdAt?: string
  updatedAt?: string
}

export function AdministracoesView() {
  const [administracoes, setAdministracoes] = useState<Administracao[]>([])
  const [regionais, setRegionais] = useState<Regional[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Filtro no cliente por Regional
  const [filtroRegionalId, setFiltroRegionalId] = useState<string>('')

  // Estado do formulário ('criar' | 'editar' | null)
  const [modoForm, setModoForm] = useState<'criar' | 'editar' | null>(null)
  const [admEditandoId, setAdmEditandoId] = useState<string | null>(null)
  const [carregandoDetalhes, setCarregandoDetalhes] = useState<boolean>(false)

  // Estado do detalhe visualizado em modal
  const [admDetalhe, setAdmDetalhe] = useState<Administracao | null>(null)
  const [carregandoDetalheModal, setCarregandoDetalheModal] = useState<boolean>(false)

  // Campos do formulário
  const [regionalId, setRegionalId] = useState<string>('')
  const [nome, setNome] = useState<string>('')
  const [codigo, setCodigo] = useState<string>('')
  const [ativo, setAtivo] = useState<boolean>(true)
  const [errosForm, setErrosForm] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<boolean>(false)

  const carregarDados = async () => {
    setLoading(true)
    setErro(null)
    try {
      const [admsData, regsData] = await Promise.all([
        fetchWithAuth<Administracao[]>('/administracoes'),
        fetchWithAuth<Regional[]>('/regionais'),
      ])
      setAdministracoes(admsData)
      setRegionais(regsData)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os dados de administrações e regionais.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const abrirFormCriar = () => {
    setModoForm('criar')
    setAdmEditandoId(null)
    setRegionalId(filtroRegionalId || (regionais.length > 0 ? regionais[0].id : ''))
    setNome('')
    setCodigo('')
    setAtivo(true)
    setErrosForm({})
    setErro(null)
    setSucesso(null)
  }

  const abrirFormEditar = async (id: string) => {
    setModoForm('editar')
    setAdmEditandoId(id)
    setCarregandoDetalhes(true)
    setErrosForm({})
    setErro(null)
    setSucesso(null)

    try {
      const item = await fetchWithAuth<Administracao>(`/administracoes/${id}`)
      setRegionalId(item.regionalId || '')
      setNome(item.nome || '')
      setCodigo(item.codigo || '')
      setAtivo(item.ativo ?? true)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar detalhes da administração para edição.')
      setModoForm(null)
    } finally {
      setCarregandoDetalhes(false)
    }
  }

  const verDetalhes = async (id: string) => {
    setCarregandoDetalheModal(true)
    setErro(null)
    try {
      const item = await fetchWithAuth<Administracao>(`/administracoes/${id}`)
      setAdmDetalhe(item)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os detalhes da administração.')
    } finally {
      setCarregandoDetalheModal(false)
    }
  }

  const fecharForm = () => {
    setModoForm(null)
    setAdmEditandoId(null)
    setErrosForm({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrosForm({})
    setErro(null)
    setSucesso(null)

    const payload = {
      regionalId,
      nome: nome.trim(),
      codigo: codigo.trim() ? codigo.trim() : null,
      ativo,
    }

    if (modoForm === 'criar') {
      const parsed = CreateAdministracaoSchema.safeParse(payload)
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
        await postWithAuth('/administracoes', parsed.data)
        setSucesso('Administração criada com sucesso!')
        fecharForm()
        await carregarDados()
      } catch (err: any) {
        if (err instanceof ApiError && err.body?.error) {
          setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos para criação.')
        } else {
          setErro(err.message || 'Erro ao criar a administração.')
        }
      } finally {
        setSalvando(false)
      }
    } else if (modoForm === 'editar' && admEditandoId) {
      const parsed = UpdateAdministracaoSchema.safeParse(payload)
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
        await patchWithAuth(`/administracoes/${admEditandoId}`, parsed.data)
        setSucesso('Administração atualizada com sucesso!')
        fecharForm()
        await carregarDados()
      } catch (err: any) {
        if (err instanceof ApiError && err.body?.error) {
          setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos para edição.')
        } else {
          setErro(err.message || 'Erro ao atualizar a administração.')
        }
      } finally {
        setSalvando(false)
      }
    }
  }

  // Filtragem estritamente no cliente
  const administracoesFiltradas = administracoes.filter((adm) => {
    if (!filtroRegionalId) return true
    return adm.regionalId === filtroRegionalId
  })

  const getRegionalNome = (regId: string) => {
    const reg = regionais.find((r) => r.id === regId)
    return reg ? reg.nome : regId
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Gestão Territorial — Administrações</h2>
          <p className="text-xs text-slate-500">Listagem, cadastro e atualização de Administrações Setoriais</p>
        </div>
        <button
          onClick={abrirFormCriar}
          className="bg-brand-600 hover:bg-brand-700 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          + Nova Administração
        </button>
      </div>

      {/* Mensagens Globais */}
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

      {/* Bar de Filtros (Cliente) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-2">
          <label htmlFor="select-filtro-regional" className="text-xs font-semibold text-slate-700">
            Filtrar por Regional:
          </label>
          <select
            id="select-filtro-regional"
            value={filtroRegionalId}
            onChange={(e) => setFiltroRegionalId(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="">Todas as Regionais</option>
            {regionais.map((reg) => (
              <option key={reg.id} value={reg.id}>
                {reg.nome} {reg.codigo ? `(${reg.codigo})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Exibindo {administracoesFiltradas.length} de {administracoes.length} administrações
        </div>
      </div>

      {/* Form de Criação / Edição */}
      {modoForm && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-md space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 text-base">
              {modoForm === 'criar' ? 'Cadastrar Nova Administração' : 'Editar Administração'}
            </h3>
            <button
              onClick={fecharForm}
              className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
            >
              Cancelar
            </button>
          </div>

          {carregandoDetalhes ? (
            <div className="py-6 text-center text-slate-500 text-sm">Carregando dados da administração...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-regional">
                  Regional <span className="text-red-500">*</span>
                </label>
                <select
                  id="input-regional"
                  value={regionalId}
                  onChange={(e) => setRegionalId(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                    errosForm.regionalId ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-200'
                  }`}
                  disabled={salvando}
                >
                  <option value="">Selecione uma Regional...</option>
                  {regionais.map((reg) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.nome} {reg.codigo ? `(${reg.codigo})` : ''}
                    </option>
                  ))}
                </select>
                {errosForm.regionalId && (
                  <p className="text-xs text-red-600 mt-1">{errosForm.regionalId}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-nome">
                  Nome da Administração <span className="text-red-500">*</span>
                </label>
                <input
                  id="input-nome"
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Administração Regional Osasco"
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
                  placeholder="Ex: ADM-OSC"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                    errosForm.codigo ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-200'
                  }`}
                  disabled={salvando}
                />
                {errosForm.codigo && (
                  <p className="text-xs text-red-600 mt-1">{errosForm.codigo}</p>
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
                  Administração Ativa
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
                  {salvando ? 'Salvando...' : modoForm === 'criar' ? 'Salvar Administração' : 'Atualizar Administração'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Lista de Administrações */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Carregando administrações...
          </div>
        ) : administracoesFiltradas.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            {filtroRegionalId
              ? 'Nenhuma administração encontrada para a regional selecionada.'
              : 'Nenhuma administração cadastrada até o momento.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Regional</th>
                  <th className="p-3">Código</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {administracoesFiltradas.map((adm) => (
                  <tr key={adm.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-800">
                      {adm.nome}
                    </td>
                    <td className="p-3 text-xs text-slate-600 font-medium">
                      {getRegionalNome(adm.regionalId)}
                    </td>
                    <td className="p-3 text-xs text-slate-600 font-mono">
                      {adm.codigo || '-'}
                    </td>
                    <td className="p-3">
                      {adm.ativo ? (
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
                        onClick={() => verDetalhes(adm.id)}
                        className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                      >
                        Detalhes
                      </button>
                      <button
                        onClick={() => abrirFormEditar(adm.id)}
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

      {/* Modal de Detalhes da Administração */}
      {admDetalhe && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-800 text-base">Detalhes da Administração</h3>
              <button
                onClick={() => setAdmDetalhe(null)}
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
                  <span className="text-xs font-mono text-slate-700">{admDetalhe.id}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Nome:</span>
                  <span className="font-semibold text-slate-800">{admDetalhe.nome}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Regional:</span>
                  <span className="text-slate-700 font-medium">{getRegionalNome(admDetalhe.regionalId)}</span>
                  <span className="text-[10px] font-mono text-slate-400 block">{admDetalhe.regionalId}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Código:</span>
                  <span className="font-mono text-slate-700">{admDetalhe.codigo || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Status:</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    admDetalhe.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {admDetalhe.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {admDetalhe.createdAt && (
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">Data de Criação:</span>
                    <span className="text-xs text-slate-600">{new Date(admDetalhe.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                )}
              </div>
            )}

            <div className="text-right pt-3 border-t border-slate-100">
              <button
                onClick={() => setAdmDetalhe(null)}
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
