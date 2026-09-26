import { useEffect, useMemo, useRef, useState } from 'react'
import { CreateMembroSchema, UpdateMembroSchema } from '@piedade/shared'
import { ApiError, fetchWithAuth, patchWithAuth, postWithAuth } from '../../api/apiClient'
import type { Regional } from '../regionais/RegionaisView'
import type { Administracao } from '../administracoes/AdministracoesView'
import type { Setor } from '../setores/SetoresView'
import type { Casa } from '../casas/CasasView'

export interface Membro {
  id: string
  nome: string
  dataOrdenacao: string
  codigoCarteirinha: string
  celular: string | null
  casaId: string
  ativo: boolean
  createdAt?: string
  updatedAt?: string
}

interface PreCadastroMinisterial {
  id: string
  nome: string
  ministerio: string | null
  rrm: string
  regionalId: string | null
  administracaoOrigem: string | null
  localidadeOrigem: string | null
  codigoCasaReferencia: string | null
  casaId: string | null
  dataOrdenacao: string | null
  vinculado: boolean
}

interface RespostaBuscaPreCadastro {
  data: PreCadastroMinisterial[]
  meta: {
    busca: string
    limit: number
    totalRetornado: number
  }
}

const ordenarPorNome = <T extends { nome: string }>(itens: T[]) =>
  [...itens].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))

export function MembrosView() {
  const [membros, setMembros] = useState<Membro[]>([])
  const [casas, setCasas] = useState<Casa[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [administracoes, setAdministracoes] = useState<Administracao[]>([])
  const [regionais, setRegionais] = useState<Regional[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  const [filtroSetorId, setFiltroSetorId] = useState('')
  const [filtroBusca, setFiltroBusca] = useState('')

  const [modoForm, setModoForm] = useState<'criar' | 'editar' | null>(null)
  const [tipoCriacao, setTipoCriacao] = useState<'pre-cadastro' | 'manual'>('pre-cadastro')
  const [membroEditandoId, setMembroEditandoId] = useState<string | null>(null)
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [errosForm, setErrosForm] = useState<Record<string, string>>({})

  const [regionalId, setRegionalId] = useState('')
  const [administracaoId, setAdministracaoId] = useState('')
  const [setorId, setSetorId] = useState('')
  const [casaId, setCasaId] = useState('')
  const [buscaCasa, setBuscaCasa] = useState('')
  const [nome, setNome] = useState('')
  const [dataOrdenacao, setDataOrdenacao] = useState('')
  const [codigoCarteirinha, setCodigoCarteirinha] = useState('')
  const [celular, setCelular] = useState('')
  const [ativo, setAtivo] = useState(true)

  const [buscaPreCadastro, setBuscaPreCadastro] = useState('')
  const [resultadosPreCadastro, setResultadosPreCadastro] = useState<PreCadastroMinisterial[]>([])
  const [preCadastroSelecionado, setPreCadastroSelecionado] = useState<PreCadastroMinisterial | null>(null)
  const [buscandoPreCadastro, setBuscandoPreCadastro] = useState(false)
  const buscaPreCadastroSeq = useRef(0)

  const carregarDados = async () => {
    setLoading(true)
    setErro(null)
    try {
      const [membrosData, casasData, setoresData, administracoesData, regionaisData] = await Promise.all([
        fetchWithAuth<Membro[]>('/membros'),
        fetchWithAuth<Casa[]>('/casas'),
        fetchWithAuth<Setor[]>('/setores'),
        fetchWithAuth<Administracao[]>('/administracoes'),
        fetchWithAuth<Regional[]>('/regionais'),
      ])

      setMembros(ordenarPorNome(membrosData))
      setCasas(ordenarPorNome(casasData))
      setSetores(ordenarPorNome(setoresData))
      setAdministracoes(ordenarPorNome(administracoesData))
      setRegionais(ordenarPorNome(regionaisData))
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os dados de membros e estrutura territorial.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  useEffect(() => {
    if (tipoCriacao !== 'pre-cadastro' || modoForm !== 'criar') return

    const busca = buscaPreCadastro.trim()
    const seq = ++buscaPreCadastroSeq.current

    if (busca.length < 2) {
      setResultadosPreCadastro([])
      setBuscandoPreCadastro(false)
      return
    }

    const timer = window.setTimeout(async () => {
      setBuscandoPreCadastro(true)
      try {
        const params = new URLSearchParams({ busca, limit: '20' })
        if (regionalId) params.set('regionalId', regionalId)
        const resposta = await fetchWithAuth<RespostaBuscaPreCadastro>(
          `/admin/pre-cadastros-ministeriais?${params.toString()}`
        )
        if (seq === buscaPreCadastroSeq.current) {
          setResultadosPreCadastro(resposta.data)
        }
      } catch (err: any) {
        if (seq === buscaPreCadastroSeq.current) {
          setErro(err.message || 'Não foi possível pesquisar o pré-cadastro ministerial.')
        }
      } finally {
        if (seq === buscaPreCadastroSeq.current) {
          setBuscandoPreCadastro(false)
        }
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [buscaPreCadastro, modoForm, regionalId, tipoCriacao])

  const administracoesDisponiveis = useMemo(
    () => ordenarPorNome(administracoes.filter(item => !regionalId || item.regionalId === regionalId)),
    [administracoes, regionalId]
  )

  const setoresDisponiveis = useMemo(
    () => ordenarPorNome(setores.filter(item => !administracaoId || item.administracaoId === administracaoId)),
    [setores, administracaoId]
  )

  const casasDisponiveis = useMemo(() => {
    const termo = buscaCasa.trim().toLocaleLowerCase('pt-BR')
    return ordenarPorNome(
      casas.filter(item => {
        if (setorId && item.setorId !== setorId) return false
        if (!setorId) return false
        if (!termo) return true
        return (
          item.nome.toLocaleLowerCase('pt-BR').includes(termo) ||
          (item.codigo || '').toLocaleLowerCase('pt-BR').includes(termo)
        )
      })
    )
  }, [buscaCasa, casas, setorId])

  const membrosFiltrados = useMemo(() => {
    const termo = filtroBusca.trim().toLocaleLowerCase('pt-BR')
    return membros.filter(membro => {
      const casa = casas.find(item => item.id === membro.casaId)
      if (filtroSetorId && casa?.setorId !== filtroSetorId) return false
      if (!termo) return true
      return (
        membro.nome.toLocaleLowerCase('pt-BR').includes(termo) ||
        (membro.codigoCarteirinha || '').toLocaleLowerCase('pt-BR').includes(termo) ||
        (casa?.nome || '').toLocaleLowerCase('pt-BR').includes(termo) ||
        (casa?.codigo || '').toLocaleLowerCase('pt-BR').includes(termo)
      )
    })
  }, [casas, filtroBusca, filtroSetorId, membros])

  const definirHierarquiaPorCasa = (idCasa: string | null | undefined) => {
    if (!idCasa) {
      setCasaId('')
      return
    }
    const casa = casas.find(item => item.id === idCasa)
    if (!casa) return
    const setor = setores.find(item => item.id === casa.setorId)
    const administracao = setor
      ? administracoes.find(item => item.id === setor.administracaoId)
      : undefined

    setRegionalId(administracao?.regionalId || '')
    setAdministracaoId(administracao?.id || '')
    setSetorId(setor?.id || '')
    setCasaId(casa.id)
    setBuscaCasa('')
  }

  const resetarFormulario = () => {
    setRegionalId('')
    setAdministracaoId('')
    setSetorId('')
    setCasaId('')
    setBuscaCasa('')
    setNome('')
    setDataOrdenacao('')
    setCodigoCarteirinha('')
    setCelular('')
    setAtivo(true)
    setBuscaPreCadastro('')
    setResultadosPreCadastro([])
    setPreCadastroSelecionado(null)
    setErrosForm({})
  }

  const abrirFormCriar = () => {
    setModoForm('criar')
    setMembroEditandoId(null)
    setTipoCriacao('pre-cadastro')
    resetarFormulario()
    setErro(null)
    setSucesso(null)
  }

  const abrirFormEditar = async (id: string) => {
    setModoForm('editar')
    setTipoCriacao('manual')
    setMembroEditandoId(id)
    setCarregandoDetalhes(true)
    setErrosForm({})
    setErro(null)
    setSucesso(null)

    try {
      const item = await fetchWithAuth<Membro>(`/membros/${id}`)
      definirHierarquiaPorCasa(item.casaId)
      setNome(item.nome || '')
      setDataOrdenacao(item.dataOrdenacao ? item.dataOrdenacao.substring(0, 10) : '')
      setCodigoCarteirinha(item.codigoCarteirinha || '')
      setCelular(item.celular || '')
      setAtivo(item.ativo ?? true)
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar os detalhes do membro para edição.')
      setModoForm(null)
    } finally {
      setCarregandoDetalhes(false)
    }
  }

  const fecharForm = () => {
    setModoForm(null)
    setMembroEditandoId(null)
    setErrosForm({})
    setResultadosPreCadastro([])
    setPreCadastroSelecionado(null)
  }

  const selecionarPreCadastro = (item: PreCadastroMinisterial) => {
    if (item.vinculado) return

    setPreCadastroSelecionado(item)
    setBuscaPreCadastro(item.nome)
    setResultadosPreCadastro([])
    setNome(item.nome)
    setDataOrdenacao(item.dataOrdenacao?.substring(0, 10) || '')
    definirHierarquiaPorCasa(item.casaId)
  }

  const trocarRegional = (novoRegionalId: string) => {
    setRegionalId(novoRegionalId)
    const primeiraAdministracao =
      administracoes.find(item => item.regionalId === novoRegionalId)?.id || ''
    setAdministracaoId(primeiraAdministracao)
    setSetorId('')
    setCasaId('')
    setBuscaCasa('')
  }

  const trocarAdministracao = (novaAdministracaoId: string) => {
    setAdministracaoId(novaAdministracaoId)
    setSetorId('')
    setCasaId('')
    setBuscaCasa('')
  }

  const trocarSetor = (novoSetorId: string) => {
    setSetorId(novoSetorId)
    setCasaId('')
    setBuscaCasa('')
  }

  const finalizarPreCadastro = async () => {
    if (!preCadastroSelecionado) {
      setErro('Selecione um pré-cadastro ministerial antes de continuar.')
      return
    }
    if (!codigoCarteirinha.trim()) {
      setErro('Informe o código da carteirinha.')
      return
    }
    if (!celular.trim()) {
      setErro('Informe o celular para finalizar o pré-cadastro.')
      return
    }
    if (!casaId) {
      setErro('Confirme a Casa de Oração.')
      return
    }

    setSalvando(true)
    setErro(null)
    try {
      await postWithAuth(`/admin/pre-cadastros-ministeriais/${preCadastroSelecionado.id}/finalizar`, {
        codigoCarteirinha: codigoCarteirinha.trim(),
        celular: celular.trim(),
        casaId,
      })
      setSucesso('Pré-cadastro finalizado e membro criado com sucesso!')
      fecharForm()
      await carregarDados()
    } catch (err: any) {
      if (err instanceof ApiError && err.body?.error) {
        setErro(typeof err.body.error === 'string' ? err.body.error : 'Não foi possível finalizar o pré-cadastro.')
      } else {
        setErro(err.message || 'Não foi possível finalizar o pré-cadastro.')
      }
    } finally {
      setSalvando(false)
    }
  }

  const salvarManual = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrosForm({})
    setErro(null)
    setSucesso(null)

    const payload = {
      casaId,
      nome: nome.trim(),
      dataOrdenacao: dataOrdenacao.trim(),
      codigoCarteirinha: codigoCarteirinha.trim(),
      celular: celular.trim() ? celular.trim() : null,
      ativo,
    }

    const parsed =
      modoForm === 'editar'
        ? UpdateMembroSchema.safeParse(payload)
        : CreateMembroSchema.safeParse(payload)

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      parsed.error.issues.forEach(issue => {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message
      })
      setErrosForm(fieldErrors)
      return
    }

    setSalvando(true)
    try {
      if (modoForm === 'editar' && membroEditandoId) {
        await patchWithAuth(`/membros/${membroEditandoId}`, parsed.data)
        setSucesso('Membro atualizado com sucesso!')
      } else {
        await postWithAuth('/membros', parsed.data)
        setSucesso('Membro criado com sucesso!')
      }
      fecharForm()
      await carregarDados()
    } catch (err: any) {
      if (err instanceof ApiError && err.body?.error) {
        setErro(typeof err.body.error === 'string' ? err.body.error : 'Dados inválidos.')
      } else {
        setErro(err.message || 'Erro ao salvar o membro.')
      }
    } finally {
      setSalvando(false)
    }
  }

  const excluirMembro = async (membro: Membro) => {
    if (
      !window.confirm(
        `Excluir definitivamente o cadastro de ${membro.nome}? Esta ação só será permitida se o membro ainda não possuir conta, vínculo, convocação ou outro histórico relacionado.`
      )
    ) {
      return
    }

    setExcluindoId(membro.id)
    setErro(null)
    setSucesso(null)

    try {
      await fetchWithAuth(`/membros/${membro.id}`, { method: 'DELETE' })
      setSucesso('Membro excluído com sucesso.')
      if (membroEditandoId === membro.id) fecharForm()
      await carregarDados()
    } catch (err: any) {
      if (err instanceof ApiError && err.body?.error) {
        setErro(typeof err.body.error === 'string' ? err.body.error : 'Não foi possível excluir o membro.')
      } else {
        setErro(err.message || 'Não foi possível excluir o membro.')
      }
    } finally {
      setExcluindoId(null)
    }
  }

  const getCasaNome = (id: string) => {
    const casa = casas.find(item => item.id === id)
    return casa ? casa.nome : id
  }

  const seletorTerritorial = (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-800">Casa de Oração</h4>
        <p className="text-xs text-slate-500">
          Selecione a estrutura territorial e depois localize a Casa por nome ou código.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="input-regional" className="block text-xs font-semibold text-slate-700 mb-1">
            Regional
          </label>
          <select
            id="input-regional"
            value={regionalId}
            onChange={event => trocarRegional(event.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            disabled={salvando}
          >
            <option value="">Selecione...</option>
            {regionais.map(item => (
              <option key={item.id} value={item.id}>{item.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="input-administracao" className="block text-xs font-semibold text-slate-700 mb-1">
            Administração
          </label>
          <select
            id="input-administracao"
            value={administracaoId}
            onChange={event => trocarAdministracao(event.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            disabled={salvando || !regionalId}
          >
            <option value="">Selecione...</option>
            {administracoesDisponiveis.map(item => (
              <option key={item.id} value={item.id}>{item.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="input-setor" className="block text-xs font-semibold text-slate-700 mb-1">
            Setor
          </label>
          <select
            id="input-setor"
            value={setorId}
            onChange={event => trocarSetor(event.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            disabled={salvando || !administracaoId}
          >
            <option value="">Selecione...</option>
            {setoresDisponiveis.map(item => (
              <option key={item.id} value={item.id}>{item.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="input-busca-casa" className="block text-xs font-semibold text-slate-700 mb-1">
          Buscar Casa de Oração
        </label>
        <input
          id="input-busca-casa"
          type="search"
          value={buscaCasa}
          onChange={event => setBuscaCasa(event.target.value)}
          placeholder={setorId ? 'Digite o nome ou código da Casa...' : 'Selecione primeiro o Setor'}
          disabled={salvando || !setorId}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
        />
      </div>

      <div>
        <label htmlFor="input-casa" className="block text-xs font-semibold text-slate-700 mb-1">
          Casa de Oração <span className="text-red-500">*</span>
        </label>
        <select
          id="input-casa"
          value={casaId}
          onChange={event => setCasaId(event.target.value)}
          className={`w-full px-3 py-2 border rounded-lg text-sm bg-white ${
            errosForm.casaId ? 'border-red-400' : 'border-slate-300'
          }`}
          disabled={salvando || !setorId}
        >
          <option value="">Selecione uma Casa de Oração...</option>
          {casasDisponiveis.map(item => (
            <option key={item.id} value={item.id}>
              {item.nome} {item.codigo ? `(${item.codigo})` : ''}
            </option>
          ))}
        </select>
        {setorId && (
          <p className="text-xs text-slate-500 mt-1">
            {casasDisponiveis.length} Casa(s) disponível(is), em ordem alfabética.
          </p>
        )}
        {errosForm.casaId && <p className="text-xs text-red-600 mt-1">{errosForm.casaId}</p>}
      </div>
    </div>
  )

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Diretório de Membros</h2>
          <p className="text-xs text-slate-500">Listagem, cadastro e finalização de pré-cadastros ministeriais</p>
        </div>
        <button
          onClick={abrirFormCriar}
          className="bg-brand-600 hover:bg-brand-700 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          + Cadastrar Membro
        </button>
      </div>

      {erro && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm flex justify-between items-center">
          <span>{erro}</span>
          <button onClick={() => setErro(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      {sucesso && (
        <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm flex justify-between items-center">
          <span>{sucesso}</span>
          <button onClick={() => setSucesso(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="filtro-setor" className="block text-xs font-semibold text-slate-700 mb-1">
            Filtrar membros por Setor
          </label>
          <select
            id="filtro-setor"
            value={filtroSetorId}
            onChange={event => setFiltroSetorId(event.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
          >
            <option value="">Todos os Setores</option>
            {setores.map(item => (
              <option key={item.id} value={item.id}>{item.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filtro-busca" className="block text-xs font-semibold text-slate-700 mb-1">
            Buscar membro ou Casa
          </label>
          <input
            id="filtro-busca"
            type="search"
            value={filtroBusca}
            onChange={event => setFiltroBusca(event.target.value)}
            placeholder="Nome, carteirinha, Casa ou código..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
          />
        </div>
        <div className="sm:col-span-2 text-xs text-slate-500 font-medium">
          Exibindo {membrosFiltrados.length} de {membros.length} membros
        </div>
      </div>

      {modoForm && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-md space-y-5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 text-base">
              {modoForm === 'editar' ? 'Editar Membro' : 'Cadastrar Membro'}
            </h3>
            <button onClick={fecharForm} className="text-slate-500 text-sm font-semibold">Cancelar</button>
          </div>

          {carregandoDetalhes ? (
            <div className="py-6 text-center text-slate-500 text-sm">Carregando dados do membro...</div>
          ) : (
            <>
              {modoForm === 'criar' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl bg-slate-50 border border-slate-200 p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTipoCriacao('pre-cadastro')
                      resetarFormulario()
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                      tipoCriacao === 'pre-cadastro'
                        ? 'bg-brand-600 text-white'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    Finalizar pré-cadastro ministerial
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoCriacao('manual')
                      resetarFormulario()
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                      tipoCriacao === 'manual'
                        ? 'bg-brand-600 text-white'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    Novo membro manual
                  </button>
                </div>
              )}

              {modoForm === 'criar' && tipoCriacao === 'pre-cadastro' && (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="busca-pre-cadastro" className="block text-xs font-semibold text-slate-700 mb-1">
                      Localizar pré-cadastro pelo nome
                    </label>
                    <input
                      id="busca-pre-cadastro"
                      type="search"
                      value={buscaPreCadastro}
                      onChange={event => {
                        setBuscaPreCadastro(event.target.value)
                        setPreCadastroSelecionado(null)
                      }}
                      placeholder="Digite pelo menos 2 letras..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      disabled={salvando}
                    />
                  </div>

                  {buscandoPreCadastro && <p className="text-xs text-slate-500">Pesquisando...</p>}

                  {resultadosPreCadastro.length > 0 && (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
                      {resultadosPreCadastro.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selecionarPreCadastro(item)}
                          disabled={item.vinculado}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="block text-sm font-semibold text-slate-800">{item.nome}</span>
                          <span className="block text-xs text-slate-500">
                            {item.ministerio || 'Ministério não informado'}
                            {item.localidadeOrigem ? ` · ${item.localidadeOrigem}` : ''}
                            {item.codigoCasaReferencia ? ` · ${item.codigoCasaReferencia}` : ''}
                            {item.vinculado ? ' · Já vinculado' : ''}
                          </span>
                          <span className="mt-1 block text-[11px] text-slate-500">
                            RRM: {item.rrm || 'não informado'}
                            {item.administracaoOrigem ? ` · Administração: ${item.administracaoOrigem}` : ''}
                            {item.dataOrdenacao ? ` · Ordenação: ${item.dataOrdenacao.substring(0, 10)}` : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {preCadastroSelecionado && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-sm font-semibold text-emerald-800">{preCadastroSelecionado.nome}</p>
                      <p className="text-xs text-emerald-700">
                        Pré-cadastro selecionado. Confirme a Casa, carteirinha e celular.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {seletorTerritorial}

              <form
                onSubmit={event => {
                  if (modoForm === 'criar' && tipoCriacao === 'pre-cadastro') {
                    event.preventDefault()
                    finalizarPreCadastro()
                  } else {
                    salvarManual(event)
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="input-nome" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="input-nome"
                    type="text"
                    value={nome}
                    onChange={event => setNome(event.target.value)}
                    readOnly={modoForm === 'criar' && tipoCriacao === 'pre-cadastro'}
                    placeholder="Ex: João da Silva"
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      errosForm.nome ? 'border-red-400' : 'border-slate-300'
                    } ${
                      modoForm === 'criar' && tipoCriacao === 'pre-cadastro' ? 'bg-slate-100' : 'bg-white'
                    }`}
                    disabled={salvando}
                  />
                  {errosForm.nome && <p className="text-xs text-red-600 mt-1">{errosForm.nome}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="input-carteirinha" className="block text-xs font-semibold text-slate-700 mb-1">
                      Código da Carteirinha <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="input-carteirinha"
                      type="text"
                      value={codigoCarteirinha}
                      onChange={event => setCodigoCarteirinha(event.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${errosForm.codigoCarteirinha ? 'border-red-400' : 'border-slate-300'}`}
                      disabled={salvando}
                    />
                    {errosForm.codigoCarteirinha && <p className="text-xs text-red-600 mt-1">{errosForm.codigoCarteirinha}</p>}
                  </div>

                  <div>
                    <label htmlFor="input-ordenacao" className="block text-xs font-semibold text-slate-700 mb-1">
                      Data de Ordenação <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="input-ordenacao"
                      type="date"
                      value={dataOrdenacao}
                      onChange={event => setDataOrdenacao(event.target.value)}
                      readOnly={modoForm === 'criar' && tipoCriacao === 'pre-cadastro'}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        errosForm.dataOrdenacao ? 'border-red-400' : 'border-slate-300'
                      } ${
                        modoForm === 'criar' && tipoCriacao === 'pre-cadastro' ? 'bg-slate-100' : 'bg-white'
                      }`}
                      disabled={salvando}
                    />
                    {errosForm.dataOrdenacao && <p className="text-xs text-red-600 mt-1">{errosForm.dataOrdenacao}</p>}
                  </div>

                  <div>
                    <label htmlFor="input-celular" className="block text-xs font-semibold text-slate-700 mb-1">
                      Celular {modoForm === 'criar' && tipoCriacao === 'pre-cadastro' ? '*' : '(Opcional)'}
                    </label>
                    <input
                      id="input-celular"
                      type="tel"
                      inputMode="tel"
                      value={celular}
                      onChange={event => setCelular(event.target.value)}
                      placeholder="Ex: 11999999999"
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${errosForm.celular ? 'border-red-400' : 'border-slate-300'}`}
                      disabled={salvando}
                    />
                    {errosForm.celular && <p className="text-xs text-red-600 mt-1">{errosForm.celular}</p>}
                  </div>
                </div>

                {(modoForm === 'editar' || tipoCriacao === 'manual') && (
                  <label className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                    <input
                      type="checkbox"
                      checked={ativo}
                      onChange={event => setAtivo(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                      disabled={salvando}
                    />
                    Membro Ativo
                  </label>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={fecharForm}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
                    disabled={salvando}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium shadow-sm disabled:opacity-50"
                    disabled={salvando}
                  >
                    {salvando
                      ? 'Salvando...'
                      : modoForm === 'criar' && tipoCriacao === 'pre-cadastro'
                        ? 'Finalizar pré-cadastro'
                        : modoForm === 'editar'
                          ? 'Atualizar Membro'
                          : 'Salvar Membro'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Carregando membros...</div>
        ) : membrosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Nenhum membro encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Casa de Oração</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {membrosFiltrados.map(membro => (
                  <tr key={membro.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-800">{membro.nome}</td>
                    <td className="p-3 text-xs text-slate-600 font-medium">{getCasaNome(membro.casaId)}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        membro.ativo
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {membro.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => abrirFormEditar(membro.id)}
                          disabled={excluindoId === membro.id}
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1 bg-brand-50 hover:bg-brand-100 rounded disabled:opacity-50"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => void excluirMembro(membro)}
                          disabled={excluindoId === membro.id}
                          className="text-xs text-red-700 hover:text-red-900 font-medium px-2 py-1 bg-red-50 hover:bg-red-100 rounded disabled:opacity-50"
                        >
                          {excluindoId === membro.id ? 'Excluindo...' : 'Excluir'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
