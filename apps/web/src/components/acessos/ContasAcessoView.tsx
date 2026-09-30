import { useEffect, useState } from 'react'
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
  contaAcessoId: string | null
  status: string | null
  ativadoEm: string | null
  recuperacaoPinPendente?: boolean
  recuperacaoPinSolicitadaEm?: string | null
  acessos: Acesso[]
}

interface LinkTemporario {
  token: string
  expiraEm: string
  membroId: string
}

interface FeedbackConta {
  membroId: string
  tipo: 'status' | 'alert'
  mensagem?: string
  linkTemporario?: string
}

function montarLink(token: string) {
  const url = new URL(window.location.origin + window.location.pathname)
  url.searchParams.set('ativacao', token)
  return url.toString()
}

export function ContasAcessoView() {
  const [contas, setContas] = useState<ContaAdministrada[]>([])
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)
  const [erroGlobal, setErroGlobal] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<FeedbackConta | null>(null)
  const [gerenciandoMembroId, setGerenciandoMembroId] = useState<string | null>(null)

  const carregar = async () => {
    setErroGlobal(null)
    try {
      setContas(await fetchWithAuth<ContaAdministrada[]>('/admin/acessos'))
    } catch (error) {
      setErroGlobal(error instanceof ApiError ? error.message : 'Não foi possível carregar as contas.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  useEffect(() => {
    if (!feedback) return
    const elemento = document.getElementById(`feedback-conta-${feedback.membroId}`)
    elemento?.scrollIntoView?.({ block: 'nearest' })
    elemento?.focus()
  }, [feedback])

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
      setFeedback({
        membroId: conta.membroId,
        tipo: 'status',
        linkTemporario: montarLink(resposta.token),
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

  const revogarSessoes = async (conta: ContaAdministrada) => {
    if (!window.confirm(`Revogar todas as sessões de ${conta.nome}?`)) return

    setProcessando(conta.membroId)
    setFeedback(null)
    try {
      await postWithAuth(`/admin/acessos/membros/${conta.membroId}/revogar-sessoes`, {})
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

  const copiarLink = async (membroId: string, linkTemporario: string) => {
    try {
      await navigator.clipboard.writeText(linkTemporario)
    } catch {
      setFeedback({
        membroId,
        tipo: 'alert',
        mensagem: 'Não foi possível copiar automaticamente. Selecione o link e copie manualmente.',
        linkTemporario,
      })
    }
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

      <div className="space-y-3">
        {contas.map(conta => (
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
                    <button
                      type="button"
                      disabled={processando === conta.membroId}
                      onClick={() => void revogarSessoes(conta)}
                      className="rounded-lg border border-slate-400 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    >
                      Revogar sessões
                    </button>
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
            {feedback?.membroId === conta.membroId && (
              <div
                id={`feedback-conta-${conta.membroId}`}
                tabIndex={-1}
                role={feedback.tipo === 'alert' ? 'alert' : 'status'}
                className={`mt-3 rounded-lg border p-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${ 
                  feedback.tipo === 'alert'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : feedback.linkTemporario
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}
              >
                {feedback.mensagem && <p>{feedback.mensagem}</p>}
                {feedback.linkTemporario && (
                  <div className="space-y-3">
                    <p className="font-semibold">Link temporário gerado</p>
                    <p className="text-xs">
                      Copie agora e envie somente ao titular. O link é individual, temporário e de uso único.
                    </p>
                    <input
                      readOnly
                      value={feedback.linkTemporario}
                      aria-label={`Link temporário de ${conta.nome}`}
                      className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-slate-900"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void copiarLink(conta.membroId, feedback.linkTemporario!)}
                        className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white"
                      >
                        Copiar link
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedback(null)}
                        className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-white"
                      >
                        Ocultar
                      </button>
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
        {contas.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Nenhuma pessoa disponível no seu escopo administrativo.
          </p>
        )}
      </div>
    </section>
  )
}
