import React, { useEffect, useRef } from 'react'
import { AgendaItem } from './types'

interface EventoDetalheProps {
  item: AgendaItem
  onClose: () => void
}

export function EventoDetalhe({ item, onClose }: EventoDetalheProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog) {
      dialog.showModal()
    }
  }, [])

  const handleClose = () => {
    if (dialogRef.current) {
      dialogRef.current.close()
    }
    onClose()
  }

  const dateObjInicio = new Date(item.evento.inicioEm)
  const dateObjFim = new Date(item.evento.fimEm)
  const dateStr = dateObjInicio.toLocaleDateString('pt-BR')
  const timeInicio = dateObjInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const timeFim = dateObjFim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const isOnlineOrHybrid = item.evento.modalidade === 'ONLINE' || item.evento.modalidade === 'HIBRIDO'
  const isPresentialOrHybrid = item.evento.modalidade === 'PRESENCIAL' || item.evento.modalidade === 'HIBRIDO'

  return (
    <dialog 
      ref={dialogRef}
      onCancel={handleClose}
      className="p-0 rounded-xl shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm bg-white m-auto w-full max-w-lg overflow-hidden border border-slate-200 open:animate-in open:fade-in open:zoom-in-95"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evento-detalhe-titulo"
    >
      <div className="flex justify-between items-center bg-brand-900 text-white p-4 border-b border-brand-800">
        <h2 id="evento-detalhe-titulo" className="font-semibold text-lg truncate pr-4">{item.evento.titulo}</h2>
        <button 
          onClick={handleClose}
          className="p-2 hover:bg-brand-800 rounded-full transition-colors flex-shrink-0"
          aria-label="Fechar detalhes"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-slate-800">
        
        <div className="flex gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Data e Hora</h3>
            <p className="font-medium text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              {dateStr}
            </p>
            <p className="text-slate-600 mt-1 flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {timeInicio} às {timeFim}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Modalidade</h3>
            <span className="inline-block px-3 py-1 bg-brand-50 text-brand-700 font-semibold rounded-lg text-sm">
              {item.evento.modalidade}
            </span>
          </div>
        </div>

        {isPresentialOrHybrid && item.local && (
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Local</h3>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <p className="font-semibold text-slate-900">{item.local.nome}</p>
              <p className="text-slate-600 text-sm mt-1">{item.local.endereco}</p>
              
              <div className="flex gap-2 mt-3 flex-wrap">
                {item.evento.urlMaps && (
                  <a href={item.evento.urlMaps} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                    Google Maps
                  </a>
                )}
                {item.evento.urlWaze && (
                  <a href={item.evento.urlWaze} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                    Waze
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {isOnlineOrHybrid && item.evento.urlOnline && (
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Link da Transmissão</h3>
            <a href={item.evento.urlOnline} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium bg-brand-50 text-brand-700 px-4 py-2 rounded-lg hover:bg-brand-100 transition-colors w-full justify-center">
              Acessar Transmissão Online
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          </div>
        )}

        {item.convocacao.observacoes && (
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Observações</h3>
            <div className="bg-amber-50 text-amber-900 border border-amber-200 rounded-lg p-4 text-sm whitespace-pre-wrap">
              {item.convocacao.observacoes}
            </div>
          </div>
        )}

      </div>
    </dialog>
  )
}
