import { FormEvent, useEffect, useMemo, useState } from 'react'
import * as apiClient from '../../api/apiClient'
import { baixarCsv, montarCsv } from '../../utils/csv'

type EscopoTipo = 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO'

interface EventoLookup { id: string; titulo: string; inicioEm: string; ativo: boolean }
interface MembroLookup { id: string; nome: string; casaId: string; ativo: boolean }
interface RegionalLookup { id: string; nome: string; ativo: boolean }
interface AdministracaoLookup { id: string; regionalId: string; nome: string; ativo: boolean }
interface SetorLookup { id: string; administracaoId: string; nome: string; ativo: boolean }
interface CasaLookup { id: string; setorId: string; nome: string; ativo: boolean }
interface GrupoLookup { id: string; nome: string; regionalId: string | null; ativo: boolean }

interface RelatorioFinal {
  fonte: 'SNAPSHOT_FECHAMENTO' | 'PREVIA_OPERACIONAL'
  evento: { id: string; titulo: string; inicioEm: string; fimEm: string }
  fechamento: { id: string; fechadoEm: string; fechadoPorMembroId: string | null } | null
  resumo: {
    totalConvocados: number
    totalConvocadosPresentes: number
    totalConvocadosAusentes: number
    totalConvidadosValidados: number
    totalConvidadosPendentes: number
    totalPresentes: number
  }
  itens: Array<{
    tipoPessoa: 'MEMBRO' | 'CONVIDADO'
    origemId: string
    nome: string
    localidade: string | null
    situacao: 'PRESENTE' | 'AUSENTE' | 'PENDENTE'
    respostaRsvp: string | null
    formaPresenca: string | null
    registradoEm: string | null
  }>
}

interface HistoricoMembro {
  membro: { id: string; nome: string }
  periodo: { dataInicio: string | null; dataFim: string | null }
  resumo: { totalReunioes: number; totalPresentes: number; totalAusentes: number; taxaPresenca: number }
  reunioes: Array<{
    eventoId: string; eventoTitulo: string; inicioEm: string; fimEm: string; fechadoEm: string
    situacao: 'PRESENTE' | 'AUSENTE'; respostaRsvp: string | null; formaPresenca: string | null
    registradoEm: string | null; localidade: string | null
  }>
}

interface RelatorioPeriodo {
  escopo: { escopoTipo: EscopoTipo; escopoId: string }
  periodo: { dataInicio: string | null; dataFim: string | null }
  resumo: {
    totalEventos: number; totalConvocados: number; totalConvocadosPresentes: number
    totalConvocadosAusentes: number; totalConvidadosValidados: number
    totalConvidadosPendentes: number; totalPresentes: number; taxaPresencaConvocados: number
  }
  eventos: Array<{
    eventoId: string; titulo: string; inicioEm: string; fechadoEm: string
    totalConvocados: number; totalConvocadosPresentes: number; totalConvocadosAusentes: number
    totalConvidadosValidados: number; totalConvidadosPendentes: number; totalPresentes: number
  }>
}

export function RelatoriosPresencaView() {
  const [aba, setAba] = useState<'evento' | 'membro' | 'periodo'>('evento')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [carregandoLookups, setCarregandoLookups] = useState(true)

  const [eventos, setEventos] = useState<EventoLookup[]>([])
  const [membros, setMembros] = useState<MembroLookup[]>([])
  const [regionais, setRegionais] = useState<RegionalLookup[]>([])
  const [administracoes, setAdministracoes] = useState<AdministracaoLookup[]>([])
  const [setores, setSetores] = useState<SetorLookup[]>([])
  const [casas, setCasas] = useState<CasaLookup[]>([])
  const [grupos, setGrupos] = useState<GrupoLookup[]>([])

  const [eventoBusca, setEventoBusca] = useState('')
  const [eventoId, setEventoId] = useState('')
  const [evento, setEvento] = useState<RelatorioFinal | null>(null)

  const [membroBusca, setMembroBusca] = useState('')
  const [membroId, setMembroId] = useState('')
  const [membroInicio, setMembroInicio] = useState('')
  const [membroFim, setMembroFim] = useState('')
  const [historico, setHistorico] = useState<HistoricoMembro | null>(null)

  const [escopoTipo, setEscopoTipo] = useState<EscopoTipo>('REGIONAL')
  const [regionalId, setRegionalId] = useState('')
  const [administracaoId, setAdministracaoId] = useState('')
  const [setorId, setSetorId] = useState('')
  const [casaId, setCasaId] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')
  const [periodo, setPeriodo] = useState<RelatorioPeriodo | null>(null)

  useEffect(() => {
    let ativo = true
    Promise.all([
      apiClient.fetchWithAuth<EventoLookup[]>('/eventos'),
      apiClient.fetchWithAuth<MembroLookup[]>('/membros'),
      apiClient.fetchWithAuth<RegionalLookup[]>('/regionais'),
      apiClient.fetchWithAuth<AdministracaoLookup[]>('/administracoes'),
      apiClient.fetchWithAuth<SetorLookup[]>('/setores'),
      apiClient.fetchWithAuth<CasaLookup[]>('/casas'),
      apiClient.fetchWithAuth<GrupoLookup[]>('/grupos-trabalho'),
    ]).then(([ev, me, re, ad, se, ca, gt]) => {
      if (!ativo) return
      setEventos((ev || []).filter(x => x.ativo))
      setMembros((me || []).filter(x => x.ativo))
      setRegionais((re || []).filter(x => x.ativo))
      setAdministracoes((ad || []).filter(x => x.ativo))
      setSetores((se || []).filter(x => x.ativo))
      setCasas((ca || []).filter(x => x.ativo))
      setGrupos((gt || []).filter(x => x.ativo))
    }).catch(error => {
      if (ativo) setErro(error?.message || 'Não foi possível carregar os filtros.')
    }).finally(() => {
      if (ativo) setCarregandoLookups(false)
    })
    return () => { ativo = false }
  }, [])

  const eventosFiltrados = useMemo(() => {
    const termo = eventoBusca.trim().toLowerCase()
    return eventos
      .filter(item => !termo || item.titulo.toLowerCase().includes(termo))
      .sort((a, b) => b.inicioEm.localeCompare(a.inicioEm))
      .slice(0, 50)
  }, [eventos, eventoBusca])

  const membrosFiltrados = useMemo(() => {
    const termo = membroBusca.trim().toLowerCase()
    return membros
      .filter(item => !termo || item.nome.toLowerCase().includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, 50)
  }, [membros, membroBusca])

  const administracoesDisponiveis = administracoes.filter(x => !regionalId || x.regionalId === regionalId)
  const setoresDisponiveis = setores.filter(x => !administracaoId || x.administracaoId === administracaoId)
  const casasDisponiveis = casas.filter(x => !setorId || x.setorId === setorId)
  const gruposDisponiveis = grupos.filter(x => !regionalId || x.regionalId === regionalId)

  const executar = async (acao: () => Promise<void>) => {
    setErro('')
    setCarregando(true)
    try { await acao() }
    catch (error: any) { setErro(error?.message || 'Não foi possível carregar o relatório.') }
    finally { setCarregando(false) }
  }

  const buscarEvento = (e: FormEvent) => {
    e.preventDefault()
    if (!eventoId) return
    executar(async () => setEvento(await apiClient.fetchWithAuth<RelatorioFinal>(`/relatorios/presencas/eventos/${eventoId}/final`)))
  }

  const buscarMembro = (e: FormEvent) => {
    e.preventDefault()
    if (!membroId) return
    executar(async () => {
      const params = new URLSearchParams()
      if (membroInicio) params.set('dataInicio', `${membroInicio}T00:00:00.000Z`)
      if (membroFim) params.set('dataFim', `${membroFim}T23:59:59.999Z`)
      const suffix = params.toString() ? `?${params.toString()}` : ''
      setHistorico(await apiClient.fetchWithAuth<HistoricoMembro>(`/relatorios/presencas/membros/${membroId}${suffix}`))
    })
  }

  const escopoSelecionadoId =
    escopoTipo === 'REGIONAL' ? regionalId :
    escopoTipo === 'ADMINISTRACAO' ? administracaoId :
    escopoTipo === 'SETOR' ? setorId :
    escopoTipo === 'CASA' ? casaId :
    grupoId

  const buscarPeriodo = (e: FormEvent) => {
    e.preventDefault()
    if (!escopoSelecionadoId) return
    executar(async () => {
      const params = new URLSearchParams({ escopoTipo, escopoId: escopoSelecionadoId })
      if (periodoInicio) params.set('dataInicio', `${periodoInicio}T00:00:00.000Z`)
      if (periodoFim) params.set('dataFim', `${periodoFim}T23:59:59.999Z`)
      setPeriodo(await apiClient.fetchWithAuth<RelatorioPeriodo>(`/relatorios/presencas/periodo?${params.toString()}`))
    })
  }

  const resumoCard = (rotulo: string, valor: string | number) => (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
      <div className="text-xs text-slate-500">{rotulo}</div>
      <div className="mt-1 text-xl font-bold text-slate-800">{valor}</div>
    </div>
  )

  const imprimirRelatorio = () => window.print()

  const exportarEventoCsv = () => {
    if (!evento) return
    const csv = montarCsv(
      ['Nome', 'Tipo', 'Localidade', 'Situação', 'RSVP', 'Forma de presença', 'Registrado em'],
      evento.itens.map(item => [
        item.nome,
        item.tipoPessoa === 'MEMBRO' ? 'Membro' : 'Convidado',
        item.localidade,
        item.situacao,
        item.respostaRsvp,
        item.formaPresenca,
        item.registradoEm,
      ])
    )
    baixarCsv(`presencas-${evento.evento.id}.csv`, csv)
  }

  const exportarHistoricoCsv = () => {
    if (!historico) return
    const csv = montarCsv(
      ['Reunião', 'Início', 'Situação', 'RSVP', 'Forma de presença', 'Registrado em', 'Localidade'],
      historico.reunioes.map(item => [
        item.eventoTitulo,
        item.inicioEm,
        item.situacao,
        item.respostaRsvp,
        item.formaPresenca,
        item.registradoEm,
        item.localidade,
      ])
    )
    baixarCsv(`historico-presenca-${historico.membro.id}.csv`, csv)
  }

  const exportarPeriodoCsv = () => {
    if (!periodo) return
    const csv = montarCsv(
      ['Reunião', 'Início', 'Convocados', 'Presentes convocados', 'Ausentes', 'Convidados presentes', 'Convidados pendentes', 'Total presentes'],
      periodo.eventos.map(item => [
        item.titulo,
        item.inicioEm,
        item.totalConvocados,
        item.totalConvocadosPresentes,
        item.totalConvocadosAusentes,
        item.totalConvidadosValidados,
        item.totalConvidadosPendentes,
        item.totalPresentes,
      ])
    )
    baixarCsv(`presencas-periodo-${periodo.escopo.escopoTipo.toLowerCase()}-${periodo.escopo.escopoId}.csv`, csv)
  }

  const AcoesRelatorio = ({ onCsv }: { onCsv: () => void }) => (
    <div className="relatorio-controles flex flex-wrap justify-end gap-2">
      <button type="button" onClick={onCsv} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        Exportar CSV
      </button>
      <button type="button" onClick={imprimirRelatorio} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        Imprimir / Salvar PDF
      </button>
    </div>
  )

  const optionVazia = carregandoLookups ? 'Carregando...' : 'Selecione...'

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Visão do relatório">
        {[
          ['evento', 'Reunião específica'],
          ['membro', 'Histórico do membro'],
          ['periodo', 'Período / escopo'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={aba === id}
            onClick={() => setAba(id as typeof aba)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${aba === id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {erro && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {carregando && (
        <div role="status" aria-live="polite" className="sr-only">
          Carregando relatório...
        </div>
      )}

      {aba === 'evento' && (
        <div className="space-y-5">
          <form onSubmit={buscarEvento} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto]">
            <input aria-label="Pesquisar reunião" value={eventoBusca} onChange={e => setEventoBusca(e.target.value)}
              placeholder="Pesquisar reunião por nome" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select aria-label="Selecionar reunião" value={eventoId} onChange={e => setEventoId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">{optionVazia}</option>
              {eventosFiltrados.map(item => (
                <option key={item.id} value={item.id}>
                  {item.titulo} — {new Date(item.inicioEm).toLocaleDateString('pt-BR')}
                </option>
              ))}
            </select>
            <button disabled={carregando || !eventoId} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Consultar</button>
          </form>

          {evento && <div className="relatorio-impressao space-y-5">
            <AcoesRelatorio onCsv={exportarEventoCsv} />
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900">{evento.evento.titulo}</h3>
              <p className="mt-1 text-xs text-slate-500">{evento.fonte === 'SNAPSHOT_FECHAMENTO' ? 'Lista final da reunião' : 'Prévia operacional'}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {resumoCard('Convocados', evento.resumo.totalConvocados)}
                {resumoCard('Presentes convocados', evento.resumo.totalConvocadosPresentes)}
                {resumoCard('Ausentes', evento.resumo.totalConvocadosAusentes)}
                {resumoCard('Convidados presentes', evento.resumo.totalConvidadosValidados)}
                {resumoCard('Convidados pendentes', evento.resumo.totalConvidadosPendentes)}
                {resumoCard('Total presentes', evento.resumo.totalPresentes)}
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <caption className="sr-only">Participantes e situação de presença da reunião selecionada</caption>
                <thead className="bg-slate-50 text-left text-slate-600"><tr>
                  <th className="p-3">Nome</th><th className="p-3">Tipo</th><th className="p-3">Localidade</th><th className="p-3">Situação</th><th className="p-3">RSVP</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">{evento.itens.map(item => (
                  <tr key={`${item.tipoPessoa}-${item.origemId}`}>
                    <td className="p-3 font-medium text-slate-800">{item.nome}</td>
                    <td className="p-3">{item.tipoPessoa === 'MEMBRO' ? 'Membro' : 'Convidado'}</td>
                    <td className="p-3">{item.localidade || '—'}</td><td className="p-3">{item.situacao}</td><td className="p-3">{item.respostaRsvp || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>}
        </div>
      )}

      {aba === 'membro' && (
        <div className="space-y-5">
          <form onSubmit={buscarMembro} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <input aria-label="Pesquisar membro" value={membroBusca} onChange={e => setMembroBusca(e.target.value)}
              placeholder="Pesquisar membro por nome" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select aria-label="Selecionar membro" value={membroId} onChange={e => setMembroId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">{optionVazia}</option>
              {membrosFiltrados.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
            <input aria-label="Data inicial do membro" type="date" value={membroInicio} onChange={e => setMembroInicio(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input aria-label="Data final do membro" type="date" value={membroFim} onChange={e => setMembroFim(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button disabled={carregando || !membroId} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white sm:col-span-2 disabled:opacity-50">Consultar histórico</button>
          </form>

          {historico && <div className="relatorio-impressao space-y-5">
            <AcoesRelatorio onCsv={exportarHistoricoCsv} />
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900">{historico.membro.nome}</h3>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {resumoCard('Reuniões', historico.resumo.totalReunioes)}
                {resumoCard('Presentes', historico.resumo.totalPresentes)}
                {resumoCard('Ausentes', historico.resumo.totalAusentes)}
                {resumoCard('Taxa de presença', `${historico.resumo.taxaPresenca}%`)}
              </div>
            </div>
            <div className="space-y-2">{historico.reunioes.map(item => (
              <div key={item.eventoId} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><div className="font-medium text-slate-800">{item.eventoTitulo}</div><div className="text-xs text-slate-500">{new Date(item.inicioEm).toLocaleDateString('pt-BR')}</div></div>
                  <div className="text-sm font-semibold">{item.situacao}</div>
                </div>
              </div>
            ))}</div>
          </div>}
        </div>
      )}

      {aba === 'periodo' && (
        <div className="space-y-5">
          <form onSubmit={buscarPeriodo} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <select aria-label="Tipo de escopo" value={escopoTipo} onChange={e => setEscopoTipo(e.target.value as EscopoTipo)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="REGIONAL">Regional</option><option value="ADMINISTRACAO">Administração</option><option value="SETOR">Setor</option><option value="CASA">Casa</option><option value="GRUPO_TRABALHO">Grupo de Trabalho</option>
            </select>
            <select aria-label="Regional" value={regionalId} onChange={e => { setRegionalId(e.target.value); setAdministracaoId(''); setSetorId(''); setCasaId(''); setGrupoId('') }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">{optionVazia}</option>{regionais.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
            {escopoTipo !== 'REGIONAL' && escopoTipo !== 'GRUPO_TRABALHO' && (
              <select aria-label="Administração" value={administracaoId} onChange={e => { setAdministracaoId(e.target.value); setSetorId(''); setCasaId('') }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">{optionVazia}</option>{administracoesDisponiveis.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            )}
            {(escopoTipo === 'SETOR' || escopoTipo === 'CASA') && (
              <select aria-label="Setor" value={setorId} onChange={e => { setSetorId(e.target.value); setCasaId('') }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">{optionVazia}</option>{setoresDisponiveis.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            )}
            {escopoTipo === 'CASA' && (
              <select aria-label="Casa de Oração" value={casaId} onChange={e => setCasaId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">{optionVazia}</option>{casasDisponiveis.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            )}
            {escopoTipo === 'GRUPO_TRABALHO' && (
              <select aria-label="Grupo de Trabalho" value={grupoId} onChange={e => setGrupoId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">{optionVazia}</option>{gruposDisponiveis.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            )}
            <input aria-label="Data inicial do período" type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input aria-label="Data final do período" type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button disabled={carregando || !escopoSelecionadoId} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white sm:col-span-2 disabled:opacity-50">Consolidar período</button>
          </form>

          {periodo && <div className="relatorio-impressao space-y-5">
            <AcoesRelatorio onCsv={exportarPeriodoCsv} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {resumoCard('Eventos', periodo.resumo.totalEventos)}{resumoCard('Convocados', periodo.resumo.totalConvocados)}
              {resumoCard('Presentes', periodo.resumo.totalConvocadosPresentes)}{resumoCard('Taxa convocados', `${periodo.resumo.taxaPresencaConvocados}%`)}
              {resumoCard('Ausentes', periodo.resumo.totalConvocadosAusentes)}{resumoCard('Convidados presentes', periodo.resumo.totalConvidadosValidados)}
              {resumoCard('Convidados pendentes', periodo.resumo.totalConvidadosPendentes)}{resumoCard('Total presentes', periodo.resumo.totalPresentes)}
            </div>
            <div className="space-y-2">{periodo.eventos.map(item => (
              <div key={item.eventoId} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><div className="font-medium text-slate-800">{item.titulo}</div><div className="text-xs text-slate-500">{new Date(item.inicioEm).toLocaleDateString('pt-BR')}</div></div>
                  <div className="text-right text-sm"><div>{item.totalPresentes} presentes</div><div className="text-xs text-slate-500">{item.totalConvocados} convocados</div></div>
                </div>
              </div>
            ))}</div>
          </div>}
        </div>
      )}
    </section>
  )
}
