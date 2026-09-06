import { useState } from 'react'
import { MainLayout } from './components/layout/MainLayout'
import { AgendaView } from './components/agenda/AgendaView'
import { CalendarioView } from './components/calendario/CalendarioView'

function App() {
  const [currentTab, setCurrentTab] = useState<'agenda' | 'calendario' | 'avisos' | 'cadastro'>('agenda')

  return (
    <MainLayout currentTab={currentTab} onTabChange={setCurrentTab}>
      {currentTab === 'agenda' && <AgendaView />}
      {currentTab === 'calendario' && <CalendarioView />}
      
      {currentTab === 'avisos' && (
        <div className="p-8 text-center text-slate-500">
          <p>Módulo de Avisos em desenvolvimento.</p>
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
