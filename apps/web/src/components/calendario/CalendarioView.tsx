import { useEffect, useRef, useState } from 'react'
import { fetchWithAuth } from '../../api/apiClient'
import { AgendaItem } from '../agenda/types'
import { EventCard } from '../agenda/EventCard'
import { EventoDetalhe } from '../agenda/EventoDetalhe'

function chaveDiaSaoPaulo(iso: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date(iso))
  const valores = Object.fromEntries(
    parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value])
  )
  return `${valores.year}-${Number(valores.month) - 1}-${Number(valores.day)}`
}

export function CalendarioView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDayEvents, setSelectedDayEvents] = useState<AgendaItem[] | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<AgendaItem | null>(null)
  const [erroAtualizacaoConflitos, setErroAtualizacaoConflitos] = useState<string | null>(null)
  const geracaoCargaAgenda = useRef(0)
  const selectedDateRef = useRef<Date | null>(null)

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
    const atualizados = data.map(item =>
      rsvpRecemSalvo && item.destinatarioId === rsvpRecemSalvo.destinatarioId
        ? { ...item, rsvp: rsvpRecemSalvo.rsvp }
        : item
    )

    setErroAtualizacaoConflitos(null)
    setItems(atualizados)
    setSelectedDayEvents(current => {
      const dataSelecionada = selectedDateRef.current
      if (!current || !dataSelecionada) return current
      const chaveSelecionada = `${dataSelecionada.getFullYear()}-${dataSelecionada.getMonth()}-${dataSelecionada.getDate()}`
      return atualizados.filter(item => chaveDiaSaoPaulo(item.evento.inicioEm) === chaveSelecionada)
    })
    setSelectedEvent(current => {
      if (!current) return null
      return atualizados.find(item => item.evento.id === current.evento.id) ?? null
    })
  }

  useEffect(() => {
    async function load() {
      try {
        await carregarAgenda()
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const handleRsvpUpdated = (destinatarioId: string, rsvp: any) => {
    const atualizarItem = (item: AgendaItem) =>
      item.destinatarioId === destinatarioId ? { ...item, rsvp } : item

    setItems(current => current.map(atualizarItem))
    setSelectedDayEvents(current => current ? current.map(atualizarItem) : current)

    if (selectedEvent?.destinatarioId === destinatarioId) {
      setSelectedEvent({ ...selectedEvent, rsvp })
    }

    void carregarAgenda({ destinatarioId, rsvp }).catch(err => {
      console.error(err)
      const limparConflitoObsoleto = (item: AgendaItem) =>
        item.destinatarioId === destinatarioId
          ? { ...item, rsvp, conflito: null }
          : item

      setItems(current => current.map(limparConflitoObsoleto))
      setSelectedDayEvents(current => current ? current.map(limparConflitoObsoleto) : current)
      setSelectedEvent(current =>
        current?.destinatarioId === destinatarioId
          ? { ...current, rsvp, conflito: null }
          : current
      )
      setErroAtualizacaoConflitos(
        'A resposta foi salva, mas não foi possível atualizar os conflitos da agenda. Recarregue o calendário.'
      )
    })
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  
  const startingDay = firstDayOfMonth.getDay() // 0 = Sun
  const daysInMonth = lastDayOfMonth.getDate()
  
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const today = new Date()

  // Get events mapped by São Paulo operational day.
  const eventsByDay = items.reduce((acc, item) => {
    const key = chaveDiaSaoPaulo(item.evento.inicioEm)
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<string, AgendaItem[]>)

  const handleDayClick = (day: number, dayEvents: AgendaItem[]) => {
    const novaData = new Date(year, month, day)
    selectedDateRef.current = novaData
    setSelectedDate(novaData)
    setSelectedDayEvents(dayEvents)
  }

  return (
    <div className="p-4">
      {erroAtualizacaoConflitos && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {erroAtualizacaoConflitos}
        </div>
      )}
      
      <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
        <button onClick={prevMonth} className="p-2 text-slate-500 hover:bg-slate-50 rounded-full">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h2 className="font-bold text-slate-800 text-lg">{monthNames[month]} {year}</h2>
        <button onClick={nextMonth} className="p-2 text-slate-500 hover:bg-slate-50 rounded-full">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100">
          {dayNames.map(d => (
            <div key={d} className="text-center py-2 text-xs font-semibold text-slate-500">
              {d}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7">
          {/* Empty cells for starting day */}
          {Array.from({ length: startingDay }).map((_, i) => (
            <div key={`empty-${i}`} className="p-2 border-b border-r border-slate-50 bg-slate-50/50 aspect-square"></div>
          ))}
          
          {/* Actual days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate()
            const isSelected = selectedDate?.getFullYear() === year && selectedDate?.getMonth() === month && selectedDate?.getDate() === day
            const key = `${year}-${month}-${day}`
            const dayEvents = eventsByDay[key] || []
            const hasEvent = dayEvents.length > 0
            
            return (
              <button
                key={day} 
                onClick={() => handleDayClick(day, dayEvents)}
                aria-label={`Selecionar dia ${day}`}
                aria-pressed={isSelected}
                className={`p-1 border-b border-r border-slate-50 aspect-square flex flex-col items-center justify-center relative transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-inset
                  ${hasEvent ? 'cursor-pointer hover:bg-brand-50' : 'hover:bg-slate-50'}
                  ${isSelected ? 'bg-brand-50 ring-2 ring-brand-200 ring-inset' : ''}
                `}
              >
                <span className={`text-sm w-7 h-7 flex items-center justify-center rounded-full 
                  ${isToday && !isSelected ? 'bg-brand-600 text-white font-bold' : ''}
                  ${isSelected ? 'bg-brand-700 text-white font-bold' : 'text-slate-700'}
                `}>
                  {day}
                </span>
                {hasEvent && (
                  <div className="flex gap-0.5 mt-1">
                    {dayEvents.slice(0, 3).map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 bg-brand-500 rounded-full"></div>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
      
      {/* Selected Day Events List */}
      {selectedDate && (
        <div className="mt-6">
          <h3 className="font-semibold text-slate-800 mb-4">
            Eventos em {selectedDate.toLocaleDateString('pt-BR')}
          </h3>
          
          {selectedDayEvents && selectedDayEvents.length > 0 ? (
            <div className="space-y-4">
              {selectedDayEvents.map(item => (
                <EventCard key={item.evento.id} item={item} onClick={() => setSelectedEvent(item)} />
              ))}
            </div>
          ) : (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-100 text-slate-500 text-sm">
              Nenhum evento agendado para este dia.
            </div>
          )}
        </div>
      )}

      {selectedEvent && (
        <EventoDetalhe 
          item={selectedEvent} 
          onClose={() => setSelectedEvent(null)} 
          onRsvpUpdated={handleRsvpUpdated}
        />
      )}
      
      {loading && (
        <div className="text-center mt-4 text-xs text-slate-500">Atualizando...</div>
      )}
    </div>
  )
}
