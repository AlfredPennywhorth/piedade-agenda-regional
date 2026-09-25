import { useState, useEffect } from 'react'
import { MainLayout, CapacidadesFrontend } from './components/layout/MainLayout'
import { AgendaView } from './components/agenda/AgendaView'
import { EventosView } from './components/eventos/EventosView'
import { SeriesView } from './components/series/SeriesView'
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
import { ConvocacoesView } from './components/convocacoes/ConvocacoesView'
import { fetchWithAuth, limparTokenSessao, possuiTokenSessao, postWithAuth } from './api/apiClient'
import { AuthView } from './components/auth/AuthView'
import { ResponsabilidadeRegionalGate } from './components/governanca/ResponsabilidadeRegionalGate'
import { CadastroConvidadoView } from './components/portaria/CadastroConvidadoView'
import { ContasAcessoView } from './components/acessos/ContasAcessoView'
import { PerfilView } from './components/perfil/PerfilView'
import { PortariaOperadorTemporarioView } from './components/portaria/PortariaOperadorTemporarioView'

function App() {
  const paramsPublicos = new URLSearchParams(window.location.search)
  const tokenPortariaPublica = paramsPublicos.get('p') || paramsPublicos.get('portaria')
  const tokenOperadorPortaria = window.location.pathname.startsWith('/o/')
    ? decodeURIComponent(window.location.pathname.slice(3))
    : paramsPublicos.get('op')

  const [currentTab, setCurrentTab] = useState<'agenda' | 'eventos' | 'series' | 'calendario' | 'avisos' | 'cadastro' | 'portaria' | 'relatorios' | 'auditoria' | 'regionais' | 'administracoes' | 'setores' | 'casas' | 'grupos-trabalho' | 'membros' | 'funcoes' | 'vinculos-funcionais' | 'locais' | 'convocacoes' | 'acessos'>('agenda')
  const [capacidades, setCapacidades] = useState<CapacidadesFrontend>({})
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [estadoSessao, setEstadoSessao] = useState<'verificando' | 'autenticada' | 'anonima'>('verificando')
  const [tokenAtivacao, setTokenAtivacao] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('ativacao') || params.get('token')
  })

  const carregarIdentidade = async () => {
    if (!possuiTokenSessao()) {
      setEstadoSessao('anonima')
      return
    }

    try {
      const data = await fetchWithAuth<{
        nome?: string
        capacidades?: CapacidadesFrontend
      }>('/auth/me')
      setNomeUsuario(data.nome || '')
      setCapacidades(data.capacidades || {})
      setEstadoSessao('autenticada')
    } catch {
      limparTokenSessao()
      setNomeUsuario('')
      setCapacidades({})
      setEstadoSessao('anonima')
    }
  }

  useEffect(() => {
    carregarIdentidade()
  }, [])

  const podeAcessarAba = (tab: typeof currentTab) => {
    if (tab === 'portaria') return capacidades.podeOperarPortaria === true
    if (tab === 'relatorios') return capacidades.podeVisualizarRelatorios === true
    if (tab === 'auditoria') return capacidades.podeVisualizarAuditoria === true
    if (tab === 'acessos') return capacidades.podeAdministrarAcessos === true
    if (['regionais', 'administracoes', 'setores', 'casas', 'grupos-trabalho'].includes(tab)) {
      return capacidades.podeAdministrarEstrutura === true
    }
    if (['membros', 'vinculos-funcionais'].includes(tab)) {
      return capacidades.podeAdministrarPessoas === true
    }
    if (tab === 'funcoes') return capacidades.podeAdministrarFuncoes === true
    if (['eventos', 'series', 'convocacoes', 'locais'].includes(tab)) {
      return capacidades.podeGerirAgenda === true
    }
    return true
  }

  const alterarAba = (tab: typeof currentTab) => {
    setCurrentTab(podeAcessarAba(tab) ? tab : 'agenda')
  }

  const concluirAutenticacao = async () => {
    setTokenAtivacao(null)
    window.history.replaceState({}, document.title, window.location.pathname)
    setEstadoSessao('verificando')
    await carregarIdentidade()
  }

  const cancelarAtivacao = () => {
    setTokenAtivacao(null)
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  const sair = async () => {
    try {
      await postWithAuth('/auth/logout', {})
    } catch {
      // A limpeza local também encerra uma sessão já expirada.
    } finally {
      limparTokenSessao()
      setNomeUsuario('')
      setCapacidades({})
      setCurrentTab('agenda')
      setEstadoSessao('anonima')
    }
  }

  if ((window.location.pathname === '/portaria-operador' || window.location.pathname.startsWith('/o/')) && tokenOperadorPortaria) {
    return <PortariaOperadorTemporarioView token={tokenOperadorPortaria} />
  }

  if ((window.location.pathname === '/c' || window.location.pathname === '/convidado') && tokenPortariaPublica) {
    return <CadastroConvidadoView token={tokenPortariaPublica} />
  }

  if (estadoSessao === 'verificando') {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-600">Verificando acesso...</p>
      </main>
    )
  }

  if (estadoSessao === 'anonima') {
    return (
      <AuthView
        tokenAtivacao={tokenAtivacao}
        onAuthenticated={concluirAutenticacao}
        onCancelarAtivacao={tokenAtivacao ? cancelarAtivacao : undefined}
      />
    )
  }

  return (
    <ResponsabilidadeRegionalGate onCienciaRegistrada={carregarIdentidade}>
    <MainLayout
      currentTab={currentTab}
      onTabChange={alterarAba}
      capacidades={capacidades}
      nomeUsuario={nomeUsuario}
      onLogout={sair}
    >
      {currentTab === 'agenda' && <AgendaView />}
      {currentTab === 'eventos' && capacidades.podeGerirAgenda === true && <EventosView />}
      {currentTab === 'series' && capacidades.podeGerirAgenda === true && <SeriesView />}
      {currentTab === 'convocacoes' && capacidades.podeGerirAgenda === true && <ConvocacoesView />}
      {currentTab === 'calendario' && <CalendarioView />}
      {currentTab === 'portaria' && capacidades.podeOperarPortaria === true && <PortariaView />}
      {currentTab === 'relatorios' && capacidades.podeVisualizarRelatorios === true && <RelatoriosView />}
      {currentTab === 'auditoria' && capacidades.podeVisualizarAuditoria === true && <AuditoriaView />}
      {currentTab === 'regionais' && capacidades.podeAdministrarEstrutura === true && (
        <RegionaisView podeEditar={capacidades.podeAdministrarRegionais === true} />
      )}
      {currentTab === 'administracoes' && capacidades.podeAdministrarEstrutura === true && <AdministracoesView />}
      {currentTab === 'setores' && capacidades.podeAdministrarEstrutura === true && <SetoresView />}
      {currentTab === 'casas' && capacidades.podeAdministrarEstrutura === true && <CasasView />}
      {currentTab === 'grupos-trabalho' && capacidades.podeAdministrarEstrutura === true && <GruposTrabalhoView />}
      {currentTab === 'membros' && capacidades.podeAdministrarPessoas === true && <MembrosView />}
      {currentTab === 'funcoes' && capacidades.podeAdministrarFuncoes === true && <FuncoesView />}
      {currentTab === 'vinculos-funcionais' && capacidades.podeAdministrarPessoas === true && <VinculosFuncionaisView />}
      {currentTab === 'locais' && capacidades.podeGerirAgenda === true && <LocaisView />}
      {currentTab === 'acessos' && capacidades.podeAdministrarAcessos === true && <ContasAcessoView />}
      
      {currentTab === 'avisos' && (
        <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <NotificacoesControl />
          <div className="text-center text-slate-500 mt-8">
            <p>Módulo de Avisos em desenvolvimento.</p>
          </div>
        </div>
      )}
      
      {currentTab === 'cadastro' && <PerfilView />}
    </MainLayout>
    </ResponsabilidadeRegionalGate>
  )
}

export default App
