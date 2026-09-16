import { useState, useEffect } from 'react'
import { MainLayout, CapacidadesFrontend } from './components/layout/MainLayout'
import { AgendaView } from './components/agenda/AgendaView'
import { EventosView } from './components/eventos/EventosView'
import { CalendarioView } from './components/calendario/CalendarioView'
import { NotificacoesControl } from './components/notificacoes/NotificacoesControl'
import { PortariaView } from './components/portaria/PortariaView'
import { RelatoriosView } from './components/relatorios/RelatoriosView'
import { AuditoriaView } from './components/auditoria/AuditoriaView'
import { RegionaisView } from './components/regionais/RegionaisView'
import { AdministracoesView } from './components/administracoes/AdministracoesView'
import { SetoresView } from './components/setores/SetoresView'
import { CasasView } from './components/casas/CasasView'
import { GruposTrabalhoView } from './components/grupos-trabalho/GruposTrabalhoView'
import { MembrosView } from './components/membros/MembrosView'
import { FuncoesView } from './components/funcoes/FuncoesView'
import { VinculosFuncionaisView } from './components/vinculos-funcionais/VinculosFuncionaisView'
import { LocaisView } from './components/locais/LocaisView'
import { fetchWithAuth } from './api/apiClient'

function App() {
  const [currentTab, setCurrentTab] = useState<'agenda' | 'eventos' | 'calendario' | 'avisos' | 'cadastro' | 'portaria' | 'relatorios' | 'auditoria' | 'regionais' | 'administracoes' | 'setores' | 'casas' | 'grupos-trabalho' | 'membros' | 'funcoes' | 'vinculos-funcionais' | 'locais'>('agenda')
  const [capacidades, setCapacidades] = useState<CapacidadesFrontend>({})

  useEffect(() => {
    fetchWithAuth<{ capacidades?: CapacidadesFrontend }>('/auth/me')
      .then((data) => {
        if (data && data.capacidades) {
          setCapacidades(data.capacidades)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <MainLayout currentTab={currentTab} onTabChange={setCurrentTab} capacidades={capacidades}>
      {currentTab === 'agenda' && <AgendaView />}
      {currentTab === 'eventos' && <EventosView />}
      {currentTab === 'calendario' && <CalendarioView />}
      {currentTab === 'portaria' && <PortariaView />}
      {currentTab === 'relatorios' && <RelatoriosView />}
      {currentTab === 'auditoria' && <AuditoriaView />}
      {currentTab === 'regionais' && <RegionaisView />}
      {currentTab === 'administracoes' && <AdministracoesView />}
      {currentTab === 'setores' && <SetoresView />}
      {currentTab === 'casas' && <CasasView />}
      {currentTab === 'grupos-trabalho' && <GruposTrabalhoView />}
      {currentTab === 'membros' && <MembrosView />}
      {currentTab === 'funcoes' && <FuncoesView />}
      {currentTab === 'vinculos-funcionais' && <VinculosFuncionaisView />}
      {currentTab === 'locais' && <LocaisView />}
      
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
