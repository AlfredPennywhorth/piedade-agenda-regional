import { useState, useEffect, useRef } from 'react'
import { LocalCreate } from '@piedade/shared'
import * as apiClient from '../../api/apiClient'

interface Local {
  id: string
  nome: string
  endereco: string
  numero: string
  complemento?: string | null
  bairro?: string | null
  cidade: string
  uf: string
  cep?: string | null
  referencia?: string | null
  latitude?: number | null
  longitude?: number | null
  urlMaps?: string | null
  urlWaze?: string | null
  ativo: boolean
}

interface ViaCepResponse {
  cep?: string
  logradouro?: string
  complemento?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean
}

type LocalFormData = {
  nome: string
  endereco: string
  numero: string
  complemento?: string | null
  bairro?: string | null
  cidade: string
  uf: string
  cep?: string | null
  referencia?: string | null
  latitude?: number | null
  longitude?: number | null
  urlMaps?: string | null
  urlWaze?: string | null
  ativo: boolean
}

export function LocaisView() {
  const [locais, setLocais] = useState<Local[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<LocalFormData>({
    nome: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    cep: '',
    referencia: '',
    latitude: null,
    longitude: null,
    urlMaps: '',
    urlWaze: '',
    ativo: true,
  })
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof LocalFormData, string>>>({})
  const [saving, setSaving] = useState(false)
  const [consultandoCep, setConsultandoCep] = useState(false)
  const [cepMensagem, setCepMensagem] = useState<string | null>(null)
  const [cepErro, setCepErro] = useState(false)
  const cepConsultaSeq = useRef(0)
  
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedLocal, setSelectedLocal] = useState<Local | null>(null)

  const fetchLocais = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiClient.fetchWithAuth<Local[]>('/locais')
      setLocais(data || [])
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar locais')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLocais()
  }, [])

  const handleOpenCreate = () => {
    cepConsultaSeq.current += 1
    setConsultandoCep(false)
    setEditingId(null)
    setFormData({
      nome: '',
      endereco: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      uf: '',
      cep: '',
      referencia: '',
      latitude: null,
      longitude: null,
      urlMaps: '',
      urlWaze: '',
      ativo: true,
    })
    setFormErrors({})
    setCepMensagem(null)
    setCepErro(false)
    setFormOpen(true)
  }

  const handleOpenEdit = async (id: string) => {
    cepConsultaSeq.current += 1
    setConsultandoCep(false)
    try {
      setLoading(true)
      const data = await apiClient.fetchWithAuth<Local>(`/locais/${id}`)
      setEditingId(data.id)
      setFormData({
        nome: data.nome,
        endereco: data.endereco,
        numero: data.numero,
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        cidade: data.cidade,
        uf: data.uf,
        cep: data.cep || '',
        referencia: data.referencia || '',
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        urlMaps: data.urlMaps || '',
        urlWaze: data.urlWaze || '',
        ativo: data.ativo,
      })
      setFormErrors({})
      setCepMensagem(null)
      setCepErro(false)
      setFormOpen(true)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar local para edição')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDetail = async (id: string) => {
    try {
      setLoading(true)
      const data = await apiClient.fetchWithAuth<Local>(`/locais/${id}`)
      setSelectedLocal(data)
      setDetailOpen(true)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar detalhes do local')
    } finally {
      setLoading(false)
    }
  }

  const formatarCep = (valor: string) => {
    const digitos = valor.replace(/\D/g, '').slice(0, 8)
    return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos
  }

  const buscarCep = async (cepInformado: string) => {
    const cep = cepInformado.replace(/\D/g, '')
    if (cep.length !== 8) return

    const seq = ++cepConsultaSeq.current
    setConsultandoCep(true)
    setCepMensagem(null)
    setCepErro(false)

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      if (!response.ok) {
        throw new Error('Falha ao consultar CEP')
      }

      const data = await response.json() as ViaCepResponse
      if (seq !== cepConsultaSeq.current) return

      if (data.erro) {
        setCepMensagem('CEP não encontrado. Preencha o endereço manualmente.')
        setCepErro(true)
        return
      }

      setFormData(atual => ({
        ...atual,
        cep: data.cep || formatarCep(cep),
        endereco: data.logradouro || atual.endereco,
        bairro: data.bairro || atual.bairro,
        cidade: data.localidade || atual.cidade,
        uf: (data.uf || atual.uf).toUpperCase(),
      }))
      setFormErrors(errosAtuais => ({
        ...errosAtuais,
        endereco: undefined,
        cidade: undefined,
        uf: undefined,
      }))
      setCepMensagem('Endereço preenchido automaticamente pelo CEP.')
    } catch {
      if (seq !== cepConsultaSeq.current) return
      setCepMensagem('Não foi possível consultar o CEP agora. Preencha o endereço manualmente.')
      setCepErro(true)
    } finally {
      if (seq === cepConsultaSeq.current) {
        setConsultandoCep(false)
      }
    }
  }

  const handleCepChange = (valor: string) => {
    const cepFormatado = formatarCep(valor)
    setFormData(atual => ({ ...atual, cep: cepFormatado }))
    setCepMensagem(null)
    setCepErro(false)

    if (cepFormatado.replace(/\D/g, '').length === 8) {
      void buscarCep(cepFormatado)
    } else {
      cepConsultaSeq.current += 1
      setConsultandoCep(false)
    }
  }

  const fecharFormulario = () => {
    cepConsultaSeq.current += 1
    setConsultandoCep(false)
    setFormOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (consultandoCep) {
      setCepMensagem('Aguarde a consulta do CEP terminar antes de salvar.')
      return
    }
    
    // Tratamento de valores vazios/nulos antes da validação
    const payloadToValidate = {
      ...formData,
      complemento: formData.complemento || null,
      bairro: formData.bairro || null,
      cep: formData.cep || null,
      referencia: formData.referencia || null,
      urlMaps: formData.urlMaps || null,
      urlWaze: formData.urlWaze || null,
      latitude: formData.latitude !== null && !isNaN(Number(formData.latitude)) ? Number(formData.latitude) : null,
      longitude: formData.longitude !== null && !isNaN(Number(formData.longitude)) ? Number(formData.longitude) : null,
    }

    try {
      const parsed = LocalCreate.safeParse(payloadToValidate)
      
      if (!parsed.success) {
        const errors: any = {}
        parsed.error.issues.forEach((e: any) => {
          if (e.path[0]) {
            errors[e.path[0].toString()] = e.message
          }
        })
        setFormErrors(errors)
        return
      }

      setFormErrors({})
      setSaving(true)

      if (editingId) {
        await apiClient.patchWithAuth(`/locais/${editingId}`, parsed.data)
      } else {
        await apiClient.postWithAuth('/locais', parsed.data)
      }

      fecharFormulario()
      fetchLocais()
    } catch (err: any) {
      if (err instanceof apiClient.ApiError && err.body?.error) {
        setError(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos')
      } else {
        setError(err.message || 'Erro ao salvar local')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="bg-brand-900 text-white p-6 rounded-2xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Locais</h2>
          <p className="text-brand-200 text-sm mt-1">Cadastro de casas de oração, templos e outros locais para eventos</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-5 py-2.5 bg-white text-brand-900 font-semibold rounded-lg text-sm hover:bg-brand-50 transition-colors shadow-sm whitespace-nowrap"
        >
          + Novo Local
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm animate-in fade-in">
          {error}
        </div>
      )}

      {loading && !formOpen && !detailOpen ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
      ) : (locais || []).length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 mb-4">Nenhum local cadastrado.</p>
          <button
            onClick={handleOpenCreate}
            className="text-brand-600 font-medium hover:text-brand-700"
          >
            Cadastrar primeiro local
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Endereço</th>
                  <th className="px-6 py-4">Cidade/UF</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {locais.map((local) => (
                  <tr key={local.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{local.nome}</td>
                    <td className="px-6 py-4">{local.endereco}, {local.numero}</td>
                    <td className="px-6 py-4">{local.cidade} - {local.uf}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${local.ativo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                        {local.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button
                        onClick={() => handleOpenDetail(local.id)}
                        className="text-brand-600 hover:text-brand-900 font-medium"
                      >
                        Ver
                      </button>
                      <button
                        onClick={() => handleOpenEdit(local.id)}
                        className="text-amber-600 hover:text-amber-900 font-medium"
                      >
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

      {/* Formulário Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div 
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="modal-form-title"
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 id="modal-form-title" className="text-lg font-semibold text-slate-900">
                {editingId ? 'Editar Local' : 'Novo Local'}
              </h3>
              <button
                onClick={fecharFormulario}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} noValidate className="p-6 overflow-y-auto space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium text-slate-900 border-b pb-2">Informações Básicas</h4>
                <div>
                  <label htmlFor="nome" className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                  <input
                    id="nome"
                    type="text"
                    value={formData.nome}
                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="Ex: Templo Central"
                  />
                  {formErrors.nome && <p role="alert" className="text-red-500 text-xs mt-1">{formErrors.nome}</p>}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-slate-900 border-b pb-2">Endereço</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="cep" className="block text-sm font-medium text-slate-700 mb-1">CEP</label>
                    <input
                      id="cep"
                      type="text"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      value={formData.cep || ''}
                      onChange={e => handleCepChange(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="00000-000"
                      aria-describedby="cep-feedback"
                    />
                    <div id="cep-feedback" className={`text-xs mt-1 min-h-4 ${cepErro ? 'text-red-600' : 'text-slate-500'}`}>
                      {consultandoCep ? 'Consultando CEP...' : cepMensagem}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="bairro" className="block text-sm font-medium text-slate-700 mb-1">Bairro</label>
                    <input
                      id="bairro"
                      type="text"
                      value={formData.bairro || ''}
                      onChange={e => setFormData({ ...formData, bairro: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-3">
                    <label htmlFor="endereco" className="block text-sm font-medium text-slate-700 mb-1">Endereço *</label>
                    <input
                      id="endereco"
                      type="text"
                      value={formData.endereco}
                      onChange={e => setFormData({ ...formData, endereco: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                    {formErrors.endereco && <p role="alert" className="text-red-500 text-xs mt-1">{formErrors.endereco}</p>}
                  </div>
                  <div>
                    <label htmlFor="numero" className="block text-sm font-medium text-slate-700 mb-1">Número *</label>
                    <input
                      id="numero"
                      type="text"
                      value={formData.numero}
                      onChange={e => setFormData({ ...formData, numero: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                    {formErrors.numero && <p role="alert" className="text-red-500 text-xs mt-1">{formErrors.numero}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="complemento" className="block text-sm font-medium text-slate-700 mb-1">Complemento</label>
                    <input
                      id="complemento"
                      type="text"
                      value={formData.complemento || ''}
                      onChange={e => setFormData({ ...formData, complemento: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="referencia" className="block text-sm font-medium text-slate-700 mb-1">Referência</label>
                    <input
                      id="referencia"
                      type="text"
                      value={formData.referencia || ''}
                      onChange={e => setFormData({ ...formData, referencia: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-3">
                    <label htmlFor="cidade" className="block text-sm font-medium text-slate-700 mb-1">Cidade *</label>
                    <input
                      id="cidade"
                      type="text"
                      value={formData.cidade}
                      onChange={e => setFormData({ ...formData, cidade: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                    {formErrors.cidade && <p role="alert" className="text-red-500 text-xs mt-1">{formErrors.cidade}</p>}
                  </div>
                  <div>
                    <label htmlFor="uf" className="block text-sm font-medium text-slate-700 mb-1">UF *</label>
                    <input
                      id="uf"
                      type="text"
                      maxLength={2}
                      value={formData.uf}
                      onChange={e => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 uppercase"
                      placeholder="SP"
                    />
                    {formErrors.uf && <p role="alert" className="text-red-500 text-xs mt-1">{formErrors.uf}</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-slate-900 border-b pb-2">Geolocalização & Navegação (Opcional)</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="latitude" className="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
                    <input
                      id="latitude"
                      type="number"
                      step="any"
                      value={formData.latitude === null ? '' : formData.latitude}
                      onChange={e => setFormData({ ...formData, latitude: e.target.value ? Number(e.target.value) : null })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="-23.5505"
                    />
                  </div>
                  <div>
                    <label htmlFor="longitude" className="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
                    <input
                      id="longitude"
                      type="number"
                      step="any"
                      value={formData.longitude === null ? '' : formData.longitude}
                      onChange={e => setFormData({ ...formData, longitude: e.target.value ? Number(e.target.value) : null })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="-46.6333"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="urlMaps" className="block text-sm font-medium text-slate-700 mb-1">URL Google Maps</label>
                  <input
                    id="urlMaps"
                    type="url"
                    value={formData.urlMaps || ''}
                    onChange={e => setFormData({ ...formData, urlMaps: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="https://maps.google.com/..."
                  />
                  {formErrors.urlMaps && <p role="alert" className="text-red-500 text-xs mt-1">{formErrors.urlMaps}</p>}
                </div>
                <div>
                  <label htmlFor="urlWaze" className="block text-sm font-medium text-slate-700 mb-1">URL Waze</label>
                  <input
                    id="urlWaze"
                    type="url"
                    value={formData.urlWaze || ''}
                    onChange={e => setFormData({ ...formData, urlWaze: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="https://waze.com/ul?..."
                  />
                  {formErrors.urlWaze && <p role="alert" className="text-red-500 text-xs mt-1">{formErrors.urlWaze}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="ativo" className="flex items-center gap-2 cursor-pointer">
                  <input
                    id="ativo"
                    type="checkbox"
                    checked={formData.ativo}
                    onChange={e => setFormData({ ...formData, ativo: e.target.checked })}
                    className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Local Ativo</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={fecharFormulario}
                  className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || consultandoCep}
                  className="px-6 py-2.5 bg-brand-600 text-white font-medium rounded-lg text-sm hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : consultandoCep ? 'Consultando CEP...' : 'Salvar Local'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detalhe Modal */}
      {detailOpen && selectedLocal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div 
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="modal-detail-title"
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 id="modal-detail-title" className="text-lg font-semibold text-slate-900">
                Detalhes do Local
              </h3>
              <button
                onClick={() => setDetailOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-slate-500 mb-1">Nome</p>
                <p className="font-medium text-slate-900">{selectedLocal.nome}</p>
              </div>
              
              <div>
                <p className="text-sm text-slate-500 mb-1">Endereço Completo</p>
                <p className="text-slate-900">
                  {selectedLocal.endereco}, {selectedLocal.numero}
                  {selectedLocal.complemento && ` - ${selectedLocal.complemento}`}
                </p>
                <p className="text-slate-900">
                  {selectedLocal.bairro && `${selectedLocal.bairro} - `}
                  {selectedLocal.cidade} / {selectedLocal.uf}
                </p>
                {selectedLocal.cep && <p className="text-slate-900">CEP: {selectedLocal.cep}</p>}
                {selectedLocal.referencia && <p className="text-slate-500 text-sm italic mt-1">Ref: {selectedLocal.referencia}</p>}
              </div>

              {(selectedLocal.latitude || selectedLocal.longitude) && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Coordenadas</p>
                  <p className="text-slate-900 font-mono text-sm">
                    {selectedLocal.latitude}, {selectedLocal.longitude}
                  </p>
                </div>
              )}

              {(selectedLocal.urlMaps || selectedLocal.urlWaze) && (
                <div className="pt-2 flex flex-col gap-2">
                  <p className="text-sm text-slate-500">Navegação</p>
                  <div className="flex gap-3">
                    {selectedLocal.urlMaps && (
                      <a href={selectedLocal.urlMaps} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline text-sm font-medium">
                        Ver no Google Maps
                      </a>
                    )}
                    {selectedLocal.urlWaze && (
                      <a href={selectedLocal.urlWaze} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline text-sm font-medium">
                        Ver no Waze
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${selectedLocal.ativo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                  {selectedLocal.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setDetailOpen(false)}
                className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors text-sm"
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
