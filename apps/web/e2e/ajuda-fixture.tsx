import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MainLayout } from '../src/components/layout/MainLayout'
import { LocaisView } from '../src/components/locais/LocaisView'
import { EventosView } from '../src/components/eventos/EventosView'
import { ConvocacoesView } from '../src/components/convocacoes/ConvocacoesView'
import '../src/index.css'

function Fixture() {
  const [tab, setTab] = useState<'agenda' | 'locais' | 'eventos' | 'convocacoes'>(() => {
    const tela = new URLSearchParams(window.location.search).get('tela')
    return tela === 'eventos' || tela === 'convocacoes' ? tela : 'locais'
  })
  return (
    <MainLayout
      currentTab={tab}
      capacidades={{ podeGerirAgenda: true }}
      onTabChange={t =>
        setTab(t === 'locais' || t === 'eventos' || t === 'convocacoes' ? t : 'agenda')
      }
    >
      {tab === 'locais' && <LocaisView />}
      {tab === 'eventos' && <EventosView />}
      {tab === 'convocacoes' && <ConvocacoesView />}
      {tab === 'agenda' && <p>Minha Agenda</p>}
    </MainLayout>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Fixture />
  </React.StrictMode>
)
