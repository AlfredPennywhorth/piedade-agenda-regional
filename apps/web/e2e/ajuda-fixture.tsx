import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MainLayout } from '../src/components/layout/MainLayout'
import { LocaisView } from '../src/components/locais/LocaisView'
import { EventosView } from '../src/components/eventos/EventosView'
import { ConvocacoesView } from '../src/components/convocacoes/ConvocacoesView'
import { AgendaView } from '../src/components/agenda/AgendaView'
import { CalendarioView } from '../src/components/calendario/CalendarioView'
import { AuthView } from '../src/components/auth/AuthView'
import '../src/index.css'

function Fixture() {
  const [tab, setTab] = useState<'agenda' | 'calendario' | 'locais' | 'eventos' | 'convocacoes'>(
    () => {
      const tela = new URLSearchParams(window.location.search).get('tela')
      return tela === 'eventos' ||
        tela === 'convocacoes' ||
        tela === 'agenda' ||
        tela === 'calendario'
        ? tela
        : 'locais'
    }
  )
  return (
    <MainLayout
      currentTab={tab}
      capacidades={{ podeGerirAgenda: true }}
      onTabChange={t =>
        setTab(
          t === 'locais' || t === 'eventos' || t === 'convocacoes' || t === 'calendario'
            ? t
            : 'agenda'
        )
      }
    >
      {tab === 'locais' && <LocaisView />}
      {tab === 'eventos' && <EventosView />}
      {tab === 'convocacoes' && <ConvocacoesView />}
      {tab === 'agenda' && <AgendaView />}
      {tab === 'calendario' && <CalendarioView />}
    </MainLayout>
  )
}

const telaPublica = new URLSearchParams(window.location.search).get('tela')

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {telaPublica === 'login' || telaPublica === 'ativacao' ? (
      <AuthView
        tokenAtivacao={telaPublica === 'ativacao' ? 'token-ficticio-nao-enviado' : undefined}
        onAuthenticated={() => {}}
      />
    ) : (
      <Fixture />
    )}
  </React.StrictMode>
)
