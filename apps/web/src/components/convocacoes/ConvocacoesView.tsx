import { useState, useEffect, useRef } from 'react'
import { ConvocacaoCreate, ConvocacaoUpdate, ConvocacaoCreatePayload, ConvocacaoUpdatePayload, Convocacao } from '@piedade/shared'
import { fetchWithAuth, postWithAuth, patchWithAuth, ApiError } from '../../api/apiClient'
import { ConvocacaoFuncoesModal } from './ConvocacaoFuncoesModal'
import { AcompanhamentoRsvpModal } from './AcompanhamentoRsvpModal'
interface EventoLookup {
  pessoal?: boolean
  abrangencia?: 'TERRITORIAL' | 'NACIONAL' | 'INTERNACIONAL'
  podeGerenciar?: boolean
  id: string
  titulo: string
  inicioEm: string
  fimEm: string
  ativo?: boolean
  regionalId?: string | null
  administracaoId?: string | null
  setorId?: string | null
  casaId?: string | null
  grupoTrabalhoId?: string | null
}

interface RegionalLookup { id: string; nome: string }
interface AdministracaoLookup { id: string; nome: string; regionalId: string }
interface SetorLookup { id: string; nome: string; administracaoId: string }
interface CasaLookup { id: string; nome: string; setorId: string }
interface GrupoTrabalhoLookup {
  id: string
  nome: string
  regionalId?: string | null
  administracaoId?: string | null
  setorId?: string | null
}
type FiltroStatus = 'ATIVAS' | 'RASCUNHO' | 'PUBLICADA' | 'CANCELADA' | 'TODAS'

export function ConvocacoesView({
  initialEventoId,
  onFluxoConcluido,
}: {
  initialEventoId?: string | null
  onFluxoConcluido?: () => void
}) {
  const [convocacoes, setConvocacoes] = useState<Convocacao[]>([])
  const [eventosLookup, setEventosLookup] = useState<EventoLookup[]>([])
  const [regionais, setRegionais] = useState<RegionalLookup[]>([])
  const [administracoes, setAdministracoes] = useState<AdministracaoLookup[]>([])
  const [setores, setSetores] = useState<SetorLookup[]>([])
  const [casas, setCasas] = useState<CasaLookup[]>([])
  const [gruposTrabalho, setGruposTrabalho] = useState<GrupoTrabalhoLookup[]>([])
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('ATIVAS')
  const [filtroRegionalId, setFiltroRegionalId] = useState('')
  const [filtroAdministracaoId, setFiltroAdministracaoId] = useState('')
  const [filtroSetorId, setFiltroSetorId] = useState('')
  const [filtroCasaId, setFiltroCasaId] = useState('')
  const [filtroGrupoTrabalhoId, setFiltroGrupoTrabalhoId] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [gerenciandoFuncoesId, setGerenciandoFuncoesId] = useState<string | null>(null)
  const [fluxoConvocacaoId, setFluxoConvocacaoId] = useState<string | null>(null)
  const [fluxoEventoIdAtivo, setFluxoEventoIdAtivo] = useState<string | null>(null)
  const [acompanhamentoConvocacaoId, setAcompanhamentoConvocacaoId] = useState<string | null>(null)

  const [formData, setFormData] = useState<ConvocacaoCreatePayload>({
    eventoId: '',
    observacoes: '',
  })
  const [errosForm, setErrosForm] = useState<Record<string, string>>({})

  const [actionConfirm, setActionConfirm] = useState<{ type: 'PUBLICAR' | 'CANCELAR', convocacao: Convocacao } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const fluxoRetornoFocoRef = useRef<HTMLHeadingElement | null>(null)

  const handleActionConfirm = async () => {
    if (!actionConfirm) return
    setActionLoading(true)
    setActionError(null)
    
    try {
      if (actionConfirm.type === 'PUBLICAR') {
        await postWithAuth(`/convocacoes/${actionConfirm.convocacao.id}/publicar`, {})
      } else {
        await postWithAuth(`/convocacoes/${actionConfirm.convocacao.id}/cancelar`, {})
      }
      setActionConfirm(null)
      carregarDados()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409 && actionConfirm.type === 'PUBLICAR') {
        setActionError('A convocação foi alterada concorrentemente. Por favor, recarregue a lista e tente novamente.')
      } else if (err instanceof ApiError) {
        setActionError(err.message || 'Erro ao processar requisição')
      } else if (err instanceof Error) {
        setActionError(err.message || 'Erro ao processar requisição')
      } else {
        setActionError('Erro ao processar requisição')
      }
    } finally {
      setActionLoading(false)
    }
  }

  const carregarDados = async () => {
    setLoading(true)
    setErro(null)
    try {
      const [
        convData,
        eventosData,
        regionaisData,
        administracoesData,
        setoresData,
        casasData,
        gruposTrabalhoData,
      ] = await Promise.all([
        fetchWithAuth<Convocacao[]>('/convocacoes'),
        fetchWithAuth<EventoLookup[]>('/eventos'),
        fetchWithAuth<RegionalLookup[]>('/regionais'),
        fetchWithAuth<AdministracaoLookup[]>('/administracoes'),
        fetchWithAuth<SetorLookup[]>('/setores'),
        fetchWithAuth<CasaLookup[]>('/casas'),
        fetchWithAuth<GrupoTrabalhoLookup[]>('/grupos-trabalho'),
      ])
      setConvocacoes(convData || [])
      setEventosLookup(eventosData || [])
      setRegionais(regionaisData || [])
      setAdministracoes(administracoesData || [])
      setSetores(setoresData || [])
      setCasas(casasData || [])
      setGruposTrabalho(gruposTrabalhoData || [])
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErro(err.message)
      } else {
        setErro('Erro ao carregar convocações')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  useEffect(() => {
    if (!initialEventoId) return
    setFluxoEventoIdAtivo(initialEventoId)
    setEditandoId(null)
    setFormData({ eventoId: initialEventoId, observacoes: '' })
    setErrosForm({})
    setFormOpen(true)
  }, [initialEventoId])

  const abrirFormCriar = () => {
    setEditandoId(null)
    setFormData({ eventoId: '', observacoes: '' })
    setErrosForm({})
    setFormOpen(true)
  }

  const handleClickEditar = (item: Convocacao) => {
    if (item.status !== 'RASCUNHO') {
      setErro(`Não é possível editar uma convocação com status ${item.status}. Somente rascunhos podem ser editados.`)
      return
    }
    setEditandoId(item.id)
    setFormData({
      eventoId: item.eventoId,
      observacoes: item.observacoes || ''
    })
    setErrosForm({})
    setFormOpen(true)
  }

  const handleCloseForm = () => {
    if (!salvando) {
      const cancelandoFluxoGuiado = !!fluxoEventoIdAtivo && !editandoId
      setFormOpen(false)
      setEditandoId(null)
      if (cancelandoFluxoGuiado) {
        setFluxoConvocacaoId(null)
        setFluxoEventoIdAtivo(null)
        onFluxoConcluido?.()
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrosForm({})

    let requisicao: Promise<unknown>

    if (editandoId) {
      const payload: ConvocacaoUpdatePayload = { observacoes: formData.observacoes }
      const validacao = ConvocacaoUpdate.safeParse(payload)
      if (!validacao.success) {
        const novosErros: Record<string, string> = {}
        validacao.error.issues.forEach(issue => {
          novosErros[issue.path[0] as string] = issue.message
        })
        setErrosForm(novosErros)
        return
      }
      requisicao = patchWithAuth(`/convocacoes/${editandoId}`, payload)
    } else {
      const payload: ConvocacaoCreatePayload = { eventoId: formData.eventoId, observacoes: formData.observacoes }
      const validacao = ConvocacaoCreate.safeParse(payload)
      if (!validacao.success) {
        const novosErros: Record<string, string> = {}
        validacao.error.issues.forEach(issue => {
          novosErros[issue.path[0] as string] = issue.message
        })
        setErrosForm(novosErros)
        return
      }
      requisicao = postWithAuth<Convocacao>('/convocacoes', payload)
    }

    setSalvando(true)
    try {
      const resultado = await requisicao
      setFormOpen(false)
      if (!editandoId && fluxoEventoIdAtivo && resultado && typeof resultado === 'object' && 'id' in resultado) {
        const criada = resultado as Convocacao
        setFluxoConvocacaoId(criada.id)
        setFluxoEventoIdAtivo(null)
        setGerenciandoFuncoesId(criada.id)
        onFluxoConcluido?.()
      }
      carregarDados()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrosForm({ root: err.message })
      } else {
        setErrosForm({ root: 'Erro ao salvar convocação' })
      }
    } finally {
      setSalvando(false)
    }
  }

  const formatarEvento = (evento: EventoLookup) => {
    const data = new Date(evento.inicioEm)
    const dataHora = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(data)

    return `${evento.titulo} — ${dataHora}`
  }

  const getEvento = (eventoId: string) => eventosLookup.find(e => e.id === eventoId)

  const getNomeEvento = (eventoId: string) => {
    const ev = getEvento(eventoId)
    return ev ? ev.titulo : 'Evento não encontrado'
  }

  const resolverEscopoGrupoTrabalho = (grupo?: GrupoTrabalhoLookup) => {
    if (!grupo) return { regionalId: '', administracaoId: '', setorId: '' }

    const setorId = grupo.setorId || ''
    let administracaoId = grupo.administracaoId || ''
    let regionalId = grupo.regionalId || ''

    if (setorId && !administracaoId) {
      administracaoId = setores.find(item => item.id === setorId)?.administracaoId || ''
    }
    if (administracaoId && !regionalId) {
      regionalId = administracoes.find(item => item.id === administracaoId)?.regionalId || ''
    }

    return { regionalId, administracaoId, setorId }
  }

  const resolverEscopoEvento = (evento?: EventoLookup) => {
    if (!evento) return { regionalId: '', administracaoId: '', setorId: '', casaId: '', grupoTrabalhoId: '' }

    const casaId = evento.casaId || ''
    let setorId = evento.setorId || ''
    let administracaoId = evento.administracaoId || ''
    let regionalId = evento.regionalId || ''
    const grupoTrabalhoId = evento.grupoTrabalhoId || ''

    if (casaId && !setorId) setorId = casas.find(item => item.id === casaId)?.setorId || ''
    if (setorId && !administracaoId) administracaoId = setores.find(item => item.id === setorId)?.administracaoId || ''
    if (administracaoId && !regionalId) regionalId = administracoes.find(item => item.id === administracaoId)?.regionalId || ''

    if (grupoTrabalhoId) {
      const escopoGt = resolverEscopoGrupoTrabalho(
        gruposTrabalho.find(item => item.id === grupoTrabalhoId)
      )
      if (!setorId) setorId = escopoGt.setorId
      if (!administracaoId) administracaoId = escopoGt.administracaoId
      if (!regionalId) regionalId = escopoGt.regionalId
    }

    return { regionalId, administracaoId, setorId, casaId, grupoTrabalhoId }
  }

  const formatarEscopoEvento = (evento?: EventoLookup) => {
    if (!evento) return ''
    if (evento.grupoTrabalhoId) {
      return `GT: ${gruposTrabalho.find(item => item.id === evento.grupoTrabalhoId)?.nome || 'não identificado'}`
    }
    if (evento.casaId) return `Casa: ${casas.find(item => item.id === evento.casaId)?.nome || 'não identificada'}`
    if (evento.setorId) return `Setor: ${setores.find(item => item.id === evento.setorId)?.nome || 'não identificado'}`
    if (evento.administracaoId) return `Administração: ${administracoes.find(item => item.id === evento.administracaoId)?.nome || 'não identificada'}`
    if (evento.regionalId) return `Regional: ${regionais.find(item => item.id === evento.regionalId)?.nome || 'não identificada'}`
    return ''
  }

  const idsEventosComConvocacao = new Set(convocacoes.map(conv => conv.eventoId))

  const eventosDisponiveis = eventosLookup
    .filter(ev => {
      // Eventos externos recebem convites nominais diretamente em Gestão de Eventos.
      if (ev.pessoal || ev.podeGerenciar === false || ev.abrangencia === 'NACIONAL' || ev.abrangencia === 'INTERNACIONAL') return false
      if (editandoId && ev.id === formData.eventoId) return true
      if (ev.ativo === false) return false
      if (new Date(ev.fimEm).getTime() < Date.now()) return false
      return !idsEventosComConvocacao.has(ev.id)
    })
    .sort((a, b) => new Date(a.inicioEm).getTime() - new Date(b.inicioEm).getTime())

  const administracoesFiltradas = administracoes
    .filter(item => !filtroRegionalId || item.regionalId === filtroRegionalId)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const setoresFiltrados = setores
    .filter(item => {
      if (filtroAdministracaoId) return item.administracaoId === filtroAdministracaoId
      if (!filtroRegionalId) return true
      return administracoes.find(adm => adm.id === item.administracaoId)?.regionalId === filtroRegionalId
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const casasFiltradas = casas
    .filter(item => {
      if (filtroSetorId) return item.setorId === filtroSetorId
      const setor = setores.find(set => set.id === item.setorId)
      if (!setor) return false
      if (filtroAdministracaoId) return setor.administracaoId === filtroAdministracaoId
      if (!filtroRegionalId) return true
      return administracoes.find(adm => adm.id === setor.administracaoId)?.regionalId === filtroRegionalId
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const gruposTrabalhoFiltrados = gruposTrabalho
    .filter(item => {
      const escopo = resolverEscopoGrupoTrabalho(item)
      if (filtroRegionalId && escopo.regionalId !== filtroRegionalId) return false
      if (filtroAdministracaoId && escopo.administracaoId !== filtroAdministracaoId) return false
      if (filtroSetorId && escopo.setorId !== filtroSetorId) return false
      return true
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const convocacoesFiltradas = convocacoes.filter(conv => {
    if (filtroStatus === 'ATIVAS' && conv.status === 'CANCELADA') return false
    if (filtroStatus !== 'ATIVAS' && filtroStatus !== 'TODAS' && conv.status !== filtroStatus) return false

    const escopo = resolverEscopoEvento(getEvento(conv.eventoId))
    if (filtroRegionalId && escopo.regionalId !== filtroRegionalId) return false
    if (filtroAdministracaoId && escopo.administracaoId !== filtroAdministracaoId) return false
    if (filtroSetorId && escopo.setorId !== filtroSetorId) return false
    if (filtroCasaId && escopo.casaId !== filtroCasaId) return false
    if (filtroGrupoTrabalhoId && escopo.grupoTrabalhoId !== filtroGrupoTrabalhoId) return false
    return true
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2
            ref={fluxoRetornoFocoRef}
            tabIndex={-1}
            className="text-2xl font-bold text-slate-900"
          >
            Convocações
          </h2>
          <p className="text-slate-600">Gerencie os rascunhos de convocações</p>
        </div>
        <button
          onClick={abrirFormCriar}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
        >
          Novo Rascunho
        </button>
      </div>

      {erro && (
        <div role="alert" className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
          {erro}
        </div>
      )}

      {!loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-slate-700">
              Status
              <select
                aria-label="Filtrar por status"
                value={filtroStatus}
                onChange={e => setFiltroStatus(e.target.value as FiltroStatus)}
                className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white text-sm"
              >
                <option value="ATIVAS">Ativas (sem canceladas)</option>
                <option value="RASCUNHO">Rascunho</option>
                <option value="PUBLICADA">Publicada</option>
                <option value="CANCELADA">Cancelada</option>
                <option value="TODAS">Todas</option>
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Regional
              <select
                aria-label="Filtrar por Regional"
                value={filtroRegionalId}
                onChange={e => {
                  setFiltroRegionalId(e.target.value)
                  setFiltroAdministracaoId('')
                  setFiltroSetorId('')
                  setFiltroCasaId('')
                  setFiltroGrupoTrabalhoId('')
                }}
                className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white text-sm"
              >
                <option value="">Todas</option>
                {[...regionais].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(item => (
                  <option key={item.id} value={item.id}>{item.nome}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Administração
              <select
                aria-label="Filtrar por Administração"
                value={filtroAdministracaoId}
                onChange={e => {
                  setFiltroAdministracaoId(e.target.value)
                  setFiltroSetorId('')
                  setFiltroCasaId('')
                  setFiltroGrupoTrabalhoId('')
                }}
                className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white text-sm"
              >
                <option value="">Todas</option>
                {administracoesFiltradas.map(item => (
                  <option key={item.id} value={item.id}>{item.nome}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Setor
              <select
                aria-label="Filtrar por Setor"
                value={filtroSetorId}
                onChange={e => {
                  setFiltroSetorId(e.target.value)
                  setFiltroCasaId('')
                  setFiltroGrupoTrabalhoId('')
                }}
                className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white text-sm"
              >
                <option value="">Todos</option>
                {setoresFiltrados.map(item => (
                  <option key={item.id} value={item.id}>{item.nome}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Casa de Oração
              <select
                aria-label="Filtrar por Casa de Oração"
                value={filtroCasaId}
                onChange={e => {
                  const valor = e.target.value
                  setFiltroCasaId(valor)
                  if (valor) setFiltroGrupoTrabalhoId('')
                }}
                className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white text-sm"
              >
                <option value="">Todas</option>
                {casasFiltradas.map(item => (
                  <option key={item.id} value={item.id}>{item.nome}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Grupo de Trabalho
              <select
                aria-label="Filtrar por Grupo de Trabalho"
                value={filtroGrupoTrabalhoId}
                onChange={e => {
                  const valor = e.target.value
                  setFiltroGrupoTrabalhoId(valor)
                  if (valor) setFiltroCasaId('')
                }}
                className="mt-1 w-full p-2 border border-slate-300 rounded-lg bg-white text-sm"
              >
                <option value="">Todos</option>
                {gruposTrabalhoFiltrados.map(item => (
                  <option key={item.id} value={item.id}>{item.nome}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-slate-500">
            <span>{convocacoesFiltradas.length} de {convocacoes.length} convocação(ões) exibida(s)</span>
            <button
              type="button"
              onClick={() => {
                setFiltroStatus('ATIVAS')
                setFiltroRegionalId('')
                setFiltroAdministracaoId('')
                setFiltroSetorId('')
                setFiltroCasaId('')
                setFiltroGrupoTrabalhoId('')
              }}
              className="text-brand-700 hover:underline font-medium"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-8 text-slate-500">
          Carregando convocações...
        </div>
      ) : convocacoes.length === 0 ? (
        <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500">Nenhuma convocação encontrada.</p>
        </div>
      ) : convocacoesFiltradas.length === 0 ? (
        <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500">Nenhuma convocação corresponde aos filtros selecionados.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <ul className="divide-y divide-slate-200">
            {convocacoesFiltradas.map(conv => (
              <li key={conv.id} className="p-4 hover:bg-slate-50 flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{getNomeEvento(conv.eventoId)}</h3>
                  {getEvento(conv.eventoId) && (
                    <p className="text-sm text-slate-500">
                      {formatarEvento(getEvento(conv.eventoId)!)}
                    </p>
                  )}
                  {formatarEscopoEvento(getEvento(conv.eventoId)) && (
                    <p className="text-sm text-slate-500">{formatarEscopoEvento(getEvento(conv.eventoId))}</p>
                  )}
                  <p className="text-sm text-slate-500">
                    Status: <span className="font-medium text-slate-700">{conv.status}</span>
                  </p>
                  {conv.observacoes && (
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">{conv.observacoes}</p>
                  )}
                </div>
                <div className="flex items-start gap-2 flex-wrap justify-end">
                  {conv.status === 'RASCUNHO' && getEvento(conv.eventoId)?.podeGerenciar !== false && (
                    <button
                      onClick={() => setActionConfirm({ type: 'PUBLICAR', convocacao: conv })}
                      className="text-green-600 hover:text-green-800 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                    >
                      Publicar
                    </button>
                  )}
                  {conv.status === 'RASCUNHO' && getEvento(conv.eventoId)?.podeGerenciar !== false && (
                    <button
                      onClick={() => setGerenciandoFuncoesId(conv.id)}
                      className="text-slate-600 hover:text-slate-800 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Gerenciar Funções
                    </button>
                  )}
                  {conv.status === 'PUBLICADA' && (
                    <button
                      onClick={() => setAcompanhamentoConvocacaoId(conv.id)}
                      className="text-brand-600 hover:text-brand-800 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
                    >
                      Acompanhar RSVP
                    </button>
                  )}
                  {conv.status === 'RASCUNHO' && getEvento(conv.eventoId)?.podeGerenciar !== false && (
                    <button
                      onClick={() => handleClickEditar(conv)}
                      className="text-brand-600 hover:text-brand-800 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
                    >
                      Editar
                    </button>
                  )}
                  {conv.status !== 'CANCELADA' && getEvento(conv.eventoId)?.podeGerenciar !== false && (
                    <button
                      onClick={() => setActionConfirm({ type: 'CANCELAR', convocacao: conv })}
                      className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {formOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h2 id="dialog-title" className="text-xl font-bold text-slate-900">
                {editandoId ? 'Editar Rascunho' : 'Nova Convocação'}
              </h2>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {errosForm.root && (
                <div role="alert" className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 text-sm">
                  {errosForm.root}
                </div>
              )}

              <form id="convocacao-form" onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Evento
                  </label>
                  <select
                    aria-label="Evento da convocação"
                    value={formData.eventoId}
                    onChange={(e) => setFormData({ ...formData, eventoId: e.target.value })}
                    disabled={!!editandoId || salvando}
                    className={`w-full p-2 border rounded-lg bg-white ${editandoId ? 'bg-slate-100' : ''} ${errosForm.eventoId ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'} focus:ring-2 outline-none transition-all`}
                  >
                    <option value="">Selecione um evento</option>
                    {eventosDisponiveis.map(ev => (
                      <option key={ev.id} value={ev.id}>{formatarEvento(ev)}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Eventos nacionais e internacionais utilizam convites nominais em Gestão de Eventos; não exigem funções institucionais.</p>
                  {errosForm.eventoId && (
                    <p className="text-red-500 text-sm mt-1">{errosForm.eventoId}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    value={formData.observacoes || ''}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    disabled={salvando}
                    rows={4}
                    className={`w-full p-2 border rounded-lg ${errosForm.observacoes ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'} focus:ring-2 outline-none transition-all`}
                  />
                  {errosForm.observacoes && (
                    <p className="text-red-500 text-sm mt-1">{errosForm.observacoes}</p>
                  )}
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={handleCloseForm}
                disabled={salvando}
                className="px-4 py-2 text-slate-700 font-medium hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="convocacao-form"
                disabled={salvando}
                className="px-4 py-2 bg-brand-600 text-white font-medium hover:bg-brand-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {actionConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h2 id="confirm-dialog-title" className="text-xl font-bold text-slate-900">
                {actionConfirm.type === 'PUBLICAR' ? 'Publicar Convocação' : 'Cancelar Convocação'}
              </h2>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-slate-700">
              {actionError && (
                <div role="alert" className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 text-sm">
                  {actionError}
                </div>
              )}
              {actionConfirm.type === 'PUBLICAR' ? (
                <p>
                  Ao confirmar a publicação, os destinatários e suas evidências serão materializados e a edição ficará bloqueada.
                </p>
              ) : (
                <p>
                  Ao cancelar a convocação, eventos futuros vinculados deixarão de valer, preservando o histórico.
                </p>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => !actionLoading && (setActionConfirm(null), setActionError(null))}
                disabled={actionLoading}
                className="px-4 py-2 text-slate-700 font-medium hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleActionConfirm}
                disabled={actionLoading}
                className={`px-4 py-2 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 ${actionConfirm.type === 'PUBLICAR' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {actionLoading ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {gerenciandoFuncoesId && (
        <ConvocacaoFuncoesModal
          convocacaoId={gerenciandoFuncoesId}
          returnFocusRef={gerenciandoFuncoesId === fluxoConvocacaoId ? fluxoRetornoFocoRef : undefined}
          onClose={() => {
            const concluindoFluxo = gerenciandoFuncoesId === fluxoConvocacaoId
            setGerenciandoFuncoesId(null)
            if (concluindoFluxo) {
              setFluxoConvocacaoId(null)
            }
          }}
        />
      )}

      {acompanhamentoConvocacaoId && (
        <AcompanhamentoRsvpModal
          convocacaoId={acompanhamentoConvocacaoId}
          onClose={() => setAcompanhamentoConvocacaoId(null)}
        />
      )}
    </div>
  )
}
