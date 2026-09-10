import type { ReactNode } from 'react'

export interface CapacidadesFrontend {
  podeVisualizarRelatorios?: boolean
  podeVisualizarAuditoria?: boolean
  podeOperarPortaria?: boolean
}

interface MainLayoutProps {
  children: ReactNode
  currentTab: 'agenda' | 'calendario' | 'avisos' | 'cadastro' | 'portaria' | 'relatorios' | 'auditoria'
  onTabChange: (tab: 'agenda' | 'calendario' | 'avisos' | 'cadastro' | 'portaria' | 'relatorios' | 'auditoria') => void
  capacidades?: CapacidadesFrontend
}

export function MainLayout({ children, currentTab, onTabChange, capacidades }: MainLayoutProps) {
  const mostrarPortaria = capacidades?.podeOperarPortaria === true
  const mostrarRelatorios = capacidades?.podeVisualizarRelatorios === true
  const mostrarAuditoria = capacidades?.podeVisualizarAuditoria === true

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-16">
      {/* Header */}
      <header className="bg-brand-900 text-white p-4 shadow-md sticky top-0 z-10 flex justify-center items-center">
        <h1 className="text-xl font-semibold">Agenda Regional SP</h1>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-2xl mx-auto overflow-y-auto">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-slate-200 fixed bottom-0 w-full z-10 safe-area-bottom">
        <div className="max-w-2xl mx-auto flex justify-between items-center px-2 py-2">
          
          <button 
            onClick={() => onTabChange('agenda')} 
            className={`flex flex-col items-center flex-1 p-2 rounded-lg transition-colors ${currentTab === 'agenda' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            <span className="text-[10px] font-medium">Minha Agenda</span>
          </button>

          <button 
            onClick={() => onTabChange('calendario')} 
            className={`flex flex-col items-center flex-1 p-2 rounded-lg transition-colors ${currentTab === 'calendario' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span className="text-[10px] font-medium">Calendário</span>
          </button>

          {mostrarPortaria && (
            <button
              onClick={() => onTabChange('portaria')}
              className={`flex flex-col items-center flex-1 p-2 rounded-lg transition-colors ${currentTab === 'portaria' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              <span className="text-[10px] font-medium">Portaria</span>
            </button>
          )}

          {mostrarRelatorios && (
            <button
              onClick={() => onTabChange('relatorios')}
              className={`flex flex-col items-center flex-1 p-2 rounded-lg transition-colors ${currentTab === 'relatorios' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              <span className="text-[10px] font-medium">Relatórios</span>
            </button>
          )}

          {mostrarAuditoria && (
            <button
              onClick={() => onTabChange('auditoria')}
              className={`flex flex-col items-center flex-1 p-2 rounded-lg transition-colors ${currentTab === 'auditoria' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span className="text-[10px] font-medium">Auditoria</span>
            </button>
          )}

          <button
            onClick={() => onTabChange('avisos')}
            className={`flex flex-col items-center flex-1 p-2 rounded-lg transition-colors ${currentTab === 'avisos' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            <span className="text-[10px] font-medium">Avisos</span>
          </button>

          <button
            onClick={() => onTabChange('cadastro')}
            className={`flex flex-col items-center flex-1 p-2 rounded-lg transition-colors ${currentTab === 'cadastro' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span className="text-[10px] font-medium">Meu Cadastro</span>
          </button>

        </div>
      </nav>
    </div>
  )
}
