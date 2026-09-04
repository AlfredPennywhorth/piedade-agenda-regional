import React from 'react'
import { AgendaItem } from './types'

interface EventCardProps {
  item: AgendaItem
  onClick: () => void
}

export function EventCard({ item, onClick }: EventCardProps) {
  const dateObj = new Date(item.evento.inicioEm)
  const day = String(dateObj.getDate()).padStart(2, '0')
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const year = dateObj.getFullYear()
  const time = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <button onClick={onClick} className="w-full text-left bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex gap-4 hover:bg-slate-50 transition-colors cursor-pointer">
      <div className="flex flex-col items-center justify-center bg-brand-50 text-brand-900 rounded-lg p-3 min-w-[70px]">
        <span className="text-2xl font-bold leading-none">{day}</span>
        <span className="text-xs uppercase font-semibold tracking-wider mt-1">{month}/{year}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-slate-900 truncate">{item.evento.titulo}</h3>
        <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {time}
        </p>
        
        <div className="mt-2 flex gap-2 flex-wrap">
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
            {item.evento.modalidade}
          </span>
          {item.local && (
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium truncate max-w-[120px]">
              {item.local.nome}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
