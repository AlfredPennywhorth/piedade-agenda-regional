import { useState } from 'react'
import { MainLayout } from './components/layout/MainLayout'
import { AgendaView } from './components/agenda/AgendaView'
import { CalendarioView } from './components/calendario/CalendarioView'
import { NotificacoesControl } from './components/notificacoes/NotificacoesControl'

function App() {
  const [currentTab, setCurrentTab] = useState<'agenda' | 'calendario' | 'avisos' | 'cadastro'>('agenda')

  return (
    <MainLayout currentTab={currentTab} onTabChange={setCurrentTab}>
      {currentTab === 'agenda' && <AgendaView />}
      {currentTab === 'calendario' && <CalendarioView />}
      
      {currentTab === 'avisos' && (
        <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <NotificacoesControl />
          <div className="text-center text-slate-500 mt-8">
            <p>Módulo de Avisos em desenvolvimento.</p>
          </div>
        </div>
      )}
      
      {currentTab === 'cadastro' && (
        <div className="p-8 text-center text-slate-500">
          <p>Módulo de Perfil em desenvolvimento.</p>
        </div>
      )}
    </MainLayout>
  )
}

export default App
