import { FormEvent, useState } from 'react'
import * as apiClient from '../../api/apiClient'

type EscopoTipo = 'REGIONAL' | 'ADMINISTRACAO' | 'SETOR' | 'CASA' | 'GRUPO_TRABALHO'

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
  resumo: {
    totalReunioes: number
    totalPresentes: number
    totalAusentes: number
    taxaPresenca: number
  }
  reunioes: Array<{
    eventoId: string
    eventoTitulo: string
    inicioEm: string
    fimEm: string
    fechadoEm: string
    situacao: 'PRESENTE' | 'AUSENTE'
    respostaRsvp: string | null
    formaPresenca: string | null
    registradoEm: string | null
    localidade: string | null
  }>
}

interface RelatorioPeriodo {
  escopo: { escopoTipo: EscopoTipo; escopoId: string }
  periodo: { dataInicio: string | null; dataFim: string | null }
  resumo: {
    totalEventos: number
    totalConvocados: number
    totalConvocadosPresentes: number
    totalConvocadosAusentes: number
    totalConvidadosValidados: number
    totalConvidadosPendentes: number
    totalPresentes: number
    taxaPresencaConvocados: number
  }
  eventos: Array<{
    eventoId: string
    titulo: string
    inicioEm: string
    fechadoEm: string
    totalConvocados: number
    totalConvocadosPresentes: number
    totalConvocadosAusentes: number
    totalConvidadosValidados: number
    totalConvidadosPendentes: number
    totalPresentes: number
  }>
}

export function RelatoriosPresencaView() {
  const [aba, setAba] = useState<'evento' | 'membro' | 'periodo'>('evento')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const [eventoId, setEventoId] = useState('')
  const [evento, setEvento] = useState<RelatorioFinal | null>(null)

  const [membroId, setMembroId] = useState('')
  const [membroInicio, setMembroInicio] = useState('')
  const [membroFim, setMembroFim] = useState('')
  const [historico, setHistorico] = useState<HistoricoMembro | null>(null)

  const [escopoTipo, setEscopoTipo] = useState<EscopoTipo>('REGIONAL')
  const [escopoId, setEscopoId] = useState('')
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')
  const [periodo, setPeriodo] = useState<RelatorioPeriodo | null>(null)

  const executar = async (acao: () => Promise<void>) => {
    setErro('')
    setCarregando(true)
    try {
      await acao()
    } catch (error: any) {
      setErro(error?.message || 'Não foi possível carregar o relatório.')
    } finally {
      setCarregando(false)
    }
  }

  const buscarEvento = (e: FormEvent) => {
    e.preventDefault()
    if (!eventoId.trim()) return
    executar(async () => {
      const data = await apiClient.fetchWithAuth<RelatorioFinal>(
        `/relatorios/presencas/eventos/${eventoId.trim()}/final`
      )
      setEvento(data)
    })
  }

  const buscarMembro = (e: FormEvent) => {
    e.preventDefault()
    if (!membroId.trim()) return
    executar(async () => {
      const params = new URLSearchParams()
      if (membroInicio) params.set('dataInicio', `${membroInicio}T00:00:00.000Z`)
      if (membroFim) params.set('dataFim', `${membroFim}T23:59:59.999Z`)
      const suffix = params.toString() ? `?${params.toString()}` : ''
      const data = await apiClient.fetchWithAuth<HistoricoMembro>(
        `/relatorios/presencas/membros/${membroId.trim()}${suffix}`
      )
      setHistorico(data)
    })
  }

  const buscarPeriodo = (e: FormEvent) => {
    e.preventDefault()
    if (!escopoId.trim()) return
    executar(async () => {
      const params = new URLSearchParams({ escopoTipo, escopoId: escopoId.trim() })
      if (periodoInicio) params.set('dataInicio', `${periodoInicio}T00:00:00.000Z`)
      if (periodoFim) params.set('dataFim', `${periodoFim}T23:59:59.999Z`)
      const data = await apiClient.fetchWithAuth<RelatorioPeriodo>(
        `/relatorios/presencas/periodo?${params.toString()}`
      )
      setPeriodo(data)
    })
  }

  const resumoCard = (rotulo: string, valor: string | number) => (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
      <div className="text-xs text-slate-500">{rotulo}</div>
      <div className="mt-1 text-xl font-bold text-slate-800">{valor}</div>
    </div>
  )

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {[
          ['evento', 'Reunião específica'],
          ['membro', 'Histórico do membro'],
          ['periodo', 'Período / escopo'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setAba(id as typeof aba)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${aba === id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {erro && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

      {aba === 'evento' && (
        <div className="space-y-5">
          <form onSubmit={buscarEvento} className="flex gap-2">
            <input
              aria-label="ID do evento"
              value={eventoId}
              onChange={e => setEventoId(e.target.value)}
              placeholder="ID do evento"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button disabled={carregando} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              Consultar
            </button>
          </form>

          {evento && (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="font-semibold text-slate-900">{evento.evento.titulo}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {evento.fonte === 'SNAPSHOT_FECHAMENTO' ? 'Lista final da reunião' : 'Prévia operacional'}
                </p>
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
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="p-3">Nome</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Localidade</th>
                      <th className="p-3">Situação</th>
                      <th className="p-3">RSVP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {evento.itens.map(item => (
                      <tr key={`${item.tipoPessoa}-${item.origemId}`}>
                        <td className="p-3 font-medium text-slate-800">{item.nome}</td>
                        <td className="p-3">{item.tipoPessoa === 'MEMBRO' ? 'Membro' : 'Convidado'}</td>
                        <td className="p-3">{item.localidade || '—'}</td>
                        <td className="p-3">{item.situacao}</td>
                        <td className="p-3">{item.respostaRsvp || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {aba === 'membro' && (
        <div className="space-y-5">
          <form onSubmit={buscarMembro} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
            <input aria-label="ID do membro" value={membroId} onChange={e => setMembroId(e.target.value)} placeholder="ID do membro" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
            <input aria-label="Data inicial do membro" type="date" value={membroInicio} onChange={e => setMembroInicio(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input aria-label="Data final do membro" type="date" value={membroFim} onChange={e => setMembroFim(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button disabled={carregando} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white sm:col-span-4 disabled:opacity-50">Consultar histórico</button>
          </form>

          {historico && (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="font-semibold text-slate-900">{historico.membro.nome}</h3>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {resumoCard('Reuniões', historico.resumo.totalReunioes)}
                  {resumoCard('Presentes', historico.resumo.totalPresentes)}
                  {resumoCard('Ausentes', historico.resumo.totalAusentes)}
                  {resumoCard('Taxa de presença', `${historico.resumo.taxaPresenca}%`)}
                </div>
              </div>
              <div className="space-y-2">
                {historico.reunioes.map(item => (
                  <div key={item.eventoId} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-slate-800">{item.eventoTitulo}</div>
                        <div className="text-xs text-slate-500">{new Date(item.inicioEm).toLocaleDateString('pt-BR')}</div>
                      </div>
                      <div className="text-sm font-semibold">{item.situacao}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {aba === 'periodo' && (
        <div className="space-y-5">
          <form onSubmit={buscarPeriodo} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <select aria-label="Tipo de escopo" value={escopoTipo} onChange={e => setEscopoTipo(e.target.value as EscopoTipo)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="REGIONAL">Regional</option>
              <option value="ADMINISTRACAO">Administração</option>
              <option value="SETOR">Setor</option>
              <option value="CASA">Casa</option>
              <option value="GRUPO_TRABALHO">Grupo de Trabalho</option>
            </select>
            <input aria-label="ID do escopo" value={escopoId} onChange={e => setEscopoId(e.target.value)} placeholder="ID do escopo" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input aria-label="Data inicial do período" type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input aria-label="Data final do período" type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button disabled={carregando} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white sm:col-span-2 disabled:opacity-50">Consolidar período</button>
          </form>

          {periodo && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {resumoCard('Eventos', periodo.resumo.totalEventos)}
                {resumoCard('Convocados', periodo.resumo.totalConvocados)}
                {resumoCard('Presentes', periodo.resumo.totalConvocadosPresentes)}
                {resumoCard('Taxa convocados', `${periodo.resumo.taxaPresencaConvocados}%`)}
                {resumoCard('Ausentes', periodo.resumo.totalConvocadosAusentes)}
                {resumoCard('Convidados presentes', periodo.resumo.totalConvidadosValidados)}
                {resumoCard('Convidados pendentes', periodo.resumo.totalConvidadosPendentes)}
                {resumoCard('Total presentes', periodo.resumo.totalPresentes)}
              </div>

              <div className="space-y-2">
                {periodo.eventos.map(item => (
                  <div key={item.eventoId} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-slate-800">{item.titulo}</div>
                        <div className="text-xs text-slate-500">{new Date(item.inicioEm).toLocaleDateString('pt-BR')}</div>
                      </div>
                      <div className="text-right text-sm">
                        <div>{item.totalPresentes} presentes</div>
                        <div className="text-xs text-slate-500">{item.totalConvocados} convocados</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
