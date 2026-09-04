import React, { useEffect, useState } from 'react'
import { fetchWithAuth } from '../../api/apiClient'

interface AgendaItem {
  evento: {
    id: string
    titulo: string
    inicioEm: string
    fimEm: string
    modalidade: 'PRESENCIAL' | 'ONLINE' | 'HIBRIDO'
    urlOnline?: string | null
    urlMaps?: string | null
    urlWaze?: string | null
  }
  convocacao: {
    id: string
    observacoes: string | null
  }
  local: {
    nome: string
    endereco: string
  } | null
}

export function AgendaView() {
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchWithAuth('/minha-agenda')
        
        // Filter out past events based on local time
        const now = new Date()
        const upcoming = data.filter((item: AgendaItem) => new Date(item.evento.fimEm) > now)
        
        setItems(upcoming)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 m-4 bg-red-50 text-red-600 rounded-lg text-sm text-center">
        {error}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        <p>Você não possui eventos futuros agendados.</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {items.map((item) => (
        <EventCard key={item.evento.id} item={item} />
      ))}
    </div>
  )
}

function EventCard({ item }: { item: AgendaItem }) {
  const dateObj = new Date(item.evento.inicioEm)
  const day = String(dateObj.getDate()).padStart(2, '0')
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const year = dateObj.getFullYear()
  const time = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex gap-4 active:bg-slate-50 transition-colors cursor-pointer">
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
    </div>
  )
}
