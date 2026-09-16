import { useState, useEffect } from 'react'
import { CreateVinculoFuncionalSchema, UpdateVinculoFuncionalSchema } from '@piedade/shared'
import { fetchWithAuth, postWithAuth, patchWithAuth, ApiError } from '../../api/apiClient'

export interface VinculoFuncional {
  id: string
  membroId: string
  funcaoId: string
  ativo: boolean
  regionalId: string | null
  administracaoId: string | null
  setorId: string | null
  casaId: string | null
  grupoTrabalhoId: string | null
  createdAt?: string
  updatedAt?: string
  // Dados populados no backend
  membro?: { nome: string }
  funcao?: { nome: string }
  regional?: { nome: string }
  administracao?: { nome: string }
  setor?: { nome: string }
  casa?: { nome: string }
  grupoTrabalho?: { nome: string }
}

type TipoEscopo = 'regional' | 'administracao' | 'setor' | 'casa' | 'gt' | ''

export function VinculosFuncionaisView() {
  const [vinculos, setVinculos] = useState<VinculoFuncional[]>([])
  
  // Lookups
  const [membros, setMembros] = useState<any[]>([])
  const [funcoes, setFuncoes] = useState<any[]>([])
  const [regionais, setRegionais] = useState<any[]>([])
  const [administracoes, setAdministracoes] = useState<any[]>([])
  const [setores, setSetores] = useState<any[]>([])
  const [casas, setCasas] = useState<any[]>([])
  const [gts, setGts] = useState<any[]>([])

  const [loading, setLoading] = useState<boolean>(true)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Form State
  const [modoForm, setModoForm] = useState<'criar' | 'editar' | null>(null)
  const [vinculoEditandoId, setVinculoEditandoId] = useState<string | null>(null)
  const [carregandoDetalhes, setCarregandoDetalhes] = useState<boolean>(false)

  // Modal Details
  const [vinculoDetalhe, setVinculoDetalhe] = useState<VinculoFuncional | null>(null)

  // Form fields
  const [membroId, setMembroId] = useState<string>('')
  const [funcaoId, setFuncaoId] = useState<string>('')
  const [ativo, setAtivo] = useState<boolean>(true)
  const [tipoEscopo, setTipoEscopo] = useState<TipoEscopo>('')
  const [escopoId, setEscopoId] = useState<string>('')
  
  const [errosForm, setErrosForm] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<boolean>(false)

  const carregarLookups = async () => {
    try {
      const [mems, funcs, regs, adms, sets, cas, gs] = await Promise.all([
        fetchWithAuth<any[]>('/membros'),
        fetchWithAuth<any[]>('/funcoes'),
        fetchWithAuth<any[]>('/regionais'),
        fetchWithAuth<any[]>('/administracoes'),
        fetchWithAuth<any[]>('/setores'),
        fetchWithAuth<any[]>('/casas'),
        fetchWithAuth<any[]>('/grupos-trabalho')
      ])
      setMembros(mems)
      setFuncoes(funcs)
      setRegionais(regs)
      setAdministracoes(adms)
      setSetores(sets)
      setCasas(cas)
      setGts(gs)
    } catch (err: any) {
      console.error('Erro ao carregar dados de apoio', err)
    }
  }

  const carregarDados = async () => {
    setLoading(true)
    setErro(null)
    try {
      await carregarLookups()
      const data = await fetchWithAuth<VinculoFuncional[]>('/vinculos-funcionais')
      setVinculos(data)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os vínculos funcionais.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const handleChangeTipoEscopo = (novoTipo: TipoEscopo) => {
    setTipoEscopo(novoTipo)
    setEscopoId('')
  }

  const abrirFormCriar = () => {
    setModoForm('criar')
    setVinculoEditandoId(null)
    setMembroId('')
    setFuncaoId('')
    setAtivo(true)
    setTipoEscopo('')
    setEscopoId('')
    setErrosForm({})
    setErro(null)
    setSucesso(null)
  }

  const getTipoEscopoAtual = (v: VinculoFuncional): TipoEscopo => {
    if (v.regionalId) return 'regional'
    if (v.administracaoId) return 'administracao'
    if (v.setorId) return 'setor'
    if (v.casaId) return 'casa'
    if (v.grupoTrabalhoId) return 'gt'
    return ''
  }

  const getEscopoIdAtual = (v: VinculoFuncional): string => {
    return v.regionalId || v.administracaoId || v.setorId || v.casaId || v.grupoTrabalhoId || ''
  }

  const abrirFormEditar = async (id: string) => {
    setModoForm('editar')
    setVinculoEditandoId(id)
    setCarregandoDetalhes(true)
    setErrosForm({})
    setErro(null)
    setSucesso(null)

    try {
      const item = await fetchWithAuth<VinculoFuncional>(`/vinculos-funcionais/${id}`)
      setMembroId(item.membroId)
      setFuncaoId(item.funcaoId)
      setAtivo(item.ativo ?? true)
      setTipoEscopo(getTipoEscopoAtual(item))
      setEscopoId(getEscopoIdAtual(item))
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os detalhes do vínculo.')
      setModoForm(null)
    } finally {
      setCarregandoDetalhes(false)
    }
  }

  const verDetalhes = (vinculo: VinculoFuncional) => {
    setVinculoDetalhe(vinculo)
  }

  const fecharForm = () => {
    setModoForm(null)
    setVinculoEditandoId(null)
    setErrosForm({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrosForm({})
    setErro(null)
    setSucesso(null)

    if (!tipoEscopo || !escopoId) {
      setErrosForm({ escopo: 'Selecione um escopo territorial/institucional válido.' })
      return
    }

    const payload = {
      membroId: membroId || undefined,
      funcaoId: funcaoId || undefined,
      ativo,
      regionalId: tipoEscopo === 'regional' ? escopoId : null,
      administracaoId: tipoEscopo === 'administracao' ? escopoId : null,
      setorId: tipoEscopo === 'setor' ? escopoId : null,
      casaId: tipoEscopo === 'casa' ? escopoId : null,
      grupoTrabalhoId: tipoEscopo === 'gt' ? escopoId : null,
    }

    if (modoForm === 'criar') {
      const parsed = CreateVinculoFuncionalSchema.safeParse(payload)
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
        await postWithAuth('/vinculos-funcionais', parsed.data)
        setSucesso('Vínculo Funcional criado com sucesso!')
        fecharForm()
        await carregarDados()
      } catch (err: any) {
        if (err instanceof ApiError && err.body?.error) {
          setErro(typeof err.body.error === 'string' ? err.body.error : 'Erro na criação do vínculo.')
        } else {
          setErro(err.message || 'Erro ao criar o vínculo.')
        }
      } finally {
        setSalvando(false)
      }
    } else if (modoForm === 'editar' && vinculoEditandoId) {
      // Remover os nulos explícitos para o patch e enviar undefined se quiser ignorar,
      // mas como queremos limpar no banco, enviamos null
      const payloadPatch = {
        membroId,
        funcaoId,
        ativo,
        regionalId: tipoEscopo === 'regional' ? escopoId : null,
        administracaoId: tipoEscopo === 'administracao' ? escopoId : null,
        setorId: tipoEscopo === 'setor' ? escopoId : null,
        casaId: tipoEscopo === 'casa' ? escopoId : null,
        grupoTrabalhoId: tipoEscopo === 'gt' ? escopoId : null,
      }

      const parsed = UpdateVinculoFuncionalSchema.safeParse(payloadPatch)
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
        await patchWithAuth(`/vinculos-funcionais/${vinculoEditandoId}`, payloadPatch)
        setSucesso('Vínculo Funcional atualizado com sucesso!')
        fecharForm()
        await carregarDados()
      } catch (err: any) {
        if (err instanceof ApiError && err.body?.error) {
          setErro(typeof err.body.error === 'string' ? err.body.error : 'Erro na atualização do vínculo.')
        } else {
          setErro(err.message || 'Erro ao atualizar o vínculo.')
        }
      } finally {
        setSalvando(false)
      }
    }
  }

  const renderNomeEscopo = (v: VinculoFuncional) => {
    if (v.regional) return `Regional: ${v.regional.nome}`
    if (v.administracao) return `Administração: ${v.administracao.nome}`
    if (v.setor) return `Setor: ${v.setor.nome}`
    if (v.casa) return `Casa: ${v.casa.nome}`
    if (v.grupoTrabalho) return `GT: ${v.grupoTrabalho.nome}`
    return 'Escopo não definido'
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Vínculos Funcionais</h2>
          <p className="text-xs text-slate-500">Atribuições de funções a membros em escopos institucionais</p>
        </div>
        <button
          onClick={abrirFormCriar}
          className="bg-brand-600 hover:bg-brand-700 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          + Novo Vínculo
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
              {modoForm === 'criar' ? 'Cadastrar Novo Vínculo' : 'Editar Vínculo'}
            </h3>
            <button
              onClick={fecharForm}
              className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
            >
              Cancelar
            </button>
          </div>

          {carregandoDetalhes ? (
            <div className="py-6 text-center text-slate-500 text-sm">Carregando detalhes do vínculo...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-membro">
                    Membro <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="input-membro"
                    value={membroId}
                    onChange={(e) => setMembroId(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                      errosForm.membroId ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-200'
                    }`}
                    disabled={salvando}
                  >
                    <option value="">Selecione um membro...</option>
                    {membros.map(m => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                  {errosForm.membroId && <p className="text-xs text-red-600 mt-1">{errosForm.membroId}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-funcao">
                    Função <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="input-funcao"
                    value={funcaoId}
                    onChange={(e) => setFuncaoId(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                      errosForm.funcaoId ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-200'
                    }`}
                    disabled={salvando}
                  >
                    <option value="">Selecione uma função...</option>
                    {funcoes.map(f => (
                      <option key={f.id} value={f.id}>{f.nome} {f.ativo ? '' : '(Inativa)'}</option>
                    ))}
                  </select>
                  {errosForm.funcaoId && <p className="text-xs text-red-600 mt-1">{errosForm.funcaoId}</p>}
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <label className="block text-xs font-semibold text-slate-700 mb-3">
                  Tipo de Escopo Institucional <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-4 mb-4">
                  <label className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoEscopo"
                      value="regional"
                      checked={tipoEscopo === 'regional'}
                      onChange={() => handleChangeTipoEscopo('regional')}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <span>Regional</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoEscopo"
                      value="administracao"
                      checked={tipoEscopo === 'administracao'}
                      onChange={() => handleChangeTipoEscopo('administracao')}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <span>Administração</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoEscopo"
                      value="setor"
                      checked={tipoEscopo === 'setor'}
                      onChange={() => handleChangeTipoEscopo('setor')}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <span>Setor</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoEscopo"
                      value="casa"
                      checked={tipoEscopo === 'casa'}
                      onChange={() => handleChangeTipoEscopo('casa')}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <span>Casa de Oração</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="tipoEscopo"
                      value="gt"
                      checked={tipoEscopo === 'gt'}
                      onChange={() => handleChangeTipoEscopo('gt')}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <span>Grupo de Trabalho</span>
                  </label>
                </div>

                {tipoEscopo === 'regional' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-regional">
                      Regional Selecionada
                    </label>
                    <select
                      id="input-regional"
                      value={escopoId}
                      onChange={(e) => setEscopoId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                      disabled={salvando}
                    >
                      <option value="">Selecione...</option>
                      {regionais.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                    </select>
                  </div>
                )}
                {tipoEscopo === 'administracao' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-administracao">
                      Administração Selecionada
                    </label>
                    <select
                      id="input-administracao"
                      value={escopoId}
                      onChange={(e) => setEscopoId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                      disabled={salvando}
                    >
                      <option value="">Selecione...</option>
                      {administracoes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                  </div>
                )}
                {tipoEscopo === 'setor' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-setor">
                      Setor Selecionado
                    </label>
                    <select
                      id="input-setor"
                      value={escopoId}
                      onChange={(e) => setEscopoId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                      disabled={salvando}
                    >
                      <option value="">Selecione...</option>
                      {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                  </div>
                )}
                {tipoEscopo === 'casa' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-casa">
                      Casa de Oração Selecionada
                    </label>
                    <select
                      id="input-casa"
                      value={escopoId}
                      onChange={(e) => setEscopoId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                      disabled={salvando}
                    >
                      <option value="">Selecione...</option>
                      {casas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                )}
                {tipoEscopo === 'gt' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-gt">
                      Grupo de Trabalho Selecionado
                    </label>
                    <select
                      id="input-gt"
                      value={escopoId}
                      onChange={(e) => setEscopoId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                      disabled={salvando}
                    >
                      <option value="">Selecione...</option>
                      {gts.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                    </select>
                  </div>
                )}
                
                {errosForm.escopo && <p className="text-xs text-red-600 mt-2">{errosForm.escopo}</p>}
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
                  Vínculo Ativo
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
                  {salvando ? 'Salvando...' : modoForm === 'criar' ? 'Salvar Vínculo' : 'Atualizar Vínculo'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Carregando vínculos funcionais...
          </div>
        ) : vinculos.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Nenhum vínculo funcional cadastrado até o momento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">Membro</th>
                  <th className="p-3">Função</th>
                  <th className="p-3">Escopo</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vinculos.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-800">
                      {v.membro?.nome || 'Membro não encontrado'}
                    </td>
                    <td className="p-3 text-slate-600">
                      {v.funcao?.nome || 'Função não encontrada'}
                    </td>
                    <td className="p-3 text-xs text-slate-500">
                      {renderNomeEscopo(v)}
                    </td>
                    <td className="p-3">
                      {v.ativo ? (
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
                        onClick={() => verDetalhes(v)}
                        className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                      >
                        Detalhes
                      </button>
                      <button
                        onClick={() => abrirFormEditar(v.id)}
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
      {vinculoDetalhe && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div 
            className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-detalhes-titulo"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 id="modal-detalhes-titulo" className="font-bold text-slate-800 text-base">Detalhes do Vínculo</h3>
              <button
                onClick={() => setVinculoDetalhe(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs font-semibold text-slate-500 block">Membro:</span>
                <span className="font-semibold text-slate-800">{vinculoDetalhe.membro?.nome || 'Desconhecido'}</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 block">Função:</span>
                <span className="text-slate-700">{vinculoDetalhe.funcao?.nome || 'Desconhecida'}</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 block">Escopo:</span>
                <span className="text-slate-700">{renderNomeEscopo(vinculoDetalhe)}</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 block">Status:</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  vinculoDetalhe.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {vinculoDetalhe.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 block">ID do Vínculo:</span>
                <span className="text-xs font-mono text-slate-600">{vinculoDetalhe.id}</span>
              </div>
              {vinculoDetalhe.createdAt && (
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Criado em:</span>
                  <span className="text-xs text-slate-600">{new Date(vinculoDetalhe.createdAt).toLocaleString('pt-BR')}</span>
                </div>
              )}
            </div>

            <div className="text-right pt-3 border-t border-slate-100">
              <button
                onClick={() => setVinculoDetalhe(null)}
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
