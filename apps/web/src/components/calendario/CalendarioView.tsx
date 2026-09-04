import React, { useState, useEffect } from 'react'
import { fetchWithAuth } from '../../api/apiClient'

export function CalendarioView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
  }, {} as Record<string, any[]>)

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
            const key = `${year}-${month}-${day}`
            const dayEvents = eventsByDay[key] || []
            const hasEvent = dayEvents.length > 0
            
            return (
              <div 
                key={day} 
                className={`p-1 border-b border-r border-slate-50 aspect-square flex flex-col items-center justify-center relative ${hasEvent ? 'cursor-pointer hover:bg-brand-50' : ''}`}
              >
                <span className={`text-sm w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-brand-600 text-white font-bold' : 'text-slate-700'}`}>
                  {day}
                </span>
                {hasEvent && (
                  <div className="flex gap-0.5 mt-1">
                    {dayEvents.slice(0, 3).map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 bg-brand-500 rounded-full"></div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      
      {loading && (
        <div className="text-center mt-4 text-xs text-slate-500">Atualizando...</div>
      )}
    </div>
  )
}
