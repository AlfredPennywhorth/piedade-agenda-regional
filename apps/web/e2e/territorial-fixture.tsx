import React from 'react'
import { createRoot } from 'react-dom/client'
import { MainLayout } from '../src/components/layout/MainLayout'
import { RegionaisView } from '../src/components/regionais/RegionaisView'
import { AdministracoesView } from '../src/components/administracoes/AdministracoesView'
import '../src/index.css'

const params = new URLSearchParams(location.search)
const tab = params.get('tela') === 'administracoes' ? 'administracoes' : 'regionais'
const podeEditar = params.get('consulta') !== '1'
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MainLayout
      currentTab={tab}
      nomeUsuario="Operador de teste"
      onTabChange={() => {}}
      capacidades={{ podeAdministrarEstrutura: true, podeAdministrarRegionais: podeEditar }}
    >
      {tab === 'regionais' ? <RegionaisView podeEditar={podeEditar} /> : <AdministracoesView />}
    </MainLayout>
  </React.StrictMode>
)
