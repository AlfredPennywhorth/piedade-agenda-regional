import React, { useEffect, useState } from 'react'
import { fetchWithAuth } from '../../api/apiClient'
import { AgendaItem } from './types'
import { EventoDetalhe } from './EventoDetalhe'
import { EventCard } from './EventCard'

export function AgendaView() {
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null)

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
        <EventCard key={item.evento.id} item={item} onClick={() => setSelectedItem(item)} />
      ))}
      
      {selectedItem && (
        <EventoDetalhe item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  )

