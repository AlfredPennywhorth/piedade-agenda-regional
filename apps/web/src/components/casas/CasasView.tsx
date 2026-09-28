import { useState, useEffect } from 'react'
import { CreateCasaSchema, UpdateCasaSchema } from '@piedade/shared'
import { fetchWithAuth, postWithAuth, patchWithAuth, ApiError } from '../../api/apiClient'
import type { Setor } from '../setores/SetoresView'

export interface Casa {
  id: string
  setorId: string
  nome: string
  codigo: string | null
  ativo: boolean
  createdAt?: string
  updatedAt?: string
}

export function CasasView() {
  const [casas, setCasas] = useState<Casa[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Filtro estritamente no cliente por Setor
  const [filtroSetorId, setFiltroSetorId] = useState<string>('')

  // Estado do formulário ('criar' | 'editar' | null)
  const [modoForm, setModoForm] = useState<'criar' | 'editar' | null>(null)
  const [casaEditandoId, setCasaEditandoId] = useState<string | null>(null)
  const [carregandoDetalhes, setCarregandoDetalhes] = useState<boolean>(false)

  // Estado do detalhe visualizado em modal
  const [casaDetalhe, setCasaDetalhe] = useState<Casa | null>(null)
  const [carregandoDetalheModal, setCarregandoDetalheModal] = useState<boolean>(false)

  // Campos do formulário
  const [setorId, setSetorId] = useState<string>('')
  const [nome, setNome] = useState<string>('')
  const [codigo, setCodigo] = useState<string>('')
  const [ativo, setAtivo] = useState<boolean>(true)
  const [errosForm, setErrosForm] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<boolean>(false)

  const carregarDados = async () => {
    setLoading(true)
    setErro(null)
    try {
      const [casasData, setoresData] = await Promise.all([
        fetchWithAuth<Casa[]>('/casas'),
        fetchWithAuth<Setor[]>('/setores'),
      ])
      setCasas(casasData)
      setSetores(setoresData)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os dados de casas de oração e setores.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const abrirFormCriar = () => {
    setModoForm('criar')
    setCasaEditandoId(null)
    setSetorId(filtroSetorId || (setores.length > 0 ? setores[0].id : ''))
    setNome('')
    setCodigo('')
    setAtivo(true)
    setErrosForm({})
    setErro(null)
    setSucesso(null)
  }

  const abrirFormEditar = async (id: string) => {
    setModoForm('editar')
    setCasaEditandoId(id)
    setCarregandoDetalhes(true)
    setErrosForm({})
    setErro(null)
    setSucesso(null)

    try {
      const item = await fetchWithAuth<Casa>(`/casas/${id}`)
      setSetorId(item.setorId || '')
      setNome(item.nome || '')
      setCodigo(item.codigo || '')
      setAtivo(item.ativo ?? true)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os detalhes da casa de oração para edição.')
      setModoForm(null)
    } finally {
      setCarregandoDetalhes(false)
    }
  }

  const verDetalhes = async (id: string) => {
    setCarregandoDetalheModal(true)
    setErro(null)
    try {
      const item = await fetchWithAuth<Casa>(`/casas/${id}`)
      setCasaDetalhe(item)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os detalhes da casa de oração.')
    } finally {
      setCarregandoDetalheModal(false)
    }
  }

  const fecharForm = () => {
    setModoForm(null)
    setCasaEditandoId(null)
    setErrosForm({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrosForm({})
    setErro(null)
    setSucesso(null)

    const payload = {
      setorId,
      nome: nome.trim(),
      codigo: codigo.trim() ? codigo.trim() : null,
      ativo,
    }

    if (modoForm === 'criar') {
      const parsed = CreateCasaSchema.safeParse(payload)
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
        await postWithAuth('/casas', parsed.data)
        setSucesso('Casa de oração criada com sucesso!')
        fecharForm()
        await carregarDados()
      } catch (err: any) {
        if (err instanceof ApiError && err.body?.error) {
          setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos para criação.')
        } else {
          setErro(err.message || 'Erro ao criar a casa de oração.')
        }
      } finally {
        setSalvando(false)
      }
    } else if (modoForm === 'editar' && casaEditandoId) {
      const parsed = UpdateCasaSchema.safeParse(payload)
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
        await patchWithAuth(`/casas/${casaEditandoId}`, parsed.data)
        setSucesso('Casa de oração atualizada com sucesso!')
        fecharForm()
        await carregarDados()
      } catch (err: any) {
        if (err instanceof ApiError && err.body?.error) {
          setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos para edição.')
        } else {
          setErro(err.message || 'Erro ao atualizar a casa de oração.')
        }
      } finally {
        setSalvando(false)
      }
    }
  }

  // Filtragem no cliente por Setor
  const casasFiltradas = casas.filter((casa) => {
    if (!filtroSetorId) return true
    return casa.setorId === filtroSetorId
  })

  const getSetorNome = (sId: string) => {
    const s = setores.find((item) => item.id === sId)
    return s ? s.nome : sId
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Gestão Territorial — Casas de Oração</h2>
          <p className="text-xs text-slate-500">Listagem, cadastro e atualização de Casas de Oração</p>
        </div>
        <button
          onClick={abrirFormCriar}
          className="bg-brand-600 hover:bg-brand-700 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          + Nova Casa de Oração
        </button>
      </div>

      {/* Banners Globais de Erro e Sucesso */}
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
          <label htmlFor="select-filtro-setor" className="text-xs font-semibold text-slate-700">
            Filtrar por Setor:
          </label>
          <select
            id="select-filtro-setor"
            value={filtroSetorId}
            onChange={(e) => setFiltroSetorId(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="">Todos os Setores</option>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} {s.codigo ? `(${s.codigo})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Exibindo {casasFiltradas.length} de {casas.length} casas de oração
        </div>
      </div>

      {/* Form de Criação / Edição */}
      {modoForm && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-md space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 text-base">
              {modoForm === 'criar' ? 'Cadastrar Nova Casa de Oração' : 'Editar Casa de Oração'}
            </h3>
            <button
              onClick={fecharForm}
              className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
            >
              Cancelar
            </button>
          </div>

          {carregandoDetalhes ? (
            <div className="py-6 text-center text-slate-500 text-sm">Carregando dados da casa de oração...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-setor">
                  Setor <span className="text-red-500">*</span>
                </label>
                <select
                  id="input-setor"
                  value={setorId}
                  onChange={(e) => setSetorId(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                    errosForm.setorId ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-200'
                  }`}
                  disabled={salvando}
                >
                  <option value="">Selecione um Setor...</option>
                  {setores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} {s.codigo ? `(${s.codigo})` : ''}
                    </option>
                  ))}
                </select>
                {errosForm.setorId && (
                  <p className="text-xs text-red-600 mt-1">{errosForm.setorId}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-nome">
                  Nome da Casa de Oração <span className="text-red-500">*</span>
                </label>
                <input
                  id="input-nome"
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Central de Osasco"
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
                  placeholder="Ex: C-OSC-01"
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
                  Casa de Oração Ativa
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
                  {salvando ? 'Salvando...' : modoForm === 'criar' ? 'Salvar Casa de Oração' : 'Atualizar Casa de Oração'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Lista de Casas de Oração */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Carregando casas de oração...
          </div>
        ) : casasFiltradas.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            {filtroSetorId
              ? 'Nenhuma casa de oração encontrada para o setor selecionado.'
              : 'Nenhuma casa de oração cadastrada até o momento.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Setor</th>
                  <th className="p-3">Código</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {casasFiltradas.map((casa) => (
                  <tr key={casa.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-800">
                      {casa.nome}
                    </td>
                    <td className="p-3 text-xs text-slate-600 font-medium">
                      {getSetorNome(casa.setorId)}
                    </td>
                    <td className="p-3 text-xs text-slate-600 font-mono">
                      {casa.codigo || '-'}
                    </td>
                    <td className="p-3">
                      {casa.ativo ? (
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
                        onClick={() => verDetalhes(casa.id)}
                        className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                      >
                        Detalhes
                      </button>
                      <button
                        onClick={() => abrirFormEditar(casa.id)}
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

      {/* Modal de Detalhes da Casa de Oração */}
      {casaDetalhe && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-800 text-base">Detalhes da Casa de Oração</h3>
              <button
                onClick={() => setCasaDetalhe(null)}
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
                  <span className="text-xs font-mono text-slate-700">{casaDetalhe.id}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Nome:</span>
                  <span className="font-semibold text-slate-800">{casaDetalhe.nome}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Setor:</span>
                  <span className="text-slate-700 font-medium">{getSetorNome(casaDetalhe.setorId)}</span>
                  <span className="text-[10px] font-mono text-slate-400 block">{casaDetalhe.setorId}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Código:</span>
                  <span className="font-mono text-slate-700">{casaDetalhe.codigo || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Status:</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    casaDetalhe.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {casaDetalhe.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {casaDetalhe.createdAt && (
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">Data de Criação:</span>
                    <span className="text-xs text-slate-600">{new Date(casaDetalhe.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                )}
              </div>
            )}

            <div className="text-right pt-3 border-t border-slate-100">
              <button
                onClick={() => setCasaDetalhe(null)}
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
