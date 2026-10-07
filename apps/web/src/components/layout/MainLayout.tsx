import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface CapacidadesFrontend {
  podeVisualizarRelatorios?: boolean
  podeVisualizarAuditoria?: boolean
  podeOperarPortaria?: boolean
  podeAdministrarAcessos?: boolean
  podeGerenciarSessoes?: boolean
  podeAdministrarRegionais?: boolean
  podeAdministrarEstrutura?: boolean
  podeAdministrarPessoas?: boolean
  podeAdministrarFuncoes?: boolean
  podeGerirAgenda?: boolean
}

const SCREEN_CODES = {
  agenda: 'AGD-MOB-001',
  eventos: 'AGD-ADM-001',
  series: 'AGD-ADM-002',
  calendario: 'AGD-MOB-002',
  avisos: 'AGD-SHR-001',
  cadastro: 'AGD-MOB-003',
  portaria: 'AGD-SHR-002',
  relatorios: 'AGD-ADM-003',
  auditoria: 'AGD-ADM-004',
  regionais: 'AGD-ADM-005',
  administracoes: 'AGD-ADM-006',
  setores: 'AGD-ADM-007',
  casas: 'AGD-ADM-008',
  'grupos-trabalho': 'AGD-ADM-009',
  membros: 'AGD-ADM-010',
  funcoes: 'AGD-ADM-011',
  'vinculos-funcionais': 'AGD-ADM-012',
  locais: 'AGD-ADM-013',
  convocacoes: 'AGD-ADM-014',
  acessos: 'AGD-ADM-015',
} as const

interface MainLayoutProps {
  children: ReactNode
  currentTab: 'agenda' | 'eventos' | 'series' | 'calendario' | 'avisos' | 'cadastro' | 'portaria' | 'relatorios' | 'auditoria' | 'regionais' | 'administracoes' | 'setores' | 'casas' | 'grupos-trabalho' | 'membros' | 'funcoes' | 'vinculos-funcionais' | 'locais' | 'convocacoes' | 'acessos'
  onTabChange: (tab: 'agenda' | 'eventos' | 'series' | 'calendario' | 'avisos' | 'cadastro' | 'portaria' | 'relatorios' | 'auditoria' | 'regionais' | 'administracoes' | 'setores' | 'casas' | 'grupos-trabalho' | 'membros' | 'funcoes' | 'vinculos-funcionais' | 'locais' | 'convocacoes' | 'acessos') => void
  capacidades?: CapacidadesFrontend
  nomeUsuario?: string
  onLogout?: () => void | Promise<void>
  recuperacoesPinPendentes?: number
}

export function MainLayout({ children, currentTab, onTabChange, capacidades, nomeUsuario, onLogout, recuperacoesPinPendentes = 0 }: MainLayoutProps) {
  const mostrarPortaria =
    capacidades?.podeOperarPortaria === true || capacidades?.podeGerirAgenda === true
  const mostrarRelatorios = capacidades?.podeVisualizarRelatorios === true
  const mostrarAuditoria = capacidades?.podeVisualizarAuditoria === true
  const mostrarAdministracaoAcessos = capacidades?.podeAdministrarAcessos === true
  const mostrarEstrutura = capacidades?.podeAdministrarEstrutura === true
  const mostrarPessoas = capacidades?.podeAdministrarPessoas === true
  const mostrarFuncoes = capacidades?.podeAdministrarFuncoes === true
  const mostrarGestaoAgenda = capacidades?.podeGerirAgenda === true
  const [mostrarMais, setMostrarMais] = useState(false)
  const botaoMaisRef = useRef<HTMLButtonElement>(null)
  const conteudoPrincipalRef = useRef<HTMLElement>(null)
  const abaAnteriorRef = useRef(currentTab)

  const maisAtivo = mostrarMais || !['agenda', 'eventos', 'calendario', 'convocacoes'].includes(currentTab)

  const fecharMais = () => {
    setMostrarMais(false)
    botaoMaisRef.current?.focus()
  }

  const navegar = (tab: MainLayoutProps['currentTab']) => {
    onTabChange(tab)
    if (mostrarMais) fecharMais()
  }

  useEffect(() => {
    if (abaAnteriorRef.current !== currentTab) {
      conteudoPrincipalRef.current?.focus()
      abaAnteriorRef.current = currentTab
    }
  }, [currentTab])

  const conterFocoNoMais = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      fecharMais()
      return
    }
    if (event.key !== 'Tab') return

    const foco = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (!foco.length) return
    const primeiro = foco[0]
    const ultimo = foco[foco.length - 1]

    if (event.shiftKey && document.activeElement === primeiro) {
      event.preventDefault()
      ultimo.focus()
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault()
      primeiro.focus()
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-16">
      <a
        href="#conteudo-principal"
        className="sr-only z-50 rounded-md bg-white px-3 py-2 text-sm font-semibold text-brand-800 shadow focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Ir para o conteúdo principal
      </a>
      {/* Header */}
      <header className="bg-brand-900 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt=""
              aria-hidden="true"
              className="h-10 w-10 shrink-0 rounded-xl shadow-sm ring-1 ring-white/15 sm:h-11 sm:w-11"
            />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold sm:text-xl">Agenda Regional SP</h1>
              {nomeUsuario && <p className="truncate text-xs text-brand-100">{nomeUsuario}</p>}
            </div>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={() => void onLogout()}
              className="shrink-0 rounded-lg border border-white/30 px-3 py-2 text-xs font-semibold hover:bg-white/10"
            >
              Sair
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main
        id="conteudo-principal"
        ref={conteudoPrincipalRef}
        tabIndex={-1}
        aria-label="Conteúdo principal"
        className="flex-1 w-full max-w-2xl mx-auto overflow-y-auto focus:outline-none"
      >
        {mostrarAdministracaoAcessos && recuperacoesPinPendentes > 0 && currentTab !== 'acessos' && (
          <div className="m-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm" role="status">
            <p className="font-semibold">
              {recuperacoesPinPendentes === 1
                ? 'Há 1 solicitação de redefinição de PIN pendente.'
                : `Há ${recuperacoesPinPendentes} solicitações de redefinição de PIN pendentes.`}
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Acesse Contas e acessos para tratar a solicitação.
            </p>
            <button
              type="button"
              onClick={() => navegar('acessos')}
              className="mt-3 rounded-lg bg-amber-900 px-3 py-2 text-sm font-semibold text-white"
            >
              Ver solicitações
            </button>
          </div>
        )}
        {children}
        <div
          className="px-4 pb-4 pt-2 text-right text-[10px] font-medium tracking-wide text-slate-400"
          data-screen-code={SCREEN_CODES[currentTab]}
          aria-label={`Código da tela ${SCREEN_CODES[currentTab]}`}
        >
          Tela {SCREEN_CODES[currentTab]}
        </div>
      </main>

      {/* Navegação principal única */}
      {mostrarMais && (
        <div className="fixed inset-0 z-20 bg-slate-900/40" onClick={fecharMais}>
          <section
            className="absolute bottom-16 left-0 right-0 mx-auto max-h-[72vh] max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Mais opções"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={conterFocoNoMais}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Mais opções</h2>
                <p className="text-xs text-slate-500">Acesse os demais módulos do sistema.</p>
              </div>
              <button
                ref={(element) => element?.focus()}
                type="button"
                onClick={fecharMais}
                className="p-2 text-slate-500"
                aria-label="Fechar menu"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 text-sm">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Agenda e gestão</h3>
                <div className="grid grid-cols-2 gap-2">
                  {mostrarGestaoAgenda && <button type="button" onClick={() => navegar('series')} className="rounded-lg bg-slate-50 p-3 text-left">Séries</button>}
                  {mostrarRelatorios && <button type="button" onClick={() => navegar('relatorios')} className="rounded-lg bg-slate-50 p-3 text-left">Relatórios</button>}
                  <button type="button" onClick={() => navegar('avisos')} className="rounded-lg bg-slate-50 p-3 text-left">Avisos</button>
                  {mostrarPortaria && <button type="button" onClick={() => navegar('portaria')} className="rounded-lg bg-slate-50 p-3 text-left">Portaria</button>}
                  {mostrarAuditoria && <button type="button" onClick={() => navegar('auditoria')} className="rounded-lg bg-slate-50 p-3 text-left">Auditoria</button>}
                </div>
              </div>

              {(mostrarEstrutura || mostrarGestaoAgenda) && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Administração</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {mostrarEstrutura && <button type="button" onClick={() => navegar('regionais')} className="rounded-lg bg-slate-50 p-3 text-left">Regionais</button>}
                    {mostrarEstrutura && <button type="button" onClick={() => navegar('administracoes')} className="rounded-lg bg-slate-50 p-3 text-left">Administrações</button>}
                    {mostrarEstrutura && <button type="button" onClick={() => navegar('setores')} className="rounded-lg bg-slate-50 p-3 text-left">Setores</button>}
                    {mostrarEstrutura && <button type="button" onClick={() => navegar('casas')} className="rounded-lg bg-slate-50 p-3 text-left">Casas</button>}
                    {mostrarEstrutura && <button type="button" onClick={() => navegar('grupos-trabalho')} className="rounded-lg bg-slate-50 p-3 text-left">Grupos de Trabalho</button>}
                    {mostrarGestaoAgenda && <button type="button" onClick={() => navegar('locais')} className="rounded-lg bg-slate-50 p-3 text-left">Locais</button>}
                  </div>
                </div>
              )}

              {(mostrarPessoas || mostrarFuncoes || mostrarAdministracaoAcessos) && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Pessoas e acessos</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {mostrarPessoas && <button type="button" onClick={() => navegar('membros')} className="rounded-lg bg-slate-50 p-3 text-left">Membros</button>}
                    {mostrarFuncoes && <button type="button" onClick={() => navegar('funcoes')} className="rounded-lg bg-slate-50 p-3 text-left">Funções</button>}
                    {mostrarPessoas && <button type="button" onClick={() => navegar('vinculos-funcionais')} className="rounded-lg bg-slate-50 p-3 text-left">Vínculos</button>}
                    {mostrarAdministracaoAcessos && <button type="button" onClick={() => navegar('acessos')} className="rounded-lg bg-slate-50 p-3 text-left">Acessos</button>}
                  </div>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Conta</h3>
                <button type="button" onClick={() => navegar('cadastro')} className="w-full rounded-lg bg-slate-50 p-3 text-left">Meu Cadastro</button>
              </div>
            </div>
          </section>
        </div>
      )}

      <nav aria-label="Navegação móvel principal" className="bg-white border-t border-slate-200 fixed bottom-0 w-full z-30 safe-area-bottom">
        <div className="mx-auto grid max-w-2xl grid-cols-5 items-stretch">
          <button type="button" aria-current={currentTab === 'agenda' ? 'page' : undefined} onClick={() => navegar('agenda')} className={`flex flex-col items-center p-2 text-[10px] ${currentTab === 'agenda' ? 'text-brand-600' : 'text-slate-400'}`}>
            <span className="text-base">☰</span><span>Minha Agenda</span>
          </button>
          {mostrarGestaoAgenda ? (
            <button type="button" aria-current={currentTab === 'eventos' ? 'page' : undefined} onClick={() => navegar('eventos')} className={`flex flex-col items-center p-2 text-[10px] ${currentTab === 'eventos' ? 'text-brand-600' : 'text-slate-400'}`}>
              <span className="text-base">▣</span><span>Eventos</span>
            </button>
          ) : <div />}
          <button type="button" aria-current={currentTab === 'calendario' ? 'page' : undefined} onClick={() => navegar('calendario')} className={`flex flex-col items-center p-2 text-[10px] ${currentTab === 'calendario' ? 'text-brand-600' : 'text-slate-400'}`}>
            <span className="text-base">□</span><span>Calendário</span>
          </button>
          {mostrarGestaoAgenda ? (
            <button type="button" aria-current={currentTab === 'convocacoes' ? 'page' : undefined} onClick={() => navegar('convocacoes')} className={`flex flex-col items-center p-2 text-[10px] ${currentTab === 'convocacoes' ? 'text-brand-600' : 'text-slate-400'}`}>
              <span className="text-base">♧</span><span>Convocações</span>
            </button>
          ) : <div />}
          <button
            type="button"
            ref={botaoMaisRef}
            aria-current={maisAtivo ? 'page' : undefined}
            aria-expanded={mostrarMais}
            aria-haspopup="dialog"
            onClick={() => setMostrarMais(true)}
            className={`flex flex-col items-center p-2 text-[10px] ${maisAtivo ? 'text-brand-600' : 'text-slate-400'}`}
          >
            <span className="text-base">•••</span><span>Mais</span>
          </button>
        </div>
      </nav>

    </div>
  )
}