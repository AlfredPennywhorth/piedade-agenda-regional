import { useState, useEffect } from 'react'
import { EventoCreate, EventoUpdate, EventoCreateInput, EventoUpdateInput, SerieCreateInput } from '@piedade/shared'
import { fetchWithAuth, postWithAuth, patchWithAuth, ApiError } from '../../api/apiClient'
import { SerieFormModal, TipoEscopo } from '../series/SerieFormModal'
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

interface SerieResponse {
  id: string
  titulo: string
  descricao: string | null
  pauta: string | null
  modalidade: 'PRESENCIAL' | 'ONLINE' | 'HIBRIDO'
  dataInicio: string
  dataFim: string
  horarioInicio: string
  horarioFim: string
  frequencia: 'DIARIA' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL_DIA_FIXO' | 'MENSAL_POSICAO_SEMANA'
  intervalo: number
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
}

export interface Evento {
  id: string
  titulo: string
  descricao: string | null
  pauta: string | null
  modalidade: 'PRESENCIAL' | 'ONLINE' | 'HIBRIDO'
  inicioEm: string
  fimEm: string
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
  serieRecorrenciaId?: string | null
  recorrenciaExcecao?: boolean
}

export function EventosView() {
  const [eventos, setEventos] = useState<Evento[]>([])
  
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
  const [eventoEditandoId, setEventoEditandoId] = useState<string | null>(null)
  const [eventoEditandoSerieId, setEventoEditandoSerieId] = useState<string | null>(null)
  const [carregandoDetalhes, setCarregandoDetalhes] = useState<boolean>(false)
  const [salvando, setSalvando] = useState<boolean>(false)
  const [escolhaSerieAberto, setEscolhaSerieAberto] = useState<Evento | null>(null)
  const [confirmacaoThisAberto, setConfirmacaoThisAberto] = useState<EventoUpdateInput | null>(null)
  const [confirmacaoFutureAberto, setConfirmacaoFutureAberto] = useState<SerieCreateInput | null>(null)
  
  // Serie Form State
  const [serieFormOpen, setSerieFormOpen] = useState(false)
  const [serieInitialData, setSerieInitialData] = useState<Partial<SerieCreateInput>>({})
  const [serieInitialTipoEscopo, setSerieInitialTipoEscopo] = useState<TipoEscopo>('')

  // Modal Details
  const [eventoDetalhe, setEventoDetalhe] = useState<Evento | null>(null)

  const [formData, setFormData] = useState<Partial<EventoCreateInput>>({
    titulo: '',
    descricao: '',
    pauta: '',
    modalidade: 'PRESENCIAL',
    inicioEm: '',
    fimEm: '',
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
        eventosData, locaisData, membrosData, regionaisData,
        administracoesData, setoresData, casasData, gruposData
      ] = await Promise.all([
        fetchWithAuth<Evento[]>('/eventos'),
        fetchWithAuth<Local[]>('/locais'),
        fetchWithAuth<Membro[]>('/membros'),
        fetchWithAuth<Regional[]>('/regionais'),
        fetchWithAuth<Administracao[]>('/administracoes'),
        fetchWithAuth<Setor[]>('/setores'),
        fetchWithAuth<Casa[]>('/casas'),
        fetchWithAuth<GrupoTrabalho[]>('/grupos-trabalho'),
      ])
      
      setEventos(eventosData || [])
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

  const toLocalISOString = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  const parseDatetimeLocal = (val: string) => {
    if (!val) return ''
    const d = new Date(val)
    if (isNaN(d.getTime())) return val
    return d.toISOString()
  }

  const formatDatetimeLocal = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return toLocalISOString(d)
  }

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

  const abrirFormCriar = () => {
    setEventoEditandoId(null)
    setEventoEditandoSerieId(null)
    setFormData({
      titulo: '',
      descricao: '',
      pauta: '',
      modalidade: 'PRESENCIAL',
      inicioEm: '',
      fimEm: '',
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

  const handleClickEditar = (item: Evento) => {
    if (item.serieRecorrenciaId) {
      setEscolhaSerieAberto(item)
    } else {
      abrirFormEditar(item.id, null)
    }
  }

  const abrirFormEditar = async (id: string, serieId: string | null) => {
    setEventoEditandoId(id)
    setEventoEditandoSerieId(serieId)
    setCarregandoDetalhes(true)
    setErrosForm({})
    setErro(null)
    setFormOpen(true)
    setEscolhaSerieAberto(null)

    try {
      const item = await fetchWithAuth<Evento>(`/eventos/${id}`)
      
      let tipo: any = ''
      if (item.regionalId) tipo = 'regional'
      else if (item.administracaoId) tipo = 'administracao'
      else if (item.setorId) tipo = 'setor'
      else if (item.casaId) tipo = 'casa'
      else if (item.grupoTrabalhoId) tipo = 'grupoTrabalho'
      
      setTipoEscopo(tipo)
      setFormData({
        titulo: item.titulo || '',
        descricao: item.descricao || '',
        pauta: item.pauta || '',
        modalidade: item.modalidade,
        inicioEm: formatDatetimeLocal(item.inicioEm),
        fimEm: formatDatetimeLocal(item.fimEm),
        localId: item.localId || '',
        urlOnline: item.urlOnline || '',
        organizadorMembroId: item.organizadorMembroId || '',
        regionalId: item.regionalId || '',
        administracaoId: item.administracaoId || '',
        setorId: item.setorId || '',
        casaId: item.casaId || '',
        grupoTrabalhoId: item.grupoTrabalhoId || '',
        observacoes: item.observacoes || '',
        ativo: item.ativo ?? true,
      })
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar evento.')
      setFormOpen(false)
    } finally {
      setCarregandoDetalhes(false)
    }
  }

  const abrirFormEditarThisAndFuture = async (evento: Evento) => {
    if (!evento.serieRecorrenciaId) return;
    setEventoEditandoId(evento.id)
    setEventoEditandoSerieId(evento.serieRecorrenciaId)
    setCarregandoDetalhes(true)
    setErro(null)
    
    try {
      const serie = await fetchWithAuth<SerieResponse>(`/series-recorrencia/${evento.serieRecorrenciaId}`)
      
      let tipo: TipoEscopo = ''
      if (serie.regionalId) tipo = 'regional'
      else if (serie.administracaoId) tipo = 'administracao'
      else if (serie.setorId) tipo = 'setor'
      else if (serie.casaId) tipo = 'casa'
      else if (serie.grupoTrabalhoId) tipo = 'grupoTrabalho'
      
      setSerieInitialTipoEscopo(tipo)
      setSerieInitialData({
        titulo: serie.titulo || '',
        descricao: serie.descricao || '',
        pauta: serie.pauta || '',
        modalidade: serie.modalidade,
        dataInicio: serie.dataInicio || '',
        dataFim: serie.dataFim || '',
        horarioInicio: serie.horarioInicio || '',
        horarioFim: serie.horarioFim || '',
        frequencia: serie.frequencia,
        intervalo: 1,
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
        ativo: serie.ativo ?? true,
      })
      setSerieFormOpen(true)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.body?.error) {
        setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos')
      } else if (err instanceof Error) {
        setErro(err.message || 'Erro ao carregar série.')
      } else {
        setErro('Erro ao carregar série.')
      }
    } finally {
      setCarregandoDetalhes(false)
    }
  }

  const handleSerieSubmit = async (data: SerieCreateInput) => {
    setConfirmacaoFutureAberto(data)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrosForm({})
    
    const payload = {
      ...formData,
      descricao: formData.descricao || null,
      pauta: formData.pauta || null,
      localId: formData.localId || null,
      urlOnline: formData.urlOnline || null,
      organizadorMembroId: formData.organizadorMembroId || null,
      regionalId: formData.regionalId || null,
      administracaoId: formData.administracaoId || null,
      setorId: formData.setorId || null,
      casaId: formData.casaId || null,
      grupoTrabalhoId: formData.grupoTrabalhoId || null,
      observacoes: formData.observacoes || null,
      inicioEm: parseDatetimeLocal(formData.inicioEm as string),
      fimEm: parseDatetimeLocal(formData.fimEm as string),
    }

    try {
      const parsed = eventoEditandoId 
        ? EventoUpdate.safeParse(payload) 
        : EventoCreate.safeParse(payload)

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

      setSalvando(true)

      // Ensure that for PATCH, fields that are not relevant (like localId for ONLINE) are explicitly null
      if (eventoEditandoSerieId) {
        setConfirmacaoThisAberto({
          ...parsed.data,
          localId: parsed.data.modalidade === 'ONLINE' ? null : parsed.data.localId,
          urlOnline: parsed.data.modalidade === 'PRESENCIAL' ? null : parsed.data.urlOnline,
        })
        return
      }

      if (eventoEditandoId) {
        const updatePayload = {
          ...parsed.data,
          localId: parsed.data.modalidade === 'ONLINE' ? null : parsed.data.localId,
          urlOnline: parsed.data.modalidade === 'PRESENCIAL' ? null : parsed.data.urlOnline,
        }
        await patchWithAuth(`/eventos/${eventoEditandoId}`, updatePayload)
      } else {
        await postWithAuth('/eventos', parsed.data)
      }

      setFormOpen(false)
      carregarDados()
    } catch (err: any) {
      if (err instanceof ApiError && err.body?.error) {
        setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos')
      } else {
        setErro(err.message || 'Erro ao salvar evento.')
      }
    } finally {
      setSalvando(false)
    }
  }

  const confirmarEditarThis = async () => {
    if (!eventoEditandoId || !eventoEditandoSerieId || !confirmacaoThisAberto) return
    setSalvando(true)
    setErro(null)
    try {
      const updatePayload = {
        updateMode: 'THIS',
        fromEventId: eventoEditandoId,
        changes: confirmacaoThisAberto
      }
      await patchWithAuth(`/series-recorrencia/${eventoEditandoSerieId}`, updatePayload)
      setConfirmacaoThisAberto(null)
      setFormOpen(false)
      carregarDados()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.body?.error) {
        setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos')
      } else if (err instanceof Error) {
        setErro(err.message || 'Erro ao salvar evento.')
      } else {
        setErro('Erro ao salvar evento.')
      }
      setConfirmacaoThisAberto(null)
    } finally {
      setSalvando(false)
    }
  }

  const confirmarEditarThisAndFuture = async () => {
    if (!eventoEditandoId || !eventoEditandoSerieId || !confirmacaoFutureAberto) return
    setSalvando(true)
    setErro(null)
    try {
      const {
        titulo, descricao, pauta, modalidade, frequencia, dataInicio,
        dataFim, horarioInicio, horarioFim, diaSemana, diaMes,
        posicaoSemanaMes, localId, urlOnline, organizadorMembroId, regionalId,
        administracaoId, setorId, casaId, grupoTrabalhoId, observacoes, ativo
      } = confirmacaoFutureAberto

      const changes = {
        titulo, descricao, pauta, modalidade, frequencia, intervalo: 1, dataInicio,
        dataFim, horarioInicio, horarioFim, diaSemana, diaMes,
        posicaoSemanaMes, localId, urlOnline, organizadorMembroId, regionalId,
        administracaoId, setorId, casaId, grupoTrabalhoId, observacoes, ativo
      }

      const updatePayload = {
        updateMode: 'THIS_AND_FUTURE',
        fromEventId: eventoEditandoId,
        changes
      }
      await patchWithAuth(`/series-recorrencia/${eventoEditandoSerieId}`, updatePayload)
      setConfirmacaoFutureAberto(null)
      setSerieFormOpen(false)
      carregarDados()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.body?.error) {
        setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos')
      } else if (err instanceof Error) {
        setErro(err.message || 'Erro ao salvar série.')
      } else {
        setErro('Erro ao salvar série.')
      }
      setConfirmacaoFutureAberto(null)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="bg-brand-900 text-white p-6 rounded-2xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Eventos</h2>
          <p className="text-brand-200 text-sm mt-1">Administração de eventos da agenda</p>
        </div>
        <button
          onClick={abrirFormCriar}
          className="px-5 py-2.5 bg-white text-brand-900 font-semibold rounded-lg text-sm hover:bg-brand-50 transition-colors shadow-sm whitespace-nowrap"
        >
          + Novo Evento
        </button>
      </div>

      {erro && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm animate-in fade-in">
          {erro}
        </div>
      )}

      {loading && !formOpen && !eventoDetalhe ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
      ) : (eventos || []).length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 mb-4">Nenhum evento cadastrado.</p>
          <button onClick={abrirFormCriar} className="text-brand-600 font-medium hover:text-brand-700">
            Cadastrar primeiro evento
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Título</th>
                  <th className="px-6 py-4">Início</th>
                  <th className="px-6 py-4">Modalidade</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {eventos.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{item.titulo}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(item.inicioEm).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{item.modalidade}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {item.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button onClick={() => setEventoDetalhe(item)} className="text-brand-600 hover:text-brand-900 font-medium">
                        Ver
                      </button>
                      <button onClick={() => handleClickEditar(item)} className="text-amber-600 hover:text-amber-900 font-medium">
                        Editar
                      </button>
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
                {eventoEditandoId ? 'Editar Evento' : 'Novo Evento'}
              </h3>
              <button onClick={() => setFormOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} noValidate className="p-6 overflow-y-auto space-y-6">
              {erro && (
                <div role="alert" className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
                  {erro}
                </div>
              )}
              {carregandoDetalhes ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                </div>
              ) : (
                <>
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="inicioEm" className="block text-sm font-medium text-slate-700 mb-1">Início *</label>
                        <input
                          id="inicioEm"
                          type="datetime-local"
                          value={formData.inicioEm}
                          onChange={e => setFormData({ ...formData, inicioEm: e.target.value })}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                        />
                        {errosForm.inicioEm && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.inicioEm}</p>}
                      </div>
                      <div>
                        <label htmlFor="fimEm" className="block text-sm font-medium text-slate-700 mb-1">Fim *</label>
                        <input
                          id="fimEm"
                          type="datetime-local"
                          value={formData.fimEm}
                          onChange={e => setFormData({ ...formData, fimEm: e.target.value })}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                        />
                        {errosForm.fimEm && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.fimEm}</p>}
                      </div>
                    </div>

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

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="ativo"
                        checked={formData.ativo}
                        onChange={e => setFormData({ ...formData, ativo: e.target.checked })}
                        className="h-4 w-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                      />
                      <label htmlFor="ativo" className="text-sm text-slate-700">Ativo</label>
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
                      {salvando ? 'Salvando...' : 'Salvar Evento'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalhe */}
      {eventoDetalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div role="dialog" aria-modal="true" aria-labelledby="modal-detalhe-title" className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 id="modal-detalhe-title" className="text-lg font-semibold text-slate-900">
                Detalhes do Evento
              </h3>
              <button onClick={() => setEventoDetalhe(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Título</span>
                <p className="text-slate-900 font-medium">{eventoDetalhe.titulo}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Início</span>
                  <p className="text-slate-900">{new Date(eventoDetalhe.inicioEm).toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Fim</span>
                  <p className="text-slate-900">{new Date(eventoDetalhe.fimEm).toLocaleString('pt-BR')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Modalidade</span>
                  <p className="text-slate-900">{eventoDetalhe.modalidade}</p>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Status</span>
                  <p className="text-slate-900">{eventoDetalhe.ativo ? 'Ativo' : 'Inativo'}</p>
                </div>
              </div>
              {eventoDetalhe.descricao && (
                <div>
                  <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Descrição</span>
                  <p className="text-slate-900">{eventoDetalhe.descricao}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal Escolha Edição Série */}
      {escolhaSerieAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div role="dialog" aria-modal="true" aria-labelledby="modal-escolha-title" className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 id="modal-escolha-title" className="text-lg font-semibold text-slate-900">
                Editar Evento Recorrente
              </h3>
              <button onClick={() => setEscolhaSerieAberto(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-6">
              <p className="text-slate-700 mb-6">
                Este evento pertence a uma série recorrente. O que você deseja editar?
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    const item = escolhaSerieAberto
                    setEscolhaSerieAberto(null)
                    abrirFormEditar(item.id, item.serieRecorrenciaId || null)
                  }}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700"
                >
                  Apenas este evento
                </button>
                <button
                  onClick={() => {
                    const item = escolhaSerieAberto
                    setEscolhaSerieAberto(null)
                    abrirFormEditarThisAndFuture(item)
                  }}
                  className="w-full px-4 py-2 text-sm font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100"
                >
                  Este e os próximos eventos
                </button>
                <button
                  onClick={() => setEscolhaSerieAberto(null)}
                  className="w-full px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação THIS */}
      {confirmacaoThisAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div role="dialog" aria-modal="true" aria-labelledby="modal-confirm-this-title" className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 id="modal-confirm-this-title" className="text-lg font-semibold text-slate-900">
                Confirmar Exceção
              </h3>
              <button onClick={() => setConfirmacaoThisAberto(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-6">
              <p className="text-slate-700 mb-6">
                Tem certeza que deseja alterar <strong>apenas este evento</strong>? Ele se tornará uma exceção à série original.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmacaoThisAberto(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarEditarThis}
                  disabled={salvando}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Confirmar e Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação FUTURE */}
      {confirmacaoFutureAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div role="dialog" aria-modal="true" aria-labelledby="modal-confirm-future-title" className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 id="modal-confirm-future-title" className="text-lg font-semibold text-slate-900">
                Confirmar Edição
              </h3>
              <button onClick={() => setConfirmacaoFutureAberto(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-6">
              <p className="text-slate-700 mb-6">
                Tem certeza que deseja alterar este e os próximos eventos a partir daqui? Isso atualizará a série e recriará os eventos futuros.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmacaoFutureAberto(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarEditarThisAndFuture}
                  disabled={salvando}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Confirmar e Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SerieFormModal
        isOpen={serieFormOpen}
        onClose={() => setSerieFormOpen(false)}
        title="Editar Evento Recorrente (Este e os próximos)"
        initialData={serieInitialData}
        initialTipoEscopo={serieInitialTipoEscopo}
        lookups={{ locais, membros, regionais, administracoes, setores, casas, gruposTrabalho }}
        onSubmit={handleSerieSubmit}
        externalError={erro}
      />
    </div>
  )
}
