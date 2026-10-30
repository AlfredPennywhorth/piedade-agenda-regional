import { TerritorialDetailsDialog } from '../layout/TerritorialDetailsDialog'
import { useTerritorialFormNavigation } from '../layout/useTerritorialFormNavigation'
import { AjudaContextual } from '../ajuda/AjudaContextual'
import { useState, useEffect, useRef } from 'react'
import { CreateRegionalSchema, UpdateRegionalSchema } from '@piedade/shared'
import { fetchWithAuth, postWithAuth, patchWithAuth, ApiError } from '../../api/apiClient'

export interface Regional {
  id: string
  nome: string
  codigo: string | null
  ativo: boolean
  createdAt?: string
  updatedAt?: string
}

export function RegionaisView({ podeEditar = true }: { podeEditar?: boolean }) {
  const [regionais, setRegionais] = useState<Regional[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Estado do modal/modo de formulário (null = fechado, 'criar' = novo, 'editar' = editando)
  const [modoForm, setModoForm] = useState<'criar' | 'editar' | null>(null)
  const [regionalEditandoId, setRegionalEditandoId] = useState<string | null>(null)
  const [carregandoDetalhes, setCarregandoDetalhes] = useState<boolean>(false)

  // Estado do detalhe visualizado
  const [regionalDetalhe, setRegionalDetalhe] = useState<Regional | null>(null)
  const [carregandoDetalheModal, setCarregandoDetalheModal] = useState<boolean>(false)

  // Campos do formulário
  const [nome, setNome] = useState<string>('')
  const [codigo, setCodigo] = useState<string>('')
  const [ativo, setAtivo] = useState<boolean>(true)
  const [errosForm, setErrosForm] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<boolean>(false)

  const { formRef, guardarOrigem, retornar } = useTerritorialFormNavigation(
    modoForm !== null,
    carregandoDetalhes,
    loading
  )

  const carregarRegionais = async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await fetchWithAuth<Regional[]>('/regionais')
      setRegionais(data)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar a lista de regionais.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarRegionais()
  }, [])

  const abrirFormCriar = () => {
    setModoForm('criar')
    setRegionalEditandoId(null)
    setNome('')
    setCodigo('')
    setAtivo(true)
    setErrosForm({})
    setErro(null)
    setSucesso(null)
  }

  const abrirFormEditar = async (id: string) => {
    setModoForm('editar')
    setRegionalEditandoId(id)
    setCarregandoDetalhes(true)
    setErrosForm({})
    setErro(null)
    setSucesso(null)

    try {
      const item = await fetchWithAuth<Regional>(`/regionais/${id}`)
      setNome(item.nome || '')
      setCodigo(item.codigo || '')
      setAtivo(item.ativo ?? true)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os detalhes da regional para edição.')
      retornar()
      setModoForm(null)
    } finally {
      setCarregandoDetalhes(false)
    }
  }

  const detalheRequest = useRef(0)
  const fecharDetalhes = () => {
    detalheRequest.current += 1
    setCarregandoDetalheModal(false)
    setRegionalDetalhe(null)
  }

  const verDetalhes = async (id: string) => {
    const request = ++detalheRequest.current
    setRegionalDetalhe(null)
    setCarregandoDetalheModal(true)
    setErro(null)
    try {
      const item = await fetchWithAuth<Regional>(`/regionais/${id}`)
      if (request === detalheRequest.current) setRegionalDetalhe(item)
    } catch (err: any) {
      if (request !== detalheRequest.current) return
      setErro(err.message || 'Erro ao carregar os detalhes da regional.')
    } finally {
      if (request === detalheRequest.current) setCarregandoDetalheModal(false)
    }
  }

  const fecharForm = () => {
    retornar()
    setModoForm(null)
    setRegionalEditandoId(null)
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
      ativo,
    }

    if (modoForm === 'criar') {
      const parsed = CreateRegionalSchema.safeParse(payload)
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {}
        parsed.error.issues.forEach(issue => {
          if (issue.path[0]) {
            fieldErrors[String(issue.path[0])] = issue.message
          }
        })
        setErrosForm(fieldErrors)
        return
      }

      setSalvando(true)
      try {
        await postWithAuth('/regionais', parsed.data)
        setSucesso('Regional criada com sucesso!')
        fecharForm()
        await carregarRegionais()
      } catch (err: any) {
        if (err instanceof ApiError && err.body?.error) {
          setErro(
            typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos para criação.'
          )
        } else {
          setErro(err.message || 'Erro ao criar a regional.')
        }
      } finally {
        setSalvando(false)
      }
    } else if (modoForm === 'editar' && regionalEditandoId) {
      const parsed = UpdateRegionalSchema.safeParse(payload)
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {}
        parsed.error.issues.forEach(issue => {
          if (issue.path[0]) {
            fieldErrors[String(issue.path[0])] = issue.message
          }
        })
        setErrosForm(fieldErrors)
        return
      }

      setSalvando(true)
      try {
        await patchWithAuth(`/regionais/${regionalEditandoId}`, parsed.data)
        setSucesso('Regional atualizada com sucesso!')
        fecharForm()
        await carregarRegionais()
      } catch (err: any) {
        if (err instanceof ApiError && err.body?.error) {
          setErro(
            typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos para edição.'
          )
        } else {
          setErro(err.message || 'Erro ao atualizar a regional.')
        }
      } finally {
        setSalvando(false)
      }
    }
  }

  return (
    <div className="min-w-0 p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Gestão Territorial — Regionais</h2>
          <p className="text-xs text-slate-500">
            {podeEditar ? 'Listagem, cadastro e atualização de Regionais' : 'Consulta de Regionais'}
          </p>
        </div>
        {podeEditar && (
          <button
            id="novo-regionais"
            onClick={e => {
              guardarOrigem(e.currentTarget)
              abrirFormCriar()
            }}
            className="min-h-[44px] bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            + Nova Regional
          </button>
        )}
      </div>

      {/* Mensagens Globais de Erro e Sucesso */}
      {erro && (
        <div
          role="alert"
          className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm flex justify-between items-center"
        >
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{erro}</span>
          <button
            onClick={() => setErro(null)}
            className="text-red-500 hover:text-red-700 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {sucesso && (
        <div
          role="status"
          className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm flex justify-between items-center"
        >
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{sucesso}</span>
          <button
            onClick={() => setSucesso(null)}
            className="text-emerald-500 hover:text-emerald-700 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Form de Criação / Edição Inline ou Card */}
      {podeEditar && modoForm && (
        <div
          ref={formRef}
          className="min-w-0 scroll-mt-28 bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-md space-y-4"
        >
          <AjudaContextual />
          <span
            data-screen-code={modoForm === 'criar' ? 'AGD-ADM-037' : 'AGD-ADM-038'}
            className="block text-right text-[10px] font-medium tracking-wide text-slate-500"
          >
            Tela {modoForm === 'criar' ? 'AGD-ADM-037' : 'AGD-ADM-038'}
          </span>
          <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-base">
              {modoForm === 'criar' ? 'Cadastrar Nova Regional' : 'Editar Regional'}
            </h3>
            <button
              onClick={fecharForm}
              className="min-h-[44px] px-3 text-slate-600 hover:text-slate-800 text-sm font-semibold"
            >
              Cancelar
            </button>
          </div>

          {carregandoDetalhes ? (
            <div className="py-6 text-center text-slate-500 text-sm">
              Carregando dados da regional...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  className="block text-xs font-semibold text-slate-700 mb-1"
                  htmlFor="input-nome"
                >
                  Nome da Regional <span className="text-red-500">*</span>
                </label>
                <input
                  id="input-nome"
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: São Paulo Leste"
                  className={`min-w-0 w-full min-h-[44px] px-3 py-2 border rounded-lg text-base focus:outline-none focus:ring-2 ${
                    errosForm.nome
                      ? 'border-red-400 focus:ring-red-200'
                      : 'border-slate-300 focus:ring-brand-200'
                  }`}
                  disabled={salvando}
                />
                {errosForm.nome && <p className="text-xs text-red-600 mt-1">{errosForm.nome}</p>}
              </div>

              <div>
                <label
                  className="block text-xs font-semibold text-slate-700 mb-1"
                  htmlFor="input-codigo"
                >
                  Código (Opcional)
                </label>
                <input
                  id="input-codigo"
                  type="text"
                  value={codigo}
                  onChange={e => setCodigo(e.target.value)}
                  placeholder="Ex: SP-LST"
                  className={`min-w-0 w-full min-h-[44px] px-3 py-2 border rounded-lg text-base focus:outline-none focus:ring-2 ${
                    errosForm.codigo
                      ? 'border-red-400 focus:ring-red-200'
                      : 'border-slate-300 focus:ring-brand-200'
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
                  onChange={e => setAtivo(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  disabled={salvando}
                />
                <label htmlFor="input-ativo" className="text-sm text-slate-700 font-medium">
                  Regional Ativa
                </label>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={fecharForm}
                  className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
                  disabled={salvando}
                >
                  {salvando
                    ? 'Salvando...'
                    : modoForm === 'criar'
                      ? 'Salvar Regional'
                      : 'Atualizar Regional'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Lista de Regionais */}
      <div className="min-w-0">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Carregando regionais...</div>
        ) : regionais.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Nenhuma regional cadastrada até o momento.
          </div>
        ) : (
          <div className="min-w-0">
            <table
              role="table"
              aria-label="Regionais cadastradas"
              className="territorial-table w-full table-fixed text-left text-sm"
            >
              <thead
                role="rowgroup"
                className="sr-only md:not-sr-only bg-slate-50 text-slate-600 border-b border-slate-200"
              >
                <tr role="row">
                  <th scope="col" className="p-3">
                    Nome
                  </th>
                  <th scope="col" className="p-3">
                    Código
                  </th>
                  <th scope="col" className="p-3">
                    Status
                  </th>
                  <th scope="col" className="p-3 text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup" className="divide-y divide-slate-100">
                {regionais.map(reg => (
                  <tr role="row" key={reg.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-800 [overflow-wrap:anywhere]">
                      {reg.nome}
                    </td>
                    <td
                      data-label="Código"
                      className="p-3 text-xs text-slate-600 font-mono [overflow-wrap:anywhere]"
                    >
                      {reg.codigo || '-'}
                    </td>
                    <td data-label="Status" className="p-3">
                      {reg.ativo ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() => verDetalhes(reg.id)}
                          className="min-h-[44px] text-sm text-slate-600 hover:text-slate-900 font-medium px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                        >
                          Detalhes
                        </button>
                        {podeEditar && (
                          <button
                            id={`editar-regional-${reg.id}`}
                            onClick={e => {
                              guardarOrigem(e.currentTarget)
                              abrirFormEditar(reg.id)
                            }}
                            className="min-h-[44px] text-sm text-brand-600 hover:text-brand-800 font-medium px-3 py-2 bg-brand-50 hover:bg-brand-100 rounded transition-colors"
                          >
                            Editar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalhes da Regional */}
      {(regionalDetalhe || carregandoDetalheModal) && (
        <TerritorialDetailsDialog titulo="Detalhes da Regional" onClose={fecharDetalhes}>
          <AjudaContextual />
          {carregandoDetalheModal ? (
            <div className="py-6 text-center text-slate-500 text-sm">Carregando detalhes...</div>
          ) : (
            regionalDetalhe && (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Nome:</span>
                  <span className="font-semibold text-slate-800">{regionalDetalhe.nome}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Código:</span>
                  <span className="font-mono text-slate-700">
                    {regionalDetalhe.codigo || 'Não informado'}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Status:</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      regionalDetalhe.ativo
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {regionalDetalhe.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {regionalDetalhe.createdAt && (
                  <div>
                    <span className="text-xs font-semibold text-slate-500 block">
                      Data de Criação:
                    </span>
                    <span className="text-xs text-slate-600">
                      {new Date(regionalDetalhe.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                )}
              </div>
            )
          )}

          <div className="text-right pt-3 border-t border-slate-100">
            <button
              onClick={fecharDetalhes}
              className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
            >
              Fechar
            </button>
          </div>
        </TerritorialDetailsDialog>
      )}
    </div>
  )
}
