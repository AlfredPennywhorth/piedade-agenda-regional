import { useState, useEffect } from 'react'
import { SerieCreate, SerieCreateInput } from '@piedade/shared'
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
  
  const [errosForm, setErrosForm] = useState<Record<string, string>>({})

  const carregarDados = async () => {
    setLoading(true)
    setErro(null)
    try {
      const [
        seriesData, locaisData, membrosData, regionaisData,
        administracoesData, setoresData, casasData, gruposData
      ] = await Promise.all([
        fetchWithAuth<SerieRecorrencia[]>('/series-recorrencia'),
        fetchWithAuth<Local[]>('/locais'),
        fetchWithAuth<Membro[]>('/membros'),
        fetchWithAuth<Regional[]>('/regionais'),
        fetchWithAuth<Administracao[]>('/administracoes'),
        fetchWithAuth<Setor[]>('/setores'),
        fetchWithAuth<Casa[]>('/casas'),
        fetchWithAuth<GrupoTrabalho[]>('/grupos-trabalho'),
      ])
      
      setSeries(seriesData || [])
      setLocais(locaisData || [])
      setMembros(membrosData || [])
      setRegionais(regionaisData || [])
      setAdministracoes(administracoesData || [])
      setSetores(setoresData || [])
      setCasas(casasData || [])
      setGruposTrabalho(gruposData || [])
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os dados.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const handleModalidadeChange = (mod: 'PRESENCIAL' | 'ONLINE' | 'HIBRIDO') => {
    setFormData(prev => ({
      ...prev,
      modalidade: mod,
      localId: mod === 'ONLINE' ? '' : prev.localId,
      urlOnline: mod === 'PRESENCIAL' ? '' : prev.urlOnline
    }))
  }

  const handleTipoEscopoChange = (tipo: 'regional' | 'administracao' | 'setor' | 'casa' | 'grupoTrabalho' | '') => {
    setTipoEscopo(tipo)
    setFormData(prev => ({
      ...prev,
      regionalId: '',
      administracaoId: '',
      setorId: '',
      casaId: '',
      grupoTrabalhoId: ''
    }))
  }

  const handleFrequenciaChange = (freq: 'DIARIA' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL_DIA_FIXO' | 'MENSAL_POSICAO_SEMANA') => {
    setFormData(prev => ({
      ...prev,
      frequencia: freq,
      diaSemana: (freq === 'SEMANAL' || freq === 'QUINZENAL' || freq === 'MENSAL_POSICAO_SEMANA') ? (prev.diaSemana ?? 0) : null,
      diaMes: freq === 'MENSAL_DIA_FIXO' ? (prev.diaMes ?? 1) : null,
      posicaoSemanaMes: freq === 'MENSAL_POSICAO_SEMANA' ? (prev.posicaoSemanaMes ?? 1) : null
    }))
  }

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
    setErrosForm({})
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
    
    setErrosForm({})
    setErro(null)
    setFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrosForm({})
    
    const payload = {
      ...formData,
      descricao: formData.descricao || null,
      pauta: formData.pauta || null,
      localId: formData.modalidade === 'ONLINE' ? null : (formData.localId || null),
      urlOnline: formData.modalidade === 'PRESENCIAL' ? null : (formData.urlOnline || null),
      organizadorMembroId: formData.organizadorMembroId || null,
      regionalId: formData.regionalId || null,
      administracaoId: formData.administracaoId || null,
      setorId: formData.setorId || null,
      casaId: formData.casaId || null,
      grupoTrabalhoId: formData.grupoTrabalhoId || null,
      observacoes: formData.observacoes || null,
      
      diaSemana: formData.diaSemana !== null && formData.diaSemana !== undefined ? formData.diaSemana : null,
      diaMes: formData.diaMes !== null && formData.diaMes !== undefined ? formData.diaMes : null,
      posicaoSemanaMes: formData.posicaoSemanaMes !== null && formData.posicaoSemanaMes !== undefined ? formData.posicaoSemanaMes : null,
      intervalo: 1
    }

    try {
      const parsed = SerieCreate.safeParse(payload)

      if (!parsed.success) {
        const errors: any = {}
        parsed.error.issues.forEach((e: any) => {
          if (e.path[0]) {
            errors[e.path[0].toString()] = e.message
          }
        })
        setErrosForm(errors)
        return
      }

      if (serieEditandoId) {
        setConfirmacaoEditar(parsed.data)
        return
      }

      setSalvando(true)

      await postWithAuth('/series-recorrencia', parsed.data)

      setFormOpen(false)
      carregarDados()
    } catch (err: any) {
      if (err instanceof ApiError && err.body?.error) {
        setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos')
      } else {
        setErro(err.message || 'Erro ao salvar série.')
      }
    } finally {
      setSalvando(false)
    }
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
    } catch (err: any) {
      if (err instanceof ApiError && err.body?.error) {
        setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos')
      } else {
        setErro(err.message || 'Erro ao atualizar série.')
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
    } catch (err: any) {
      setErro(err.message || 'Erro ao inativar série.')
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

      {erro && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm animate-in fade-in">
          {erro}
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
                    <td className="px-6 py-4 text-slate-600">{item.dataInicio}</td>
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
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-labelledby="modal-form-title" className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 id="modal-form-title" className="text-lg font-semibold text-slate-900">
                {serieEditandoId ? 'Editar Série de Recorrência' : 'Nova Série de Recorrência'}
              </h3>
              <button onClick={() => setFormOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} noValidate className="p-6 overflow-y-auto space-y-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="titulo" className="block text-sm font-medium text-slate-700 mb-1">Título *</label>
                  <input
                    id="titulo"
                    type="text"
                    value={formData.titulo}
                    onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                  />
                  {errosForm.titulo && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.titulo}</p>}
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm text-slate-900 mb-3">Temporalidade e Recorrência</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="dataInicio" className="block text-sm font-medium text-slate-700 mb-1">Data Início *</label>
                      <input
                        id="dataInicio"
                        type="date"
                        value={formData.dataInicio}
                        onChange={e => setFormData({ ...formData, dataInicio: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                      />
                      {errosForm.dataInicio && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.dataInicio}</p>}
                    </div>
                    <div>
                      <label htmlFor="dataFim" className="block text-sm font-medium text-slate-700 mb-1">Data Fim *</label>
                      <input
                        id="dataFim"
                        type="date"
                        value={formData.dataFim}
                        onChange={e => setFormData({ ...formData, dataFim: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                      />
                      {errosForm.dataFim && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.dataFim}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="horarioInicio" className="block text-sm font-medium text-slate-700 mb-1">Horário Início *</label>
                      <input
                        id="horarioInicio"
                        type="time"
                        value={formData.horarioInicio}
                        onChange={e => setFormData({ ...formData, horarioInicio: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                      />
                      {errosForm.horarioInicio && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.horarioInicio}</p>}
                    </div>
                    <div>
                      <label htmlFor="horarioFim" className="block text-sm font-medium text-slate-700 mb-1">Horário Fim *</label>
                      <input
                        id="horarioFim"
                        type="time"
                        value={formData.horarioFim}
                        onChange={e => setFormData({ ...formData, horarioFim: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                      />
                      {errosForm.horarioFim && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.horarioFim}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="frequencia" className="block text-sm font-medium text-slate-700 mb-1">Frequência *</label>
                      <select
                        id="frequencia"
                        value={formData.frequencia}
                        onChange={e => handleFrequenciaChange(e.target.value as 'DIARIA' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL_DIA_FIXO' | 'MENSAL_POSICAO_SEMANA')}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                      >
                        <option value="DIARIA">Diária</option>
                        <option value="SEMANAL">Semanal</option>
                        <option value="QUINZENAL">Quinzenal</option>
                        <option value="MENSAL_DIA_FIXO">Mensal (Dia Fixo)</option>
                        <option value="MENSAL_POSICAO_SEMANA">Mensal (Posição da Semana)</option>
                      </select>
                      {errosForm.frequencia && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.frequencia}</p>}
                    </div>
                    
                    <div>
                      <label htmlFor="intervalo" className="block text-sm font-medium text-slate-700 mb-1">Intervalo *</label>
                      <input
                        id="intervalo"
                        type="number"
                        min="1"
                        value={formData.intervalo}
                        onChange={e => setFormData({ ...formData, intervalo: Number(e.target.value) === 1 ? 1 : 1 })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                      />
                      {errosForm.intervalo && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.intervalo}</p>}
                    </div>
                  </div>

                  {/* Campos Condicionais de Recorrência */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    {(formData.frequencia === 'SEMANAL' || formData.frequencia === 'QUINZENAL' || formData.frequencia === 'MENSAL_POSICAO_SEMANA') && (
                      <div>
                        <label htmlFor="diaSemana" className="block text-sm font-medium text-slate-700 mb-1">Dia da Semana *</label>
                        <select
                          id="diaSemana"
                          value={formData.diaSemana ?? ''}
                          onChange={e => setFormData({ ...formData, diaSemana: e.target.value ? Number(e.target.value) : null })}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                        >
                          <option value="">Selecione...</option>
                          <option value="0">Domingo</option>
                          <option value="1">Segunda-feira</option>
                          <option value="2">Terça-feira</option>
                          <option value="3">Quarta-feira</option>
                          <option value="4">Quinta-feira</option>
                          <option value="5">Sexta-feira</option>
                          <option value="6">Sábado</option>
                        </select>
                        {errosForm.diaSemana && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.diaSemana}</p>}
                      </div>
                    )}

                    {formData.frequencia === 'MENSAL_DIA_FIXO' && (
                      <div>
                        <label htmlFor="diaMes" className="block text-sm font-medium text-slate-700 mb-1">Dia do Mês *</label>
                        <input
                          id="diaMes"
                          type="number"
                          min="1"
                          max="31"
                          value={formData.diaMes ?? ''}
                          onChange={e => setFormData({ ...formData, diaMes: e.target.value ? Number(e.target.value) : null })}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                        />
                        {errosForm.diaMes && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.diaMes}</p>}
                      </div>
                    )}

                    {formData.frequencia === 'MENSAL_POSICAO_SEMANA' && (
                      <div>
                        <label htmlFor="posicaoSemanaMes" className="block text-sm font-medium text-slate-700 mb-1">Posição na Semana *</label>
                        <select
                          id="posicaoSemanaMes"
                          value={formData.posicaoSemanaMes ?? ''}
                          onChange={e => setFormData({ ...formData, posicaoSemanaMes: e.target.value ? Number(e.target.value) : null })}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                        >
                          <option value="">Selecione...</option>
                          <option value="1">Primeiro</option>
                          <option value="2">Segundo</option>
                          <option value="3">Terceiro</option>
                          <option value="4">Quarto</option>
                          <option value="5">Quinto</option>
                          <option value="-1">Último</option>
                        </select>
                        {errosForm.posicaoSemanaMes && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.posicaoSemanaMes}</p>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm text-slate-900 mb-3">Localização</h4>
                  <div>
                    <label htmlFor="modalidade" className="block text-sm font-medium text-slate-700 mb-1">Modalidade *</label>
                    <select
                      id="modalidade"
                      value={formData.modalidade}
                      onChange={e => handleModalidadeChange(e.target.value as 'PRESENCIAL'|'ONLINE'|'HIBRIDO')}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="PRESENCIAL">Presencial</option>
                      <option value="ONLINE">Online</option>
                      <option value="HIBRIDO">Híbrido</option>
                    </select>
                    {errosForm.modalidade && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.modalidade}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    {(formData.modalidade === 'PRESENCIAL' || formData.modalidade === 'HIBRIDO') && (
                      <div>
                        <label htmlFor="localId" className="block text-sm font-medium text-slate-700 mb-1">Local *</label>
                        <select
                          id="localId"
                          value={formData.localId || ''}
                          onChange={e => setFormData({ ...formData, localId: e.target.value })}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                        >
                          <option value="">Selecione...</option>
                          {locais.map(l => (
                            <option key={l.id} value={l.id}>{l.nome}</option>
                          ))}
                        </select>
                        {errosForm.localId && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.localId}</p>}
                      </div>
                    )}

                    {(formData.modalidade === 'ONLINE' || formData.modalidade === 'HIBRIDO') && (
                      <div>
                        <label htmlFor="urlOnline" className="block text-sm font-medium text-slate-700 mb-1">URL Online *</label>
                        <input
                          id="urlOnline"
                          type="url"
                          value={formData.urlOnline || ''}
                          onChange={e => setFormData({ ...formData, urlOnline: e.target.value })}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                          placeholder="https://..."
                        />
                        {errosForm.urlOnline && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.urlOnline}</p>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm text-slate-900 mb-3">Escopo (Selecione exatamente um)</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="tipoEscopo" className="block text-xs font-medium text-slate-700 mb-1">Tipo de Escopo</label>
                      <select
                        id="tipoEscopo"
                        value={tipoEscopo}
                        onChange={e => handleTipoEscopoChange(e.target.value as any)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                      >
                        <option value="">Selecione...</option>
                        <option value="regional">Regional</option>
                        <option value="administracao">Administração</option>
                        <option value="setor">Setor</option>
                        <option value="casa">Casa</option>
                        <option value="grupoTrabalho">Grupo de Trabalho</option>
                      </select>
                    </div>
                    
                    <div>
                      {tipoEscopo === 'regional' && (
                        <>
                          <label htmlFor="regionalId" className="block text-xs font-medium text-slate-700 mb-1">Regional *</label>
                          <select
                            id="regionalId"
                            value={formData.regionalId || ''}
                            onChange={e => setFormData({ ...formData, regionalId: e.target.value })}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                          >
                            <option value="">Selecione...</option>
                            {regionais.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                          </select>
                        </>
                      )}
                      {tipoEscopo === 'administracao' && (
                        <>
                          <label htmlFor="administracaoId" className="block text-xs font-medium text-slate-700 mb-1">Administração *</label>
                          <select
                            id="administracaoId"
                            value={formData.administracaoId || ''}
                            onChange={e => setFormData({ ...formData, administracaoId: e.target.value })}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                          >
                            <option value="">Selecione...</option>
                            {administracoes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                          </select>
                        </>
                      )}
                      {tipoEscopo === 'setor' && (
                        <>
                          <label htmlFor="setorId" className="block text-xs font-medium text-slate-700 mb-1">Setor *</label>
                          <select
                            id="setorId"
                            value={formData.setorId || ''}
                            onChange={e => setFormData({ ...formData, setorId: e.target.value })}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                          >
                            <option value="">Selecione...</option>
                            {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                          </select>
                        </>
                      )}
                      {tipoEscopo === 'casa' && (
                        <>
                          <label htmlFor="casaId" className="block text-xs font-medium text-slate-700 mb-1">Casa *</label>
                          <select
                            id="casaId"
                            value={formData.casaId || ''}
                            onChange={e => setFormData({ ...formData, casaId: e.target.value })}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                          >
                            <option value="">Selecione...</option>
                            {casas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                          </select>
                        </>
                      )}
                      {tipoEscopo === 'grupoTrabalho' && (
                        <>
                          <label htmlFor="grupoTrabalhoId" className="block text-xs font-medium text-slate-700 mb-1">GT *</label>
                          <select
                            id="grupoTrabalhoId"
                            value={formData.grupoTrabalhoId || ''}
                            onChange={e => setFormData({ ...formData, grupoTrabalhoId: e.target.value })}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                          >
                            <option value="">Selecione...</option>
                            {gruposTrabalho.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                          </select>
                        </>
                      )}
                    </div>
                  </div>
                  {errosForm.escopo && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.escopo}</p>}
                </div>

                <div className="border-t pt-4">
                  <label htmlFor="organizadorMembroId" className="block text-sm font-medium text-slate-700 mb-1">Organizador (Membro)</label>
                  <select
                    id="organizadorMembroId"
                    value={formData.organizadorMembroId || ''}
                    onChange={e => setFormData({ ...formData, organizadorMembroId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">Selecione...</option>
                    {membros.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                  {errosForm.organizadorMembroId && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.organizadorMembroId}</p>}
                </div>

                <div>
                  <label htmlFor="descricao" className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                  <textarea
                    id="descricao"
                    value={formData.descricao || ''}
                    onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                    rows={3}
                  />
                  {errosForm.descricao && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.descricao}</p>}
                </div>

                <div>
                  <label htmlFor="pauta" className="block text-sm font-medium text-slate-700 mb-1">Pauta</label>
                  <textarea
                    id="pauta"
                    value={formData.pauta || ''}
                    onChange={e => setFormData({ ...formData, pauta: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                    rows={2}
                  />
                  {errosForm.pauta && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.pauta}</p>}
                </div>

                <div>
                  <label htmlFor="observacoes" className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                  <textarea
                    id="observacoes"
                    value={formData.observacoes || ''}
                    onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                    rows={2}
                  />
                  {errosForm.observacoes && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.observacoes}</p>}
                </div>

                <div className="flex items-center space-x-2 border-t pt-4">
                  <input
                    type="checkbox"
                    id="ativo"
                    checked={formData.ativo}
                    onChange={e => setFormData({ ...formData, ativo: e.target.checked })}
                    className="h-4 w-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                  />
                  <label htmlFor="ativo" className="text-sm text-slate-700">Série Ativa</label>
                  {errosForm.ativo && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.ativo}</p>}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Salvar Série'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  <p className="text-slate-900">{serieDetalhe.dataInicio} {serieDetalhe.horarioInicio}</p>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Fim</span>
                  <p className="text-slate-900">{serieDetalhe.dataFim} {serieDetalhe.horarioFim}</p>
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
