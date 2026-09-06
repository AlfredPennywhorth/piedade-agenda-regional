import { useState, useEffect } from 'react'
import { fetchWithAuth } from '../../api/apiClient'
import { AgendaItem } from '../agenda/types'
import { EventCard } from '../agenda/EventCard'
import { EventoDetalhe } from '../agenda/EventoDetalhe'

export function CalendarioView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDayEvents, setSelectedDayEvents] = useState<AgendaItem[] | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<AgendaItem | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchWithAuth('/minha-agenda')
        setItems(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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

  // Get events mapped by day string YYYY-MM-DD
  const eventsByDay = items.reduce((acc, item) => {
    const evDate = new Date(item.evento.inicioEm)
    const key = `${evDate.getFullYear()}-${evDate.getMonth()}-${evDate.getDate()}`
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<string, AgendaItem[]>)

  const handleDayClick = (day: number, dayEvents: AgendaItem[]) => {
    setSelectedDate(new Date(year, month, day))
    setSelectedDayEvents(dayEvents)
  }

  return (
    <div className="p-4">
      
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
        <EventoDetalhe item={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
      
      {loading && (
        <div className="text-center mt-4 text-xs text-slate-500">Atualizando...</div>
      )}
    </div>
  )
}
