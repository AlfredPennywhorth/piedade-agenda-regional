import { useRef, useState, type ReactNode } from 'react'

export interface CapacidadesFrontend {
  podeVisualizarRelatorios?: boolean
  podeVisualizarAuditoria?: boolean
  podeOperarPortaria?: boolean
  podeAdministrarAcessos?: boolean
}

interface MainLayoutProps {
  children: ReactNode
  currentTab: 'agenda' | 'eventos' | 'series' | 'calendario' | 'avisos' | 'cadastro' | 'portaria' | 'relatorios' | 'auditoria' | 'regionais' | 'administracoes' | 'setores' | 'casas' | 'grupos-trabalho' | 'membros' | 'funcoes' | 'vinculos-funcionais' | 'locais' | 'convocacoes' | 'acessos'
  onTabChange: (tab: 'agenda' | 'eventos' | 'series' | 'calendario' | 'avisos' | 'cadastro' | 'portaria' | 'relatorios' | 'auditoria' | 'regionais' | 'administracoes' | 'setores' | 'casas' | 'grupos-trabalho' | 'membros' | 'funcoes' | 'vinculos-funcionais' | 'locais' | 'convocacoes' | 'acessos') => void
  capacidades?: CapacidadesFrontend
  nomeUsuario?: string
  onLogout?: () => void | Promise<void>
}

export function MainLayout({ children, currentTab, onTabChange, capacidades, nomeUsuario, onLogout }: MainLayoutProps) {
  const mostrarPortaria = capacidades?.podeOperarPortaria === true
  const mostrarRelatorios = capacidades?.podeVisualizarRelatorios === true
  const mostrarAuditoria = capacidades?.podeVisualizarAuditoria === true
  const mostrarAdministracaoAcessos = capacidades?.podeAdministrarAcessos === true
  const [mostrarMais, setMostrarMais] = useState(false)
  const botaoMaisRef = useRef<HTMLButtonElement>(null)

  const maisAtivo = mostrarMais || !['agenda', 'eventos', 'calendario', 'convocacoes'].includes(currentTab)

  const fecharMais = () => {
    setMostrarMais(false)
    botaoMaisRef.current?.focus()
  }

  const navegar = (tab: MainLayoutProps['currentTab']) => {
    onTabChange(tab)
    if (mostrarMais) fecharMais()
  }

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
      {/* Header */}
      <header className="bg-brand-900 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Agenda Regional SP</h1>
            {nomeUsuario && <p className="text-xs text-brand-100">{nomeUsuario}</p>}
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={() => void onLogout()}
              className="rounded-lg border border-white/30 px-3 py-2 text-xs font-semibold hover:bg-white/10"
            >
              Sair
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-2xl mx-auto overflow-y-auto">
        {children}
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
                  <button onClick={() => navegar('series')} className="rounded-lg bg-slate-50 p-3 text-left">Séries</button>
                  {mostrarRelatorios && <button onClick={() => navegar('relatorios')} className="rounded-lg bg-slate-50 p-3 text-left">Relatórios</button>}
                  <button onClick={() => navegar('avisos')} className="rounded-lg bg-slate-50 p-3 text-left">Avisos</button>
                  {mostrarPortaria && <button onClick={() => navegar('portaria')} className="rounded-lg bg-slate-50 p-3 text-left">Portaria</button>}
                  {mostrarAuditoria && <button onClick={() => navegar('auditoria')} className="rounded-lg bg-slate-50 p-3 text-left">Auditoria</button>}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Administração</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => navegar('regionais')} className="rounded-lg bg-slate-50 p-3 text-left">Regionais</button>
                  <button onClick={() => navegar('administracoes')} className="rounded-lg bg-slate-50 p-3 text-left">Administrações</button>
                  <button onClick={() => navegar('setores')} className="rounded-lg bg-slate-50 p-3 text-left">Setores</button>
                  <button onClick={() => navegar('casas')} className="rounded-lg bg-slate-50 p-3 text-left">Casas</button>
                  <button onClick={() => navegar('grupos-trabalho')} className="rounded-lg bg-slate-50 p-3 text-left">Grupos de Trabalho</button>
                  <button onClick={() => navegar('locais')} className="rounded-lg bg-slate-50 p-3 text-left">Locais</button>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Pessoas e acessos</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => navegar('membros')} className="rounded-lg bg-slate-50 p-3 text-left">Membros</button>
                  <button onClick={() => navegar('funcoes')} className="rounded-lg bg-slate-50 p-3 text-left">Funções</button>
                  <button onClick={() => navegar('vinculos-funcionais')} className="rounded-lg bg-slate-50 p-3 text-left">Vínculos</button>
                  {mostrarAdministracaoAcessos && <button onClick={() => navegar('acessos')} className="rounded-lg bg-slate-50 p-3 text-left">Acessos</button>}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Conta</h3>
                <button onClick={() => navegar('cadastro')} className="w-full rounded-lg bg-slate-50 p-3 text-left">Meu Cadastro</button>
              </div>
            </div>
          </section>
        </div>
      )}

      <nav aria-label="Navegação móvel principal" className="bg-white border-t border-slate-200 fixed bottom-0 w-full z-30 safe-area-bottom">
        <div className="mx-auto grid max-w-2xl grid-cols-5 items-stretch">
          <button onClick={() => navegar('agenda')} className={`flex flex-col items-center p-2 text-[10px] ${currentTab === 'agenda' ? 'text-brand-600' : 'text-slate-400'}`}>
            <span className="text-base">☰</span><span>Minha Agenda</span>
          </button>
          <button onClick={() => navegar('eventos')} className={`flex flex-col items-center p-2 text-[10px] ${currentTab === 'eventos' ? 'text-brand-600' : 'text-slate-400'}`}>
            <span className="text-base">▣</span><span>Eventos</span>
          </button>
          <button onClick={() => navegar('calendario')} className={`flex flex-col items-center p-2 text-[10px] ${currentTab === 'calendario' ? 'text-brand-600' : 'text-slate-400'}`}>
            <span className="text-base">□</span><span>Calendário</span>
          </button>
          <button onClick={() => navegar('convocacoes')} className={`flex flex-col items-center p-2 text-[10px] ${currentTab === 'convocacoes' ? 'text-brand-600' : 'text-slate-400'}`}>
            <span className="text-base">♧</span><span>Convocações</span>
          </button>
          <button ref={botaoMaisRef} onClick={() => setMostrarMais(true)} className={`flex flex-col items-center p-2 text-[10px] ${maisAtivo ? 'text-brand-600' : 'text-slate-400'}`}>
            <span className="text-base">•••</span><span>Mais</span>
          </button>
        </div>
      </nav>

    </div>
  )
}