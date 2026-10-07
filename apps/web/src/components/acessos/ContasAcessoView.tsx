import { useEffect, useMemo, useState } from 'react'
import { ApiError, fetchWithAuth, patchWithAuth, postWithAuth } from '../../api/apiClient'
import { GerenciarAcessosPanel } from './GerenciarAcessosPanel'

interface Acesso {
  id: string
  perfilCodigo: string
  escopoTipo: string
  escopoId: string | null
}

interface ContaAdministrada {
  membroId: string
  nome: string
  celular: string | null
  codigoCarteirinha: string | null
  casaId: string
  contaAcessoId: string | null
  status: string | null
  ativadoEm: string | null
  recuperacaoPinPendente?: boolean
  recuperacaoPinSolicitadaEm?: string | null
  acessos: Acesso[]
}

interface Regional { id: string; nome: string }
interface Administracao { id: string; nome: string; regionalId: string }
interface Setor { id: string; nome: string; administracaoId: string }
interface Casa { id: string; nome: string; setorId: string }

interface LinkTemporario {
  token: string
  expiraEm: string
  membroId: string
}

interface SessaoAdministrada {
  id: string
  criadoEm: string
  ultimoAcessoEm: string | null
  expiraEm: string
  dispositivo: string | null
}

interface FeedbackConta {
  membroId: string
  tipo: 'status' | 'alert'
  mensagem: string
}

interface LinkTemporarioContextual {
  membroId: string
  url: string
  expiraEm: string
  tipo: 'ATIVACAO' | 'REDEFINICAO'
}

function montarLink(token: string) {
  const url = new URL(window.location.origin + window.location.pathname)
  url.searchParams.set('ativacao', token)
  return url.toString()
}

function normalizarCelularWhatsApp(celular: string) {
  const digitos = celular.replace(/\D/g, '')
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) return digitos
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`
  return null
}

function formatarExpiracao(expiraEm: string) {
  const data = new Date(expiraEm)
  if (Number.isNaN(data.getTime())) return expiraEm
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(data)
}

const formatarDataHora = formatarExpiracao

interface ContasAcessoViewProps {
  onPendenciasAtualizadas?: (quantidade: number) => void
  podeGerenciarSessoes?: boolean
}

export function ContasAcessoView({
  onPendenciasAtualizadas,
  podeGerenciarSessoes = false,
}: ContasAcessoViewProps = {}) {
  const [contas, setContas] = useState<ContaAdministrada[]>([])
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)
  const [erroGlobal, setErroGlobal] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<FeedbackConta | null>(null)
  const [linkTemporario, setLinkTemporario] = useState<LinkTemporarioContextual | null>(null)
  const [gerenciandoMembroId, setGerenciandoMembroId] = useState<string | null>(null)
  const [sessoesAbertasMembroId, setSessoesAbertasMembroId] = useState<string | null>(null)
  const [sessoesPorMembro, setSessoesPorMembro] = useState<Record<string, SessaoAdministrada[]>>({})
  const [regionais, setRegionais] = useState<Regional[]>([])
  const [administracoes, setAdministracoes] = useState<Administracao[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [casas, setCasas] = useState<Casa[]>([])
  const [regionalFiltro, setRegionalFiltro] = useState('')
  const [administracaoFiltro, setAdministracaoFiltro] = useState('')
  const [setorFiltro, setSetorFiltro] = useState('')
  const [casaFiltro, setCasaFiltro] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [buscaFiltro, setBuscaFiltro] = useState('')
  const [perfilFiltro, setPerfilFiltro] = useState('')

  const carregar = async () => {
    setErroGlobal(null)
    try {
      const dados = await fetchWithAuth<ContaAdministrada[]>('/admin/acessos')
      setContas(dados)
      onPendenciasAtualizadas?.(
        dados.filter(conta => conta.recuperacaoPinPendente === true).length
      )
    } catch (error) {
      setErroGlobal(error instanceof ApiError ? error.message : 'Não foi possível carregar as contas.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
    void Promise.all([
      fetchWithAuth<Regional[]>('/regionais'),
      fetchWithAuth<Administracao[]>('/administracoes'),
      fetchWithAuth<Setor[]>('/setores'),
      fetchWithAuth<Casa[]>('/casas'),
    ])
      .then(([r, a, s, c]) => {
        setRegionais(r)
        setAdministracoes(a)
        setSetores(s)
        setCasas(c)
      })
      .catch(() => {
        // A listagem principal continua utilizável mesmo se algum lookup falhar.
      })
  }, [])

  const administracoesFiltradas = useMemo(
    () => administracoes.filter(item => !regionalFiltro || item.regionalId === regionalFiltro),
    [administracoes, regionalFiltro]
  )
  const setoresFiltrados = useMemo(
    () => setores.filter(item => {
      const administracao = administracoes.find(adm => adm.id === item.administracaoId)
      if (administracaoFiltro && item.administracaoId !== administracaoFiltro) return false
      const termo = buscaFiltro.trim().toLocaleLowerCase('pt-BR')
    const digitosBusca = buscaFiltro.replace(/\D/g, '')
    if (termo) {
      const nome = conta.nome.toLocaleLowerCase('pt-BR')
      const carteirinha = (conta.codigoCarteirinha ?? '').toLocaleLowerCase('pt-BR')
      const celularDigitos = (conta.celular ?? '').replace(/\D/g, '')
      const encontrouTexto = nome.includes(termo) || carteirinha.includes(termo)
      const encontrouCelular = digitosBusca.length > 0 && celularDigitos.includes(digitosBusca)
      if (!encontrouTexto && !encontrouCelular) return false
    }

    if (perfilFiltro === 'SEM_ACESSO' && conta.acessos.length > 0) return false
    if (perfilFiltro && perfilFiltro !== 'SEM_ACESSO' && !conta.acessos.some(acesso => acesso.perfilCodigo === perfilFiltro)) return false

    if (regionalFiltro && administracao?.regionalId !== regionalFiltro) return false
      return true
    }),
    [setores, administracoes, administracaoFiltro, regionalFiltro]
  )
  const casasFiltradas = useMemo(
    () => casas.filter(item => {
      const setor = setores.find(s => s.id === item.setorId)
      const administracao = administracoes.find(adm => adm.id === setor?.administracaoId)
      if (setorFiltro && item.setorId !== setorFiltro) return false
      if (administracaoFiltro && setor?.administracaoId !== administracaoFiltro) return false
      if (regionalFiltro && administracao?.regionalId !== regionalFiltro) return false
      return true
    }),
    [casas, setores, administracoes, setorFiltro, administracaoFiltro, regionalFiltro]
  )

  const perfisDisponiveis = useMemo(
    () => Array.from(new Set(contas.flatMap(conta => conta.acessos.map(acesso => acesso.perfilCodigo))))
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [contas]
  )

  const contasFiltradas = useMemo(() => contas.filter(conta => {
    const casa = casas.find(item => item.id === conta.casaId)
    const setor = setores.find(item => item.id === casa?.setorId)
    const administracao = administracoes.find(item => item.id === setor?.administracaoId)

    if (regionalFiltro && administracao?.regionalId !== regionalFiltro) return false
    if (administracaoFiltro && administracao?.id !== administracaoFiltro) return false
    if (setorFiltro && setor?.id !== setorFiltro) return false
    if (casaFiltro && conta.casaId !== casaFiltro) return false

    if (statusFiltro === 'SEM_CONTA' && conta.contaAcessoId) return false
    if (statusFiltro === 'RECUPERACAO_PIN' && !conta.recuperacaoPinPendente) return false
    if (statusFiltro && !['SEM_CONTA', 'RECUPERACAO_PIN'].includes(statusFiltro) && conta.status !== statusFiltro) return false
    return true
  }), [contas, casas, setores, administracoes, regionalFiltro, administracaoFiltro, setorFiltro, casaFiltro, statusFiltro, buscaFiltro, perfilFiltro])

  const limparFiltros = () => {
    setRegionalFiltro('')
    setAdministracaoFiltro('')
    setSetorFiltro('')
    setCasaFiltro('')
    setStatusFiltro('')
    setBuscaFiltro('')
    setPerfilFiltro('')
  }

  const contasExibidas = useMemo(() => {
    if (!linkTemporario || contasFiltradas.some(conta => conta.membroId === linkTemporario.membroId)) {
      return contasFiltradas
    }
    const contaDoLink = contas.find(conta => conta.membroId === linkTemporario.membroId)
    return contaDoLink ? [contaDoLink, ...contasFiltradas] : contasFiltradas
  }, [contas, contasFiltradas, linkTemporario])

  useEffect(() => {
    const membroId = feedback?.membroId ?? linkTemporario?.membroId
    if (!membroId) return
    const elemento = document.getElementById(`feedback-conta-${membroId}`)
    elemento?.scrollIntoView?.({ block: 'nearest' })
    elemento?.focus()
  }, [feedback, linkTemporario])

  const gerarLink = async (conta: ContaAdministrada, redefinicao: boolean) => {
    if (
      redefinicao &&
      !window.confirm(
        `Redefinir o PIN de ${conta.nome}? As sessões atuais serão encerradas e a conta só poderá acessar novamente após concluir o novo link.`
      )
    ) {
      return
    }

    setProcessando(conta.membroId)
    setFeedback(null)
    try {
      const endpoint = redefinicao
        ? `/admin/acessos/membros/${conta.membroId}/reset-pin`
        : `/admin/acessos/membros/${conta.membroId}/link-ativacao`
      const resposta = await postWithAuth<LinkTemporario>(endpoint, {})
      if (redefinicao) {
        setSessoesAbertasMembroId(null)
        setSessoesPorMembro(atual => ({ ...atual, [conta.membroId]: [] }))
      }
      setLinkTemporario({
        membroId: conta.membroId,
        url: montarLink(resposta.token),
        expiraEm: resposta.expiraEm,
        tipo: redefinicao ? 'REDEFINICAO' : 'ATIVACAO',
      })
      await carregar()
    } catch (error) {
      setFeedback({
        membroId: conta.membroId,
        tipo: 'alert',
        mensagem: error instanceof ApiError ? error.message : 'Não foi possível gerar o link.',
      })
    } finally {
      setProcessando(null)
    }
  }

  const alterarStatus = async (conta: ContaAdministrada, status: 'ATIVA' | 'BLOQUEADA') => {
    const verbo = status === 'BLOQUEADA' ? 'bloquear' : 'desbloquear'
    if (!window.confirm(`Confirma ${verbo} a conta de ${conta.nome}?`)) return

    setProcessando(conta.membroId)
    setFeedback(null)
    try {
      await patchWithAuth(`/admin/acessos/membros/${conta.membroId}/status`, { status })
      if (status === 'BLOQUEADA') {
        setSessoesAbertasMembroId(null)
        setSessoesPorMembro(atual => ({ ...atual, [conta.membroId]: [] }))
      }
      setFeedback({
        membroId: conta.membroId,
        tipo: 'status',
        mensagem: status === 'BLOQUEADA' ? 'Conta bloqueada e sessões revogadas.' : 'Conta desbloqueada.',
      })
      await carregar()
    } catch (error) {
      setFeedback({
        membroId: conta.membroId,
        tipo: 'alert',
        mensagem: error instanceof ApiError ? error.message : 'Não foi possível alterar a conta.',
      })
    } finally {
      setProcessando(null)
    }
  }


  const carregarSessoes = async (conta: ContaAdministrada) => {
    if (sessoesAbertasMembroId === conta.membroId) {
      setSessoesAbertasMembroId(null)
      return
    }

    setProcessando(conta.membroId)
    setFeedback(null)
    try {
      const sessoes = await fetchWithAuth<SessaoAdministrada[]>(
        `/admin/acessos/membros/${conta.membroId}/sessoes`
      )
      setSessoesPorMembro(atual => ({ ...atual, [conta.membroId]: sessoes }))
      setSessoesAbertasMembroId(conta.membroId)
    } catch (error) {
      setFeedback({
        membroId: conta.membroId,
        tipo: 'alert',
        mensagem: error instanceof ApiError ? error.message : 'Não foi possível carregar as sessões.',
      })
    } finally {
      setProcessando(null)
    }
  }

  const revogarSessao = async (conta: ContaAdministrada, sessao: SessaoAdministrada) => {
    if (!window.confirm(`Revogar esta sessão de ${conta.nome}?`)) return

    setProcessando(conta.membroId)
    setFeedback(null)
    try {
      await postWithAuth(
        `/admin/acessos/membros/${conta.membroId}/sessoes/${sessao.id}/revogar`,
        {}
      )
      setSessoesPorMembro(atual => ({
        ...atual,
        [conta.membroId]: (atual[conta.membroId] ?? []).filter(item => item.id !== sessao.id),
      }))
      setFeedback({
        membroId: conta.membroId,
        tipo: 'status',
        mensagem: 'Sessão revogada com sucesso.',
      })
    } catch (error) {
      setFeedback({
        membroId: conta.membroId,
        tipo: 'alert',
        mensagem: error instanceof ApiError ? error.message : 'Não foi possível revogar a sessão.',
      })
    } finally {
      setProcessando(null)
    }
  }

  const revogarSessoes = async (conta: ContaAdministrada) => {
    if (!window.confirm(`Revogar todas as sessões de ${conta.nome}?`)) return

    setProcessando(conta.membroId)
    setFeedback(null)
    try {
      await postWithAuth(`/admin/acessos/membros/${conta.membroId}/revogar-sessoes`, {})
      setSessoesPorMembro(atual => ({ ...atual, [conta.membroId]: [] }))
      setFeedback({
        membroId: conta.membroId,
        tipo: 'status',
        mensagem: 'Todas as sessões da conta foram revogadas.',
      })
    } catch (error) {
      setFeedback({
        membroId: conta.membroId,
        tipo: 'alert',
        mensagem: error instanceof ApiError ? error.message : 'Não foi possível revogar as sessões.',
      })
    } finally {
      setProcessando(null)
    }
  }

  const copiarLink = async (membroId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      setFeedback({
        membroId,
        tipo: 'alert',
        mensagem: 'Não foi possível copiar automaticamente. Selecione o link e copie manualmente.',
      })
    }
  }

  const abrirWhatsApp = (conta: ContaAdministrada, link: LinkTemporarioContextual) => {
    if (!conta.celular) {
      setFeedback({
        membroId: conta.membroId,
        tipo: 'alert',
        mensagem: 'Cadastre um celular antes de enviar o link pelo WhatsApp.',
      })
      return
    }

    const telefone = normalizarCelularWhatsApp(conta.celular)
    if (!telefone) {
      setFeedback({
        membroId: conta.membroId,
        tipo: 'alert',
        mensagem: 'O celular informado não é válido para envio pelo WhatsApp.',
      })
      return
    }

    const orientacao =
      link.tipo === 'ATIVACAO'
        ? 'Foi gerado um link individual para ativação da sua conta na Agenda Regional São Paulo. Acesse-o para criar seu PIN.'
        : 'Foi gerado um link individual para redefinição do seu PIN na Agenda Regional São Paulo.'

    const mensagem = [
      `Caro irmão ${conta.nome}.`,
      'A paz de Deus!',
      orientacao,
      link.url,
      `O link é válido até ${formatarExpiracao(link.expiraEm)} (horário de São Paulo).`,
      'Use-o apenas para a sua conta e não compartilhe este link com outras pessoas.',
    ].join('\n\n')

    const whatsappUrl = new URL('https://web.whatsapp.com/send')
    whatsappUrl.searchParams.set('phone', telefone)
    whatsappUrl.searchParams.set('text', mensagem)
    window.open(whatsappUrl.toString(), '_blank', 'noopener,noreferrer')
  }

  if (carregando) {
    return <div className="p-6 text-sm text-slate-600">Carregando contas...</div>
  }

  return (
    <section className="p-4 sm:p-6 space-y-5">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Contas e acessos</h2>
        <p className="mt-1 text-sm text-slate-600">
          Gere links individuais de ativação ou redefinição. Nunca compartilhe PINs ou links entre pessoas.
        </p>
      </header>

      {erroGlobal && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erroGlobal}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-3 block text-sm text-slate-700">
          <span className="mb-1 block font-medium">Buscar pessoa</span>
          <input
            type="search"
            aria-label="Buscar por nome, celular ou carteirinha"
            value={buscaFiltro}
            onChange={event => setBuscaFiltro(event.target.value)}
            placeholder="Nome, celular ou carteirinha"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium">Regional</span>
            <select
              aria-label="Filtrar por Regional"
              value={regionalFiltro}
              onChange={event => {
                setRegionalFiltro(event.target.value)
                setAdministracaoFiltro('')
                setSetorFiltro('')
                setCasaFiltro('')
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value="">Todas</option>
              {[...regionais].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(item => (
                <option key={item.id} value={item.id}>{item.nome}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium">Administração</span>
            <select
              aria-label="Filtrar por Administração"
              value={administracaoFiltro}
              onChange={event => {
                setAdministracaoFiltro(event.target.value)
                setSetorFiltro('')
                setCasaFiltro('')
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value="">Todas</option>
              {[...administracoesFiltradas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(item => (
                <option key={item.id} value={item.id}>{item.nome}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium">Setor</span>
            <select
              aria-label="Filtrar por Setor"
              value={setorFiltro}
              onChange={event => {
                setSetorFiltro(event.target.value)
                setCasaFiltro('')
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value="">Todos</option>
              {[...setoresFiltrados].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(item => (
                <option key={item.id} value={item.id}>{item.nome}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium">Casa de Oração</span>
            <select
              aria-label="Filtrar por Casa de Oração"
              value={casaFiltro}
              onChange={event => setCasaFiltro(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value="">Todas</option>
              {[...casasFiltradas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(item => (
                <option key={item.id} value={item.id}>{item.nome}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium">Perfil / acesso</span>
            <select
              aria-label="Filtrar por Perfil ou acesso"
              value={perfilFiltro}
              onChange={event => setPerfilFiltro(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="SEM_ACESSO">Sem perfil ativo</option>
              {perfisDisponiveis.map(perfil => (
                <option key={perfil} value={perfil}>{perfil}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium">Status</span>
            <select
              aria-label="Filtrar por Status"
              value={statusFiltro}
              onChange={event => setStatusFiltro(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="SEM_CONTA">Sem conta</option>
              <option value="PENDENTE_ATIVACAO">Pendente de ativação</option>
              <option value="ATIVA">Ativa</option>
              <option value="BLOQUEADA">Bloqueada</option>
              <option value="DESATIVADA">Desativada</option>
              <option value="RECUPERACAO_PIN">Recuperação de PIN pendente</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-600">
          <span>{contasFiltradas.length} de {contas.length} pessoa(s)</span>
          <button type="button" onClick={limparFiltros} className="font-medium text-brand-700 hover:underline">
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {[...contasExibidas]
          .sort((a, b) => Number(Boolean(b.recuperacaoPinPendente)) - Number(Boolean(a.recuperacaoPinPendente)))
          .map(conta => (
          <article key={conta.membroId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{conta.nome}</h3>
                <p className="text-sm text-slate-600">{conta.celular || 'Celular não informado'}</p>
                <p className="text-xs text-slate-500">
                  Carteirinha: {conta.codigoCarteirinha || 'não informada'} · Conta: {conta.status || 'sem conta'}
                </p>
                {conta.recuperacaoPinPendente && (
                  <p className="mt-2 inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                    Recuperação de PIN solicitada
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {!conta.contaAcessoId && (
                  <button
                    type="button"
                    disabled={processando === conta.membroId}
                    onClick={() => void gerarLink(conta, false)}
                    className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Gerar ativação
                  </button>
                )}
                {conta.contaAcessoId && (
                  <button
                    type="button"
                    disabled={processando === conta.membroId}
                    onClick={() => setGerenciandoMembroId(atual => atual === conta.membroId ? null : conta.membroId)}
                    className="rounded-lg border border-slate-400 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Gerenciar acessos
                  </button>
                )}
                {conta.contaAcessoId && conta.status !== 'BLOQUEADA' && conta.status !== 'DESATIVADA' && (
                  <button
                    type="button"
                    disabled={processando === conta.membroId}
                    onClick={() => void gerarLink(conta, true)}
                    className="rounded-lg border border-brand-700 px-3 py-2 text-xs font-semibold text-brand-700 disabled:opacity-50"
                  >
                    Redefinir PIN
                  </button>
                )}
                {conta.contaAcessoId && conta.status === 'ATIVA' && (
                  <>
                    {podeGerenciarSessoes && (
                      <>
                        <button
                          type="button"
                          disabled={processando === conta.membroId}
                          onClick={() => void carregarSessoes(conta)}
                          className="rounded-lg border border-slate-400 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                        >
                          {sessoesAbertasMembroId === conta.membroId ? 'Ocultar sessões' : 'Sessões ativas'}
                        </button>
                        <button
                          type="button"
                          disabled={processando === conta.membroId}
                          onClick={() => void revogarSessoes(conta)}
                          className="rounded-lg border border-slate-400 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                        >
                          Revogar todas
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={processando === conta.membroId}
                      onClick={() => void alterarStatus(conta, 'BLOQUEADA')}
                      className="rounded-lg border border-red-600 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                    >
                      Bloquear
                    </button>
                  </>
                )}
                {conta.contaAcessoId && conta.status === 'BLOQUEADA' && (
                  <button
                    type="button"
                    disabled={processando === conta.membroId}
                    onClick={() => void alterarStatus(conta, 'ATIVA')}
                    className="rounded-lg border border-emerald-600 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                  >
                    Desbloquear
                  </button>
                )}
              </div>
            </div>
            {podeGerenciarSessoes && conta.contaAcessoId && conta.status === 'ATIVA' && sessoesAbertasMembroId === conta.membroId && (
              <section className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3" aria-label={`Sessões ativas de ${conta.nome}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Sessões ativas</h4>
                    <p className="text-xs text-slate-500">
                      Dispositivo aproximado com base nas informações do navegador.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-1 text-xs text-slate-600">
                    {(sessoesPorMembro[conta.membroId] ?? []).length}
                  </span>
                </div>
                {(sessoesPorMembro[conta.membroId] ?? []).length === 0 ? (
                  <p className="text-sm text-slate-600">Nenhuma sessão ativa.</p>
                ) : (
                  <ul className="space-y-2">
                    {(sessoesPorMembro[conta.membroId] ?? []).map(sessao => (
                      <li key={sessao.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="text-xs text-slate-600">
                            <p className="font-semibold text-slate-800">
                              {sessao.dispositivo || 'Dispositivo não identificado'}
                            </p>
                            <p>Criada em: {formatarDataHora(sessao.criadoEm)}</p>
                            <p>
                              Último uso: {sessao.ultimoAcessoEm
                                ? formatarDataHora(sessao.ultimoAcessoEm)
                                : 'sem uso posterior ao login'}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={processando === conta.membroId}
                            onClick={() => void revogarSessao(conta, sessao)}
                            className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                          >
                            Revogar esta sessão
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            {(feedback?.membroId === conta.membroId || linkTemporario?.membroId === conta.membroId) && (
              <div
                id={`feedback-conta-${conta.membroId}`}
                tabIndex={-1}
                className="mt-3 space-y-3 outline-none focus:ring-2 focus:ring-brand-500"
              >
                {feedback?.membroId === conta.membroId && (
                  <div
                    role={feedback.tipo === 'alert' ? 'alert' : 'status'}
                    className={`rounded-lg border p-3 text-sm ${
                      feedback.tipo === 'alert'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {feedback.mensagem}
                  </div>
                )}

                {linkTemporario?.membroId === conta.membroId && (
                  <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <div className="space-y-3">
                      <p className="font-semibold">Link temporário gerado</p>
                      <p className="text-xs">
                        Copie agora e envie somente ao titular. O link é individual, temporário e de uso único.
                      </p>
                      <input
                        readOnly
                        value={linkTemporario.url}
                        aria-label={`Link temporário de ${conta.nome}`}
                        className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-slate-900"
                      />
                      <p className="text-xs">
                        Validade: {formatarExpiracao(linkTemporario.expiraEm)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void copiarLink(conta.membroId, linkTemporario.url)}
                          className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white"
                        >
                          Copiar link
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirWhatsApp(conta, linkTemporario)}
                          className="rounded-lg border border-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-700"
                        >
                          Enviar pelo WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => setLinkTemporario(null)}
                          className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-white"
                        >
                          Ocultar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {conta.acessos.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Perfis ativos">
                {conta.acessos.map(acesso => (
                  <li key={acesso.id} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    {acesso.perfilCodigo} · {acesso.escopoTipo}
                  </li>
                ))}
              </ul>
            )}
            {conta.contaAcessoId && gerenciandoMembroId === conta.membroId && (
              <GerenciarAcessosPanel
                contaAcessoId={conta.contaAcessoId}
                nomePessoa={conta.nome}
                acessos={conta.acessos}
                onAtualizado={carregar}
                onFechar={() => setGerenciandoMembroId(null)}
              />
            )}
          </article>
        ))}
        {contasFiltradas.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            {contas.length === 0
              ? 'Nenhuma pessoa disponível no seu escopo administrativo.'
              : 'Nenhuma conta corresponde aos filtros selecionados.'}
          </p>
        )}
      </div>
    </section>
  )
}
