import { useState, useEffect, useRef } from 'react'
import { SerieCreate, SerieCreateInput, LocalCreate, EspacoLocalCreate } from '@piedade/shared'
import { ApiError, postWithAuth } from '../../api/apiClient'

export interface Lookups {
  locais: { id: string; nome: string }[]
  espacos: { id: string; localId: string; nome: string; ativo: boolean }[]
  membros: { id: string; nome: string }[]
  regionais: { id: string; nome: string }[]
  administracoes: { id: string; nome: string }[]
  setores: { id: string; nome: string }[]
  casas: { id: string; nome: string }[]
  gruposTrabalho: { id: string; nome: string }[]
}

export type TipoEscopo = 'regional' | 'administracao' | 'setor' | 'casa' | 'grupoTrabalho' | ''

export interface SerieFormModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  initialData: Partial<SerieCreateInput>
  initialTipoEscopo: TipoEscopo
  lookups: Lookups
  externalError?: string | null
  onSubmit: (data: SerieCreateInput) => Promise<void>
}

export function SerieFormModal({
  isOpen,
  onClose,
  title,
  initialData,
  initialTipoEscopo,
  lookups,
  externalError,
  onSubmit
}: SerieFormModalProps) {
  const [formData, setFormData] = useState<Partial<SerieCreateInput>>(initialData)
  const [tipoEscopo, setTipoEscopo] = useState<TipoEscopo>(initialTipoEscopo)
  const [errosForm, setErrosForm] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<boolean>(false)
  const [locaisRapidos, setLocaisRapidos] = useState<{ id: string; nome: string }[]>([])
  const [espacosRapidos, setEspacosRapidos] = useState<{ id: string; localId: string; nome: string; ativo: boolean }[]>([])
  const [localRapidoOpen, setLocalRapidoOpen] = useState(false)
  const [salvandoLocalRapido, setSalvandoLocalRapido] = useState(false)
  const [localRapidoErro, setLocalRapidoErro] = useState<string | null>(null)
  const [consultandoCepRapido, setConsultandoCepRapido] = useState(false)
  const [cepRapidoMensagem, setCepRapidoMensagem] = useState<string | null>(null)
  const [cepRapidoErro, setCepRapidoErro] = useState(false)
  const cepRapidoConsultaSeq = useRef(0)
  const cepRapidoAbortControllerRef = useRef<AbortController | null>(null)
  const [localRapido, setLocalRapido] = useState({
    nome: '',
    endereco: '',
    numero: '',
    bairro: '',
    cidade: 'São Paulo',
    uf: 'SP',
    cep: '',
  })
  const [espacoRapidoOpen, setEspacoRapidoOpen] = useState(false)
  const [salvandoEspacoRapido, setSalvandoEspacoRapido] = useState(false)
  const [espacoRapidoErro, setEspacoRapidoErro] = useState<string | null>(null)
  const [espacoRapidoNome, setEspacoRapidoNome] = useState('')
  const localRapidoDialogRef = useRef<HTMLDivElement | null>(null)
  const espacoRapidoDialogRef = useRef<HTMLDivElement | null>(null)
  const localRapidoTriggerRef = useRef<HTMLElement | null>(null)
  const espacoRapidoTriggerRef = useRef<HTMLElement | null>(null)

  const { locais, espacos, membros, regionais, administracoes, setores, casas, gruposTrabalho } = lookups
  const locaisDisponiveis = [...locais, ...locaisRapidos.filter(item => !locais.some(local => local.id === item.id))]
  const espacosDisponiveis = [...espacos, ...espacosRapidos.filter(item => !espacos.some(espaco => espaco.id === item.id))]

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData)
      setTipoEscopo(initialTipoEscopo)
      setErrosForm({})
      setErro(null)
      setSalvando(false)
      setLocaisRapidos([])
      setEspacosRapidos([])
      setLocalRapidoOpen(false)
      setEspacoRapidoOpen(false)
      setLocalRapidoErro(null)
      setEspacoRapidoErro(null)
      setLocalRapido({ nome: '', endereco: '', numero: '', bairro: '', cidade: 'São Paulo', uf: 'SP', cep: '' })
      setEspacoRapidoNome('')
    }
  }, [isOpen, initialData, initialTipoEscopo])

  useEffect(() => {
    if (!localRapidoOpen) return
    const dialog = localRapidoDialogRef.current
    const focaveis = dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    focaveis?.[0]?.focus()

    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog) return
      const itens = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ))
      if (itens.length === 0) return
      const primeiro = itens[0]
      const ultimo = itens[itens.length - 1]
      if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault()
        ultimo.focus()
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault()
        primeiro.focus()
      }
    }

    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      if (localRapidoTriggerRef.current?.isConnected) localRapidoTriggerRef.current.focus()
    }
  }, [localRapidoOpen])

  useEffect(() => {
    if (!espacoRapidoOpen) return
    const dialog = espacoRapidoDialogRef.current
    const focaveis = dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    focaveis?.[0]?.focus()

    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog) return
      const itens = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ))
      if (itens.length === 0) return
      const primeiro = itens[0]
      const ultimo = itens[itens.length - 1]
      if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault()
        ultimo.focus()
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault()
        primeiro.focus()
      }
    }

    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      if (espacoRapidoTriggerRef.current?.isConnected) espacoRapidoTriggerRef.current.focus()
    }
  }, [espacoRapidoOpen])

  if (!isOpen) return null

  const handleModalidadeChange = (mod: 'PRESENCIAL' | 'ONLINE' | 'HIBRIDO') => {
    setFormData(prev => ({
      ...prev,
      modalidade: mod,
      localId: mod === 'ONLINE' ? '' : prev.localId,
      espacoId: mod === 'ONLINE' ? '' : prev.espacoId,
      urlOnline: mod === 'PRESENCIAL' ? '' : prev.urlOnline
    }))
  }

  const handleTipoEscopoChange = (tipo: TipoEscopo) => {
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

  const formatarCepRapido = (valor: string) => {
    const digitos = valor.replace(/\D/g, '').slice(0, 8)
    return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos
  }

  const buscarCepRapido = async (cepInformado: string) => {
    const cep = cepInformado.replace(/\D/g, '')
    if (cep.length !== 8) return

    cepRapidoAbortControllerRef.current?.abort()
    const controller = new AbortController()
    cepRapidoAbortControllerRef.current = controller
    const seq = ++cepRapidoConsultaSeq.current
    const timeout = window.setTimeout(() => controller.abort(), 8000)

    setConsultandoCepRapido(true)
    setCepRapidoMensagem(null)
    setCepRapidoErro(false)

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal })
      if (!response.ok) throw new Error('Falha ao consultar CEP')

      const data = await response.json() as {
        cep?: string
        logradouro?: string
        bairro?: string
        localidade?: string
        uf?: string
        erro?: boolean
      }
      if (seq !== cepRapidoConsultaSeq.current) return

      if (data.erro) {
        setCepRapidoMensagem('CEP não encontrado. Preencha o endereço manualmente.')
        setCepRapidoErro(true)
        return
      }

      setLocalRapido(atual => ({
        ...atual,
        cep: data.cep || formatarCepRapido(cep),
        endereco: data.logradouro || atual.endereco,
        bairro: data.bairro || atual.bairro,
        cidade: data.localidade || atual.cidade,
        uf: (data.uf || atual.uf).toUpperCase(),
      }))
      setCepRapidoMensagem('Endereço preenchido automaticamente pelo CEP.')
    } catch {
      if (seq !== cepRapidoConsultaSeq.current) return
      setCepRapidoMensagem('Consulta de CEP encerrada. Você pode preencher o endereço manualmente.')
      setCepRapidoErro(false)
    } finally {
      window.clearTimeout(timeout)
      if (cepRapidoAbortControllerRef.current === controller) {
        cepRapidoAbortControllerRef.current = null
      }
      if (seq === cepRapidoConsultaSeq.current) {
        setConsultandoCepRapido(false)
      }
    }
  }

  const handleCepRapidoChange = (valor: string) => {
    const cepFormatado = formatarCepRapido(valor)
    setLocalRapido(atual => ({ ...atual, cep: cepFormatado }))
    setCepRapidoMensagem(null)
    setCepRapidoErro(false)

    if (cepFormatado.replace(/\D/g, '').length === 8) {
      void buscarCepRapido(cepFormatado)
    } else {
      cepRapidoAbortControllerRef.current?.abort()
      cepRapidoAbortControllerRef.current = null
      cepRapidoConsultaSeq.current += 1
      setConsultandoCepRapido(false)
    }
  }

  const fecharLocalRapido = () => {
    cepRapidoAbortControllerRef.current?.abort()
    cepRapidoAbortControllerRef.current = null
    cepRapidoConsultaSeq.current += 1
    setConsultandoCepRapido(false)
    setCepRapidoMensagem(null)
    setCepRapidoErro(false)
    setLocalRapidoOpen(false)
  }

  const salvarLocalRapido = async (e: React.FormEvent) => {
    e.preventDefault()
    if (consultandoCepRapido) {
      setCepRapidoMensagem('Aguarde a consulta do CEP terminar antes de criar o local.')
      return
    }
    const parsed = LocalCreate.safeParse({
      nome: localRapido.nome,
      endereco: localRapido.endereco,
      numero: localRapido.numero,
      bairro: localRapido.bairro || null,
      cidade: localRapido.cidade,
      uf: localRapido.uf,
      cep: localRapido.cep || null,
      complemento: null,
      referencia: null,
      latitude: null,
      longitude: null,
      urlMaps: null,
      urlWaze: null,
      ativo: true,
    })
    if (!parsed.success) {
      setLocalRapidoErro(parsed.error.issues[0]?.message || 'Dados inválidos')
      return
    }

    setSalvandoLocalRapido(true)
    setLocalRapidoErro(null)
    try {
      const criado = await postWithAuth<{ id: string; nome: string }>('/locais', parsed.data)
      setLocaisRapidos(atuais => [...atuais.filter(item => item.id !== criado.id), criado])
      setFormData(atual => ({ ...atual, localId: criado.id, espacoId: '' }))
      fecharLocalRapido()
      setLocalRapido({ nome: '', endereco: '', numero: '', bairro: '', cidade: 'São Paulo', uf: 'SP', cep: '' })
    } catch (err: unknown) {
      setLocalRapidoErro(err instanceof Error ? err.message : 'Erro ao criar local')
    } finally {
      setSalvandoLocalRapido(false)
    }
  }

  const salvarEspacoRapido = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.localId) return

    const parsed = EspacoLocalCreate.safeParse({
      localId: formData.localId,
      nome: espacoRapidoNome,
      descricao: null,
      capacidade: null,
      ativo: true,
    })
    if (!parsed.success) {
      setEspacoRapidoErro(parsed.error.issues[0]?.message || 'Dados inválidos')
      return
    }

    setSalvandoEspacoRapido(true)
    setEspacoRapidoErro(null)
    try {
      const criado = await postWithAuth<{ id: string; localId: string; nome: string; ativo: boolean }>('/espacos-locais', parsed.data)
      setEspacosRapidos(atuais => [...atuais.filter(item => item.id !== criado.id), criado])
      setFormData(atual => ({ ...atual, espacoId: criado.id }))
      setEspacoRapidoOpen(false)
      setEspacoRapidoNome('')
    } catch (err: unknown) {
      setEspacoRapidoErro(err instanceof Error ? err.message : 'Erro ao criar espaço')
    } finally {
      setSalvandoEspacoRapido(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrosForm({})
    setErro(null)
    
    if (formData.espacoId) {
      const espacoSelecionado = espacosDisponiveis.find(espaco => espaco.id === formData.espacoId)
      if (!espacoSelecionado || !espacoSelecionado.ativo) {
        setErrosForm({
          espacoId: espacoSelecionado
            ? 'O espaço atual está inativo. Selecione um espaço ativo ou deixe o Local inteiro.'
            : 'O espaço atual não está disponível. Selecione outro espaço ou deixe o Local inteiro.',
        })
        return
      }
    }

    const payload = {
      ...formData,
      descricao: formData.descricao || null,
      pauta: formData.pauta || null,
      localId: formData.modalidade === 'ONLINE' ? null : (formData.localId || null),
      espacoId: formData.modalidade === 'ONLINE' ? null : (formData.espacoId || null),
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
        const errors: Record<string, string> = {}
        parsed.error.issues.forEach((e) => {
          if (e.path[0]) {
            errors[e.path[0].toString()] = e.message
          }
        })
        setErrosForm(errors)
        return
      }

      setSalvando(true)
      await onSubmit(parsed.data)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.body?.error) {
        setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos')
      } else if (err instanceof Error) {
        setErro(err.message || 'Erro ao salvar.')
      } else {
        setErro('Erro ao salvar.')
      }
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-labelledby="modal-form-title" className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 id="modal-form-title" className="text-lg font-semibold text-slate-900">
                {title}
              </h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            {erro && (
              <div role="alert" className="p-4 bg-red-50 border-b border-red-200 text-red-700 text-sm">
                {erro}
              </div>
            )}
            {externalError && (
              <div role="alert" className="p-4 bg-red-50 border-b border-red-200 text-red-700 text-sm">
                {externalError}
              </div>
            )}
            <form onSubmit={handleSubmit} noValidate className="p-6 overflow-y-auto space-y-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="titulo" className="block text-sm font-medium text-slate-700 mb-1">Título *</label>
                  <input
                    id="titulo"
                    type="text"
                    value={formData.titulo || ''}
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
                        value={formData.dataInicio || ''}
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
                        value={formData.dataFim || ''}
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
                        value={formData.horarioInicio || ''}
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
                        value={formData.horarioFim || ''}
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
                        value={formData.frequencia || ''}
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
                        value={formData.intervalo || 1}
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
                      value={formData.modalidade || 'PRESENCIAL'}
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
                    {(formData.modalidade === 'PRESENCIAL' || formData.modalidade === 'HIBRIDO' || !formData.modalidade) && (
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <label htmlFor="localId" className="block text-sm font-medium text-slate-700">Local *</label>
                          <button
                            type="button"
                            onClick={event => {
                              localRapidoTriggerRef.current = event.currentTarget
                              setLocalRapidoErro(null)
                              setCepRapidoMensagem(null)
                              setCepRapidoErro(false)
                              setLocalRapidoOpen(true)
                            }}
                            className="text-xs font-semibold text-brand-700 hover:text-brand-900"
                          >
                            + Criar local sem sair
                          </button>
                        </div>
                        <select
                          id="localId"
                          value={formData.localId || ''}
                          onChange={e => setFormData({ ...formData, localId: e.target.value, espacoId: '' })}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                        >
                          <option value="">Selecione...</option>
                          {locaisDisponiveis.map((l) => (
                            <option key={l.id} value={l.id}>{l.nome}</option>
                          ))}
                        </select>
                        {errosForm.localId && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.localId}</p>}
                      </div>
                    )}

                    {(formData.modalidade === 'PRESENCIAL' || formData.modalidade === 'HIBRIDO') && formData.localId && (
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <label htmlFor="espacoId" className="block text-sm font-medium text-slate-700">Espaço</label>
                          <button
                            type="button"
                            onClick={event => {
                              espacoRapidoTriggerRef.current = event.currentTarget
                              setEspacoRapidoErro(null)
                              setEspacoRapidoNome('')
                              setEspacoRapidoOpen(true)
                            }}
                            className="text-xs font-semibold text-brand-700 hover:text-brand-900"
                          >
                            + Criar espaço sem sair
                          </button>
                        </div>
                        <select
                          id="espacoId"
                          value={formData.espacoId || ''}
                          onChange={e => setFormData({ ...formData, espacoId: e.target.value })}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                        >
                          <option value="">Local inteiro / não especificado</option>
                          {espacosDisponiveis
                            .filter(espaco =>
                              espaco.localId === formData.localId &&
                              (espaco.ativo || espaco.id === formData.espacoId)
                            )
                            .map(espaco => (
                              <option key={espaco.id} value={espaco.id}>
                                {espaco.nome}{espaco.ativo ? '' : ' (inativo — substitua ou limpe)'}
                              </option>
                            ))}
                        </select>
                        {errosForm.espacoId && <p role="alert" className="text-red-500 text-xs mt-1">{errosForm.espacoId}</p>}
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
                        onChange={e => handleTipoEscopoChange(e.target.value as TipoEscopo)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                      >
                        <option value="">Selecione...</option>
                        <option value="regional">Regional</option>
                        <option value="administracao">Administração</option>
                        <option value="setor">Setor</option>
                        <option value="casa">Casa de Oração</option>
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
                            {regionais.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
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
                            {administracoes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
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
                            {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                          </select>
                        </>
                      )}
                      {tipoEscopo === 'casa' && (
                        <>
                          <label htmlFor="casaId" className="block text-xs font-medium text-slate-700 mb-1">Casa de Oração *</label>
                          <select
                            id="casaId"
                            value={formData.casaId || ''}
                            onChange={e => setFormData({ ...formData, casaId: e.target.value })}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                          >
                            <option value="">Selecione...</option>
                            {casas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
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
                            {gruposTrabalho.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
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
                    {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
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
                    checked={formData.ativo ?? true}
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
                  onClick={onClose}
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

        {localRapidoOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
            <div ref={localRapidoDialogRef} role="dialog" aria-modal="true" aria-labelledby="serie-local-rapido-title" className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 id="serie-local-rapido-title" className="font-semibold text-slate-900">Criar Local</h3>
                <p className="mt-1 text-xs text-slate-500">O novo local será selecionado automaticamente na série.</p>
              </div>
              <form onSubmit={salvarLocalRapido} className="space-y-3 p-5">
                {localRapidoErro && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{localRapidoErro}</p>}
                <input autoFocus aria-label="Nome do novo local" placeholder="Nome *" value={localRapido.nome} onChange={e => setLocalRapido({ ...localRapido, nome: e.target.value })} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
                <div className="grid grid-cols-[1fr_110px] gap-3">
                  <input aria-label="Endereço do novo local" placeholder="Endereço *" value={localRapido.endereco} onChange={e => setLocalRapido({ ...localRapido, endereco: e.target.value })} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
                  <input aria-label="Número do novo local" placeholder="Número *" value={localRapido.numero} onChange={e => setLocalRapido({ ...localRapido, numero: e.target.value })} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
                </div>
                <input aria-label="Bairro do novo local" placeholder="Bairro" value={localRapido.bairro} onChange={e => setLocalRapido({ ...localRapido, bairro: e.target.value })} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
                <div className="grid grid-cols-[1fr_80px] gap-3">
                  <input aria-label="Cidade do novo local" placeholder="Cidade *" value={localRapido.cidade} onChange={e => setLocalRapido({ ...localRapido, cidade: e.target.value })} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
                  <input aria-label="UF do novo local" placeholder="UF *" maxLength={2} value={localRapido.uf} onChange={e => setLocalRapido({ ...localRapido, uf: e.target.value.toUpperCase() })} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm uppercase" />
                </div>
                <input aria-label="CEP do novo local" placeholder="CEP" value={localRapido.cep} onChange={e => handleCepRapidoChange(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
                {(consultandoCepRapido || cepRapidoMensagem) && (
                  <p role={cepRapidoErro ? 'alert' : undefined} className={`text-xs ${cepRapidoErro ? 'text-red-700' : 'text-slate-500'}`}>
                    {consultandoCepRapido ? 'Consultando CEP...' : cepRapidoMensagem}
                  </p>
                )}
                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <button type="button" disabled={salvandoLocalRapido || consultandoCepRapido} onClick={() => {
                    fecharLocalRapido()
                    if (localRapidoTriggerRef.current?.isConnected) localRapidoTriggerRef.current.focus()
                  }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Voltar à série</button>
                  <button type="submit" disabled={salvandoLocalRapido || consultandoCepRapido} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{salvandoLocalRapido ? 'Criando...' : consultandoCepRapido ? 'Consultando CEP...' : 'Criar e selecionar'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {espacoRapidoOpen && formData.localId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
            <div ref={espacoRapidoDialogRef} role="dialog" aria-modal="true" aria-labelledby="serie-espaco-rapido-title" className="w-full max-w-md rounded-2xl bg-white shadow-xl">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 id="serie-espaco-rapido-title" className="font-semibold text-slate-900">Criar Espaço</h3>
                <p className="mt-1 text-xs text-slate-500">O novo espaço será selecionado automaticamente na série.</p>
              </div>
              <form onSubmit={salvarEspacoRapido} className="space-y-3 p-5">
                {espacoRapidoErro && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{espacoRapidoErro}</p>}
                <input autoFocus aria-label="Nome do novo espaço" placeholder="Nome do espaço *" value={espacoRapidoNome} onChange={e => setEspacoRapidoNome(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm" />
                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <button type="button" disabled={salvandoEspacoRapido} onClick={() => {
                    setEspacoRapidoOpen(false)
                    if (espacoRapidoTriggerRef.current?.isConnected) espacoRapidoTriggerRef.current.focus()
                  }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Voltar à série</button>
                  <button type="submit" disabled={salvandoEspacoRapido} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{salvandoEspacoRapido ? 'Criando...' : 'Criar e selecionar'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
    </>
  )
}
