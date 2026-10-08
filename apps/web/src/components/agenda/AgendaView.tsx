import { useEffect, useRef, useState } from 'react'
import { fetchWithAuth, postWithAuth } from '../../api/apiClient'
import { AgendaItem } from './types'
import { EventoDetalhe } from './EventoDetalhe'
import { EventCard } from './EventCard'

function resumoConflitos(item: AgendaItem) {
  const conflitos = item.conflito?.eventos ?? []
  const temSobreposicao = conflitos.some(conflito => conflito.tipo === 'SOBREPOSICAO')
  const temProximidade = conflitos.some(conflito => conflito.tipo === 'PROXIMIDADE')

  if (temSobreposicao && temProximidade) return 'Conflito de horário e compromissos próximos'
  if (temSobreposicao) return 'Conflito de horário'
  return 'Compromissos muito próximos'
}

function detalhesConflitos(item: AgendaItem) {
  if (!item.conflito) return ''

  const detalhes = item.conflito.eventos.map(conflito =>
    conflito.tipo === 'SOBREPOSICAO'
      ? `${conflito.titulo} (conflito de horário)`
      : `${conflito.titulo} (próximo, até ${item.conflito!.janelaTransicaoMinutos} min de transição)`
  )

  return `Também há: ${detalhes.join('; ')}.`
}

export function AgendaView() {
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null)
  const [priorizandoEventoId, setPriorizandoEventoId] = useState<string | null>(null)
  const geracaoCargaAgenda = useRef(0)

  const carregarAgenda = async (
    rsvpRecemSalvo?: { destinatarioId: string; rsvp: AgendaItem['rsvp'] }
  ) => {
    const geracao = ++geracaoCargaAgenda.current
    let data: AgendaItem[]
    try {
      data = await fetchWithAuth<AgendaItem[]>('/minha-agenda')
    } catch (err) {
      if (geracao !== geracaoCargaAgenda.current) return
      throw err
    }
    if (geracao !== geracaoCargaAgenda.current) return
    const now = new Date()
    const upcoming = data
      .filter(item => new Date(item.evento.fimEm) > now)
      .map(item =>
        rsvpRecemSalvo && item.destinatarioId === rsvpRecemSalvo.destinatarioId
          ? { ...item, rsvp: rsvpRecemSalvo.rsvp }
          : item
      )
    setItems(upcoming)
    setSelectedItem(current => {
      if (!current) return null
      return upcoming.find(item => item.evento.id === current.evento.id) ?? null
    })
  }

  useEffect(() => {
    async function load() {
      try {
        await carregarAgenda()
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const handleRsvpUpdated = (destinatarioId: string, rsvp: any) => {
    setError(null)
    setItems(current => current.map(item =>
      item.destinatarioId === destinatarioId ? { ...item, rsvp } : item
    ))
    if (selectedItem?.destinatarioId === destinatarioId) {
      setSelectedItem({ ...selectedItem, rsvp })
    }

    void carregarAgenda({ destinatarioId, rsvp }).catch((err: any) => {
      const invalidarConflitos = (item: AgendaItem) => ({
        ...item,
        rsvp: item.destinatarioId === destinatarioId ? rsvp : item.rsvp,
        conflito: null,
      })

      setItems(current => current.map(invalidarConflitos))
      setSelectedItem(current => current ? invalidarConflitos(current) : current)
      setError(err.message || 'Não foi possível atualizar os conflitos da agenda.')
    })
  }

  const handleExternalResponseUpdated = (eventoId: string, status: 'CONFIRMADO' | 'RECUSADO') => {
    setError(null)
    setItems(current => current.map(item => ({
      ...item,
      participacaoExterna: item.evento.id === eventoId && item.participacaoExterna
        ? { ...item.participacaoExterna, status }
        : item.participacaoExterna,
      conflito: null,
    })))
    void carregarAgenda().catch((err: any) => {
      setItems(current => current.map(item => ({ ...item, conflito: null })))
      setError(err.message || 'Não foi possível atualizar os conflitos da agenda.')
    })
  }

  const priorizar = async (item: AgendaItem) => {
    setPriorizandoEventoId(item.evento.id)
    setError(null)
    try {
      await postWithAuth(`/minha-agenda/prioridade/${item.evento.id}`, {})
      await carregarAgenda()
    } catch (err: any) {
      setError(err.message || 'Não foi possível priorizar o compromisso.')
    } finally {
      setPriorizandoEventoId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  if (items.length === 0 && !error) {
    return (
      <div className="p-8 text-center text-slate-500">
        <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        <p>Você não possui eventos futuros agendados.</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-600" role="alert">
          {error}
        </div>
      )}

      {items.map((item) => (
        <div key={item.evento.id} className="space-y-2">
          <EventCard item={item} onClick={() => setSelectedItem(item)} />

          {item.conflito && (
            <div
              className={`rounded-xl border p-3 text-sm ${
                item.conflito.atenuado
                  ? 'border-slate-200 bg-slate-50 text-slate-600'
                  : item.conflito.priorizado
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-amber-300 bg-amber-50 text-amber-950'
              }`}
              role="status"
            >
              <p className="font-semibold">
                {item.conflito.priorizado && (!item.conflito.conflitosResolvidos || item.conflito.atenuado)
                  ? 'Prioridade parcial'
                  : item.conflito.priorizado
                    ? 'Compromisso priorizado'
                    : resumoConflitos(item)}
              </p>
              <p className="mt-1 text-xs">
                {detalhesConflitos(item)}
              </p>
              {(!item.conflito.conflitosResolvidos || item.conflito.atenuado) && (
                <button
                  type="button"
                  disabled={priorizandoEventoId !== null}
                  onClick={() => void priorizar(item)}
                  className="mt-2 rounded-lg border border-amber-700 bg-white px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-50"
                >
                  {priorizandoEventoId === item.evento.id ? 'Priorizando...' : 'Priorizar este compromisso'}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      
      {selectedItem && (
        <EventoDetalhe 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)} 
          onRsvpUpdated={handleRsvpUpdated}
          onExternalResponseUpdated={handleExternalResponseUpdated}
        />
      )}
    </div>
  )
}
