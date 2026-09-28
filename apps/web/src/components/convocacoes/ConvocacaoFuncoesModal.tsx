import { useState, useEffect, useRef } from 'react'
import { fetchWithAuth, postWithAuth } from '../../api/apiClient'
import { ConvocacaoFuncaoCreate, ConvocacaoFuncaoCreatePayload } from '@piedade/shared'

interface Funcao {
  id: string
  nome: string
  codigo?: string | null
  descricao?: string | null
  ativo: boolean
}

interface ConvocacaoFuncao {
  id: string
  convocacaoId: string
  funcaoId: string
  createdAt: string
}

interface ConvocacaoFuncoesModalProps {
  convocacaoId: string
  onClose: () => void
}

export function ConvocacaoFuncoesModal({ convocacaoId, onClose }: ConvocacaoFuncoesModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' ? document.activeElement as HTMLElement | null : null
  )
  const [funcoesCatalogo, setFuncoesCatalogo] = useState<Funcao[]>([])
  const [funcoesVinculadas, setFuncoesVinculadas] = useState<ConvocacaoFuncao[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [funcaoSelecionadaId, setFuncaoSelecionadaId] = useState<string>('')

  const carregarDados = async () => {
    setLoading(true)
    setErro(null)
    try {
      const [catalogo, vinculadas] = await Promise.all([
        fetchWithAuth<Funcao[]>('/funcoes'),
        fetchWithAuth<ConvocacaoFuncao[]>(`/convocacoes/${convocacaoId}/funcoes`)
      ])
      setFuncoesCatalogo(catalogo || [])
      setFuncoesVinculadas(vinculadas || [])
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErro(err.message)
      } else {
        setErro('Erro ao carregar funções')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [convocacaoId])

  useEffect(() => {
    closeButtonRef.current?.focus()
    return () => triggerRef.current?.focus()
  }, [])

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !salvando) {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return

    const focusaveis = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    )
    if (focusaveis.length === 0) return

    const primeiro = focusaveis[0]
    const ultimo = focusaveis[focusaveis.length - 1]
    if (event.shiftKey && document.activeElement === primeiro) {
      event.preventDefault()
      ultimo.focus()
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault()
      primeiro.focus()
    }
  }

  const recarregarVinculadas = async () => {
    try {
      const vinculadas = await fetchWithAuth<ConvocacaoFuncao[]>(`/convocacoes/${convocacaoId}/funcoes`)
      setFuncoesVinculadas(vinculadas || [])
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErro(err.message)
      } else {
        setErro('Erro ao recarregar funções')
      }
    }
  }

  const handleAdicionar = async () => {
    if (!funcaoSelecionadaId) return
    setErro(null)
    const payload: ConvocacaoFuncaoCreatePayload = { funcaoId: funcaoSelecionadaId }
    
    const validacao = ConvocacaoFuncaoCreate.safeParse(payload)
    if (!validacao.success) {
      setErro('Função selecionada inválida.')
      return
    }

    setSalvando(true)
    try {
      await postWithAuth(`/convocacoes/${convocacaoId}/funcoes`, payload)
      setFuncaoSelecionadaId('')
      await recarregarVinculadas()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErro(err.message)
      } else {
        setErro('Erro ao adicionar função')
      }
    } finally {
      setSalvando(false)
    }
  }

  const handleRemover = async (funcaoId: string) => {
    setErro(null)
    setSalvando(true)
    try {
      await fetchWithAuth(`/convocacoes/${convocacaoId}/funcoes/${funcaoId}`, { method: 'DELETE' })
      await recarregarVinculadas()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErro(err.message)
      } else {
        setErro('Erro ao remover função')
      }
    } finally {
      setSalvando(false)
    }
  }

  const funcoesDisponiveis = funcoesCatalogo.filter(
    (f) => !funcoesVinculadas.some((v) => v.funcaoId === f.id) && f.ativo
  )

  const getNomeFuncao = (id: string) => {
    const f = funcoesCatalogo.find((func) => func.id === id)
    return f ? f.nome : 'Função desconhecida'
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-funcoes-title"
      onKeyDown={handleDialogKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h2 id="modal-funcoes-title" className="text-xl font-bold text-slate-900">
            Gerenciar Funções do Rascunho
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            disabled={salvando}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {erro && (
            <div role="alert" className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 text-sm">
              {erro}
            </div>
          )}

          {loading ? (
            <div className="text-center p-4 text-slate-500">Carregando funções...</div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">Funções Vinculadas</h3>
                {funcoesVinculadas.length === 0 ? (
                  <p className="text-sm text-slate-500 italic p-3 bg-slate-50 rounded border border-slate-100">
                    Nenhuma função vinculada.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {funcoesVinculadas.map((vinculo) => (
                      <li key={vinculo.id} className="p-3 flex justify-between items-center bg-white hover:bg-slate-50">
                        <span className="text-sm font-medium text-slate-800">
                          {getNomeFuncao(vinculo.funcaoId)}
                        </span>
                        <button
                          onClick={() => handleRemover(vinculo.funcaoId)}
                          disabled={salvando}
                          className="text-red-600 hover:text-red-800 text-xs font-semibold px-2 py-1 rounded bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Adicionar Função</h3>
                {funcoesDisponiveis.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">
                    Nenhuma função disponível para adicionar.
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <label htmlFor="funcao-convocacao" className="sr-only">Função para adicionar</label>
                    <select
                      id="funcao-convocacao"
                      aria-label="Função para adicionar"
                      value={funcaoSelecionadaId}
                      onChange={(e) => setFuncaoSelecionadaId(e.target.value)}
                      disabled={salvando}
                      className="flex-1 p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="">Selecione uma função...</option>
                      {funcoesDisponiveis.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAdicionar}
                      disabled={!funcaoSelecionadaId || salvando}
                      className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      Adicionar
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
