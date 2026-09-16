import type { ReactNode } from 'react'

export interface CapacidadesFrontend {
  podeVisualizarRelatorios?: boolean
  podeVisualizarAuditoria?: boolean
  podeOperarPortaria?: boolean
}

interface MainLayoutProps {
  children: ReactNode
  currentTab: 'agenda' | 'calendario' | 'avisos' | 'cadastro' | 'portaria' | 'relatorios' | 'auditoria' | 'regionais' | 'administracoes' | 'setores' | 'casas' | 'grupos-trabalho' | 'membros'
  onTabChange: (tab: 'agenda' | 'calendario' | 'avisos' | 'cadastro' | 'portaria' | 'relatorios' | 'auditoria' | 'regionais' | 'administracoes' | 'setores' | 'casas' | 'grupos-trabalho' | 'membros') => void
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
            onClick={() => onTabChange('regionais')}
            className={`flex flex-col items-center flex-1 p-2 rounded-lg transition-colors ${currentTab === 'regionais' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V9a2 2 0 012-2h2a2 2 0 012 2v12" /></svg>
            <span className="text-[10px] font-medium">Regionais</span>
          </button>

          <button
            onClick={() => onTabChange('administracoes')}
            className={`flex flex-col items-center flex-1 p-2 rounded-lg transition-colors ${currentTab === 'administracoes' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V9a2 2 0 012-2h2a2 2 0 012 2v12" /></svg>
            <span className="text-[10px] font-medium">Administrações</span>
          </button>

          <button
            onClick={() => onTabChange('setores')}
            className={`flex flex-col items-center flex-1 p-2 rounded-lg transition-colors ${currentTab === 'setores' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V9a2 2 0 012-2h2a2 2 0 012 2v12" /></svg>
            <span className="text-[10px] font-medium">Setores</span>
          </button>

          <button
            onClick={() => onTabChange('casas')}
            className={`flex flex-col items-center flex-1 p-2 rounded-lg transition-colors ${currentTab === 'casas' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span className="text-[10px] font-medium">Casas</span>
          </button>

          <button
            onClick={() => onTabChange('grupos-trabalho')}
            className={`flex flex-col items-center flex-1 p-2 rounded-lg transition-colors ${currentTab === 'grupos-trabalho' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            <span className="text-[10px] font-medium">GTs</span>
          </button>

          <button
            onClick={() => onTabChange('membros')}
            className={`flex flex-col items-center flex-1 p-2 rounded-lg transition-colors ${currentTab === 'membros' ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            <span className="text-[10px] font-medium">Membros</span>
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
