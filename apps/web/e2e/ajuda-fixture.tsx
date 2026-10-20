import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MainLayout } from '../src/components/layout/MainLayout'
import { LocaisView } from '../src/components/locais/LocaisView'
import '../src/index.css'

function Fixture() {
  const [tab, setTab] = useState<'agenda' | 'locais'>('locais')
  return (
    <MainLayout
      currentTab={tab}
      capacidades={{ podeGerirAgenda: true }}
      onTabChange={t => setTab(t === 'locais' ? 'locais' : 'agenda')}
    >
      {tab === 'locais' ? <LocaisView /> : <p>Minha Agenda</p>}
    </MainLayout>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Fixture />
  </React.StrictMode>
)
