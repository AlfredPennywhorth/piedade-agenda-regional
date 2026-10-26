import { AjudaContextual } from '../ajuda/AjudaContextual'
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
  const [paginaMobile, setPaginaMobile] = useState(1)
  const [restaurarCardId, setRestaurarCardId] = useState<string | null>(null)
  const TAMANHO_PAGINA_MOBILE = 10

  // Estado do formulário ('criar' | 'editar' | null)
  const [modoForm, setModoForm] = useState<'criar' | 'editar' | null>(null)
  const [casaEditandoId, setCasaEditandoId] = useState<string | null>(null)
  const [carregandoDetalhes, setCarregandoDetalhes] = useState<boolean>(false)
  const [solicitacaoEdicao, setSolicitacaoEdicao] = useState(0)

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
    setRestaurarCardId(id)
    setSolicitacaoEdicao(atual => atual + 1)
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

  useEffect(() => {
    if (modoForm === 'editar' && !carregandoDetalhes) {
      document.getElementById('casas-formulario')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    }
  }, [modoForm, carregandoDetalhes, solicitacaoEdicao])

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
    const cardId = restaurarCardId
    setRestaurarCardId(null)
    if (cardId) requestAnimationFrame(() => document.getElementById(`casa-card-${cardId}`)?.scrollIntoView?.({ block: 'nearest' }))
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

  const totalPaginasMobile = Math.max(1, Math.ceil(casasFiltradas.length / TAMANHO_PAGINA_MOBILE))
  const paginaAtualMobile = Math.min(paginaMobile, totalPaginasMobile)
  const casasPaginaMobile = casasFiltradas.slice((paginaAtualMobile - 1) * TAMANHO_PAGINA_MOBILE, paginaAtualMobile * TAMANHO_PAGINA_MOBILE)

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
      <div className="bg-[#1E293B] text-[#F8FAFC] p-4 rounded-xl border border-slate-600 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 w-full sm:w-auto">
          <label htmlFor="select-filtro-setor" className="text-sm font-semibold text-[#F8FAFC]">
            Filtrar por Setor:
          </label>
          <select
            id="select-filtro-setor"
            value={filtroSetorId}
            onChange={(e) => { setFiltroSetorId(e.target.value); setPaginaMobile(1) }}
            className="w-full sm:w-auto min-w-0 px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="">Todos os Setores</option>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} {s.codigo ? `(${s.codigo})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-slate-200 font-medium">
          Encontradas {casasFiltradas.length} de {casas.length} casas de oração
        </div>
      </div>

      {/* Form de Criação / Edição */}
      {modoForm && (
        <div id="casas-formulario" className="scroll-mt-20 bg-[#0F172A] text-[#F8FAFC] p-4 sm:p-5 rounded-2xl border border-slate-600 shadow-md space-y-4">
          <AjudaContextual /><span data-screen-code={modoForm === 'criar' ? 'AGD-ADM-043' : 'AGD-ADM-044'} className="block text-right text-[10px] font-medium tracking-wide text-slate-300">Tela {modoForm === 'criar' ? 'AGD-ADM-043' : 'AGD-ADM-044'}</span>
          <div className="flex justify-between items-center border-b border-slate-600 pb-2">
            <h3 className="font-bold text-[#F8FAFC] text-base">
              {modoForm === 'criar' ? 'Cadastrar Nova Casa de Oração' : 'Editar Casa de Oração'}
            </h3>
            <button
              onClick={fecharForm}
              className="text-slate-200 hover:text-white text-sm font-semibold"
            >
              Cancelar
            </button>
          </div>

          {carregandoDetalhes ? (
            <div className="py-6 text-center text-slate-200 text-sm">Carregando dados da casa de oração...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-[#1E293B] p-4">
              <div>
                <label className="block text-sm font-semibold text-[#F8FAFC] mb-1" htmlFor="input-setor">
                  Setor <span className="text-red-500">*</span>
                </label>
                <select
                  id="input-setor"
                  value={setorId}
                  onChange={(e) => setSetorId(e.target.value)}
                  className={`w-full min-w-0 px-3 py-2 border rounded-lg bg-white text-[#0F172A] text-sm focus:outline-none focus:ring-2 ${
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
                <label className="block text-sm font-semibold text-[#F8FAFC] mb-1" htmlFor="input-nome">
                  Nome da Casa de Oração <span className="text-red-500">*</span>
                </label>
                <input
                  id="input-nome"
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Central de Osasco"
                  className={`w-full min-w-0 px-3 py-2 border rounded-lg bg-white text-[#0F172A] text-sm focus:outline-none focus:ring-2 ${
                    errosForm.nome ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-200'
                  }`}
                  disabled={salvando}
                />
                {errosForm.nome && (
                  <p className="text-xs text-red-600 mt-1">{errosForm.nome}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#F8FAFC] mb-1" htmlFor="input-codigo">
                  Código (Opcional)
                </label>
                <input
                  id="input-codigo"
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ex: C-OSC-01"
                  className={`w-full min-w-0 px-3 py-2 border rounded-lg bg-white text-[#0F172A] text-sm focus:outline-none focus:ring-2 ${
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
                <label htmlFor="input-ativo" className="text-sm text-[#F8FAFC] font-medium">
                  Casa de Oração Ativa
                </label>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-600">
                <button
                  type="button"
                  onClick={fecharForm}
                  className="min-h-11 px-4 py-2 bg-[#CBD5E1] hover:bg-white text-[#0F172A] rounded-lg text-sm font-medium transition-colors"
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-11 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
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
      <div className="bg-[#1E293B] text-[#F8FAFC] rounded-xl border border-slate-600 shadow-sm overflow-hidden">
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

          <>
          <div className="casas-mobile-cards md:hidden p-3 space-y-3 min-w-0" data-testid="casas-lista-mobile">
            {casasPaginaMobile.map((casa) => (
              <article key={casa.id} id={`casa-card-${casa.id}`} className="rounded-xl border border-slate-600 bg-[#1E293B] text-[#F8FAFC] p-4 space-y-3 min-w-0">
                <h3 className="font-semibold text-[#F8FAFC] whitespace-normal break-words [overflow-wrap:anywhere]">{casa.nome}</h3>
                <div className="text-sm text-slate-200 break-words"><strong>Setor:</strong> {getSetorNome(casa.setorId)}</div>
                <div className="text-sm text-slate-200 break-words"><strong>Código:</strong> {casa.codigo || '-'}</div>
                <div className="text-sm text-slate-200"><strong>Status:</strong> {casa.ativo ? 'Ativo' : 'Inativo'}</div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-600">
                  <button type="button" onClick={() => verDetalhes(casa.id)} className="flex-1 min-w-0 min-h-11 px-3 py-2 text-sm font-semibold rounded-lg bg-[#CBD5E1] text-[#0F172A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600">Detalhes</button>
                  <button type="button" onClick={() => { void abrirFormEditar(casa.id) }} className="flex-1 min-w-0 min-h-11 px-3 py-2 text-sm font-semibold rounded-lg bg-[#2563EB] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">Editar</button>
                </div>
              </article>
            ))}
            <nav aria-label="Paginação das Casas de Oração" className="flex items-center justify-between gap-2 pt-2">
              <button type="button" disabled={paginaAtualMobile <= 1} onClick={() => setPaginaMobile(Math.max(1, paginaAtualMobile - 1))} className="min-h-11 px-3 py-2 rounded-lg bg-[#CBD5E1] text-[#0F172A] text-sm font-semibold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600">Anterior</button>
              <span className="text-xs text-slate-200 text-center" aria-live="polite">Página {paginaAtualMobile} de {totalPaginasMobile}</span>
              <button type="button" disabled={paginaAtualMobile >= totalPaginasMobile} onClick={() => setPaginaMobile(Math.min(totalPaginasMobile, paginaAtualMobile + 1))} className="min-h-11 px-3 py-2 rounded-lg bg-[#CBD5E1] text-[#0F172A] text-sm font-semibold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600">Próxima</button>
            </nav>
          </div>
          <div className="casas-desktop-table hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-3 p-4 min-w-0" data-testid="casas-lista-desktop">
            {casasFiltradas.map((casa) => (
              <article key={casa.id} className="min-w-0 rounded-xl border border-slate-600 bg-[#1E293B] p-4 space-y-3">
                <h3 className="text-base font-semibold text-[#F8FAFC] whitespace-normal break-words [overflow-wrap:anywhere]">{casa.nome}</h3>
                <dl className="space-y-2 text-sm">
                  <div className="min-w-0"><dt className="inline font-semibold text-slate-300">Setor: </dt><dd className="inline text-slate-100 break-words [overflow-wrap:anywhere]">{getSetorNome(casa.setorId)}</dd></div>
                  <div className="min-w-0"><dt className="inline font-semibold text-slate-300">Código: </dt><dd className="inline font-mono text-slate-100 break-all">{casa.codigo || '-'}</dd></div>
                  <div><dt className="inline font-semibold text-slate-300">Status: </dt><dd className="inline"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${casa.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'}`}>{casa.ativo ? 'Ativo' : 'Inativo'}</span></dd></div>
                </dl>
                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-600">
                  <button type="button" onClick={() => verDetalhes(casa.id)} className="flex-1 min-w-0 min-h-11 px-3 py-2 rounded-lg bg-[#CBD5E1] text-[#0F172A] text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Detalhes</button>
                  <button type="button" onClick={() => { void abrirFormEditar(casa.id) }} className="flex-1 min-w-0 min-h-11 px-3 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Editar</button>
                </div>
              </article>
            ))}
          </div>
          </>
        )}
      </div>

      {/* Modal de Detalhes da Casa de Oração */}
      {casaDetalhe && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0F172A] text-[#F8FAFC] rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 space-y-4 shadow-xl border border-slate-600 break-words">
            <div className="flex justify-between items-center border-b border-slate-600 pb-2">
              <h3 className="font-bold text-[#F8FAFC] text-base">Detalhes da Casa de Oração</h3><AjudaContextual />
              <button
                onClick={() => setCasaDetalhe(null)}
                className="text-slate-200 hover:text-white text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {carregandoDetalheModal ? (
              <div className="py-6 text-center text-slate-200 text-sm">Carregando detalhes...</div>
            ) : (
              <div className="space-y-3 text-sm rounded-xl bg-[#1E293B] p-4">
                <div>
                  <span className="text-xs font-semibold text-slate-300 block">Nome:</span>
                  <span className="font-semibold text-[#F8FAFC]">{casaDetalhe.nome}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-300 block">Setor:</span>
                  <span className="text-[#F8FAFC] font-medium">{getSetorNome(casaDetalhe.setorId)}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-300 block">Código:</span>
                  <span className="font-mono text-[#F8FAFC] break-all">{casaDetalhe.codigo || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-300 block">Status:</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    casaDetalhe.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {casaDetalhe.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {casaDetalhe.createdAt && (
                  <div>
                    <span className="text-xs font-semibold text-slate-300 block">Data de Criação:</span>
                    <span className="text-sm text-slate-200">{new Date(casaDetalhe.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                )}
              </div>
            )}

            <div className="text-right pt-3 border-t border-slate-600">
              <button
                onClick={() => setCasaDetalhe(null)}
                className="min-h-11 px-4 py-2 bg-[#CBD5E1] hover:bg-slate-100 text-[#0F172A] rounded-lg text-sm font-medium transition-colors"
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
