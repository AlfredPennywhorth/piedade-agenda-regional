import { useState, useEffect } from 'react'
import { SerieCreateInput } from '@piedade/shared'
import { SerieFormModal } from './SerieFormModal'
import { fetchWithAuth, postWithAuth, patchWithAuth, ApiError } from '../../api/apiClient'
import type { Casa } from '../casas/CasasView'
import type { Setor } from '../setores/SetoresView'
import type { Administracao } from '../administracoes/AdministracoesView'
import type { Regional } from '../regionais/RegionaisView'
import type { GrupoTrabalho } from '../grupos-trabalho/GruposTrabalhoView'
import type { Membro } from '../membros/MembrosView'

interface Local {
  id: string
  nome: string
}

export interface SerieRecorrencia {
  id: string
  titulo: string
  descricao: string | null
  pauta: string | null
  modalidade: 'PRESENCIAL' | 'ONLINE' | 'HIBRIDO'
  frequencia: 'DIARIA' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL_DIA_FIXO' | 'MENSAL_POSICAO_SEMANA'
  intervalo: number
  dataInicio: string
  dataFim: string
  horarioInicio: string
  horarioFim: string
  diaSemana: number | null
  diaMes: number | null
  posicaoSemanaMes: number | null
  localId: string | null
  urlOnline: string | null
  organizadorMembroId: string | null
  regionalId: string | null
  administracaoId: string | null
  setorId: string | null
  casaId: string | null
  grupoTrabalhoId: string | null
  observacoes: string | null
  ativo: boolean
  createdAt?: string
  updatedAt?: string
}

export function SeriesView() {
  const [series, setSeries] = useState<SerieRecorrencia[]>([])
  
  // Lookups
  const [locais, setLocais] = useState<Local[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [regionais, setRegionais] = useState<Regional[]>([])
  const [administracoes, setAdministracoes] = useState<Administracao[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [casas, setCasas] = useState<Casa[]>([])
  const [gruposTrabalho, setGruposTrabalho] = useState<GrupoTrabalho[]>([])

  const [loading, setLoading] = useState<boolean>(true)
  const [erro, setErro] = useState<string | null>(null)
  const [lookupAviso, setLookupAviso] = useState<string | null>(null)
  
  // Form State
  const [formOpen, setFormOpen] = useState(false)
  const [salvando, setSalvando] = useState<boolean>(false)
  
  const [serieEditandoId, setSerieEditandoId] = useState<string | null>(null)
  const [confirmacaoEditar, setConfirmacaoEditar] = useState<Partial<SerieCreateInput> | null>(null)
  const [confirmacaoInativar, setConfirmacaoInativar] = useState<SerieRecorrencia | null>(null)

  // Modal Details
  const [serieDetalhe, setSerieDetalhe] = useState<SerieRecorrencia | null>(null)

  const [formData, setFormData] = useState<Partial<SerieCreateInput>>({
    titulo: '',
    descricao: '',
    pauta: '',
    modalidade: 'PRESENCIAL',
    frequencia: 'SEMANAL',
    intervalo: 1,
    dataInicio: '',
    dataFim: '',
    horarioInicio: '',
    horarioFim: '',
    diaSemana: 0,
    diaMes: 1,
    posicaoSemanaMes: 1,
    localId: '',
    urlOnline: '',
    organizadorMembroId: '',
    regionalId: '',
    administracaoId: '',
    setorId: '',
    casaId: '',
    grupoTrabalhoId: '',
    observacoes: '',
    ativo: true,
  })
  
  const [tipoEscopo, setTipoEscopo] = useState<'regional' | 'administracao' | 'setor' | 'casa' | 'grupoTrabalho' | ''>('')
  

  const carregarDados = async () => {
    setLoading(true)
    setErro(null)
    setLookupAviso(null)
    try {
      const seriesData = await fetchWithAuth<SerieRecorrencia[]>('/series-recorrencia')
      setSeries(seriesData || [])

      const resultados = await Promise.allSettled([
        fetchWithAuth<Local[]>('/locais'),
        fetchWithAuth<Membro[]>('/membros'),
        fetchWithAuth<Regional[]>('/regionais'),
        fetchWithAuth<Administracao[]>('/administracoes'),
        fetchWithAuth<Setor[]>('/setores'),
        fetchWithAuth<Casa[]>('/casas'),
        fetchWithAuth<GrupoTrabalho[]>('/grupos-trabalho'),
      ])

      const setters = [
        (valor: unknown) => setLocais(valor as Local[]),
        (valor: unknown) => setMembros(valor as Membro[]),
        (valor: unknown) => setRegionais(valor as Regional[]),
        (valor: unknown) => setAdministracoes(valor as Administracao[]),
        (valor: unknown) => setSetores(valor as Setor[]),
        (valor: unknown) => setCasas(valor as Casa[]),
        (valor: unknown) => setGruposTrabalho(valor as GrupoTrabalho[]),
      ]

      let lookupFalhou = false
      resultados.forEach((resultado, indice) => {
        if (resultado.status === 'fulfilled') {
          setters[indice](resultado.value || [])
        } else {
          lookupFalhou = true
        }
      })

      if (lookupFalhou) {
        setLookupAviso('A lista de séries foi carregada, mas alguns dados auxiliares estão indisponíveis. Tente atualizar antes de criar ou editar.')
      }
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar as séries.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])



  const abrirFormCriar = () => {
    setSerieEditandoId(null)
    setFormData({
      titulo: '',
      descricao: '',
      pauta: '',
      modalidade: 'PRESENCIAL',
      frequencia: 'SEMANAL',
      intervalo: 1,
      dataInicio: '',
      dataFim: '',
      horarioInicio: '',
      horarioFim: '',
      diaSemana: 0,
      diaMes: null,
      posicaoSemanaMes: null,
      localId: '',
      urlOnline: '',
      organizadorMembroId: '',
      regionalId: '',
      administracaoId: '',
      setorId: '',
      casaId: '',
      grupoTrabalhoId: '',
      observacoes: '',
      ativo: true,
    })
    setTipoEscopo('')
    setErro(null)
    setFormOpen(true)
  }

  const abrirFormEditar = (serie: SerieRecorrencia) => {
    setSerieEditandoId(serie.id)
    setFormData({
      titulo: serie.titulo,
      descricao: serie.descricao || '',
      pauta: serie.pauta || '',
      modalidade: serie.modalidade,
      frequencia: serie.frequencia,
      intervalo: 1,
      dataInicio: serie.dataInicio,
      dataFim: serie.dataFim,
      horarioInicio: serie.horarioInicio,
      horarioFim: serie.horarioFim,
      diaSemana: serie.diaSemana,
      diaMes: serie.diaMes,
      posicaoSemanaMes: serie.posicaoSemanaMes,
      localId: serie.localId || '',
      urlOnline: serie.urlOnline || '',
      organizadorMembroId: serie.organizadorMembroId || '',
      regionalId: serie.regionalId || '',
      administracaoId: serie.administracaoId || '',
      setorId: serie.setorId || '',
      casaId: serie.casaId || '',
      grupoTrabalhoId: serie.grupoTrabalhoId || '',
      observacoes: serie.observacoes || '',
      ativo: serie.ativo,
    })
    
    if (serie.regionalId) setTipoEscopo('regional')
    else if (serie.administracaoId) setTipoEscopo('administracao')
    else if (serie.setorId) setTipoEscopo('setor')
    else if (serie.casaId) setTipoEscopo('casa')
    else if (serie.grupoTrabalhoId) setTipoEscopo('grupoTrabalho')
    else setTipoEscopo('')
    
    setErro(null)
    setFormOpen(true)
  }


  const confirmarEdicao = async () => {
    if (!serieEditandoId || !confirmacaoEditar) return
    setSalvando(true)
    setErro(null)
    try {
      const payload = {
        updateMode: 'ALL',
        changes: confirmacaoEditar
      }
      await patchWithAuth(`/series-recorrencia/${serieEditandoId}`, payload)
      setConfirmacaoEditar(null)
      setFormOpen(false)
      carregarDados()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.body?.error) {
        setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos')
      } else if (err instanceof Error) {
        setErro(err.message)
      } else {
        setErro('Erro ao atualizar série.')
      }
      setConfirmacaoEditar(null)
    } finally {
      setSalvando(false)
    }
  }

  const confirmarInativacaoSubmit = async () => {
    if (!confirmacaoInativar) return
    setSalvando(true)
    setErro(null)
    try {
      const payload = {
        updateMode: 'ALL',
        changes: { ativo: false }
      }
      await patchWithAuth(`/series-recorrencia/${confirmacaoInativar.id}`, payload)
      setConfirmacaoInativar(null)
      carregarDados()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao inativar série.')
      setConfirmacaoInativar(null)
    } finally {
      setSalvando(false)
    }
  }

  const getFrequenciaLabel = (freq: string) => {
    switch(freq) {
      case 'DIARIA': return 'Diária'
      case 'SEMANAL': return 'Semanal'
      case 'QUINZENAL': return 'Quinzenal'
      case 'MENSAL_DIA_FIXO': return 'Mensal (Dia fixo)'
      case 'MENSAL_POSICAO_SEMANA': return 'Mensal (Posição da semana)'
      default: return freq
    }
  }

  const formatarData = (data: string) => {
    const [ano, mes, dia] = data.split('-')
    return ano && mes && dia ? `${dia}/${mes}/${ano}` : data
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="bg-brand-900 text-white p-6 rounded-2xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Séries</h2>
          <p className="text-brand-200 text-sm mt-1">Administração de eventos recorrentes</p>
        </div>
        <button
          onClick={abrirFormCriar}
          className="px-5 py-2.5 bg-white text-brand-900 font-semibold rounded-lg text-sm hover:bg-brand-50 transition-colors shadow-sm whitespace-nowrap"
        >
          + Nova Série
        </button>
      </div>

      {erro && !formOpen && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm animate-in fade-in">
          {erro}
        </div>
      )}

      {lookupAviso && !formOpen && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm animate-in fade-in">
          {lookupAviso}
        </div>
      )}

      {loading && !formOpen && !serieDetalhe ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
      ) : (series || []).length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 mb-4">Nenhuma série cadastrada.</p>
          <button onClick={abrirFormCriar} className="text-brand-600 font-medium hover:text-brand-700">
            Cadastrar primeira série
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Título</th>
                  <th className="px-6 py-4">Frequência</th>
                  <th className="px-6 py-4">Início</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {series.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{item.titulo}</td>
                    <td className="px-6 py-4 text-slate-600">{getFrequenciaLabel(item.frequencia)}</td>
                    <td className="px-6 py-4 text-slate-600">{formatarData(item.dataInicio)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {item.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button onClick={() => setSerieDetalhe(item)} className="text-brand-600 hover:text-brand-900 font-medium">
                        Ver
                      </button>
                      <button onClick={() => abrirFormEditar(item)} className="text-blue-600 hover:text-blue-900 font-medium">
                        Editar
                      </button>
                      {item.ativo && (
                        <button onClick={() => setConfirmacaoInativar(item)} className="text-red-600 hover:text-red-900 font-medium">
                          Inativar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Formulário */}
      <SerieFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={serieEditandoId ? 'Editar Série de Recorrência' : 'Nova Série de Recorrência'}
        initialData={formData}
        initialTipoEscopo={tipoEscopo}
        lookups={{ locais, membros, regionais, administracoes, setores, casas, gruposTrabalho }}
        externalError={formOpen ? (erro ?? lookupAviso) : null}
        onSubmit={async (data) => {
          if (serieEditandoId) {
            setConfirmacaoEditar(data)
          } else {
            setSalvando(true)
            try {
              await postWithAuth('/series-recorrencia', data)
              setFormOpen(false)
              carregarDados()
            } catch (err: unknown) {
              setSalvando(false)
              throw err
            }
            setSalvando(false)
          }
        }}
      />

      {/* Modal Detalhe */}
      {serieDetalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div role="dialog" aria-modal="true" aria-labelledby="modal-detalhe-title" className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 id="modal-detalhe-title" className="text-lg font-semibold text-slate-900">
                Detalhes da Série
              </h3>
              <button onClick={() => setSerieDetalhe(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Título</span>
                <p className="text-slate-900 font-medium">{serieDetalhe.titulo}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Frequência</span>
                  <p className="text-slate-900">{getFrequenciaLabel(serieDetalhe.frequencia)}</p>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Status</span>
                  <p className="text-slate-900">{serieDetalhe.ativo ? 'Ativa' : 'Inativa'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Início</span>
                  <p className="text-slate-900">{formatarData(serieDetalhe.dataInicio)} {serieDetalhe.horarioInicio}</p>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Fim</span>
                  <p className="text-slate-900">{formatarData(serieDetalhe.dataFim)} {serieDetalhe.horarioFim}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Modalidade</span>
                  <p className="text-slate-900">{serieDetalhe.modalidade}</p>
                </div>
              </div>
              {serieDetalhe.descricao && (
                <div>
                  <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Descrição</span>
                  <p className="text-slate-900">{serieDetalhe.descricao}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação Edição */}
      {confirmacaoEditar && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div role="dialog" aria-modal="true" aria-labelledby="modal-confirm-edit-title" className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 space-y-4">
            <h3 id="modal-confirm-edit-title" className="text-lg font-semibold text-slate-900">Confirmar Edição de Série</h3>
            <p className="text-sm text-slate-600">
              Atenção: Ao confirmar esta edição, todas as ocorrências futuras não excepcionais desta série serão <strong>reconstruídas</strong> com base nestas novas regras.
            </p>
            <p className="text-sm text-slate-600">
              Ocorrências passadas e exceções individuais não serão afetadas.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmacaoEditar(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                disabled={salvando}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEdicao}
                disabled={salvando}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Confirmar e Reconstruir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação Inativação */}
      {confirmacaoInativar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div role="dialog" aria-modal="true" aria-labelledby="modal-confirm-inactivate-title" className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 space-y-4">
            <h3 id="modal-confirm-inactivate-title" className="text-lg font-semibold text-red-600">Inativar Série</h3>
            <p className="text-sm text-slate-600">
              Você está prestes a inativar a série <strong>{confirmacaoInativar.titulo}</strong>.
            </p>
            <p className="text-sm text-slate-600">
              Isso fará com que <strong>todos os eventos futuros</strong> desta série sejam inativados. Os eventos passados serão preservados.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmacaoInativar(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                disabled={salvando}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarInativacaoSubmit}
                disabled={salvando}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {salvando ? 'Inativando...' : 'Sim, Inativar Futuros'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
