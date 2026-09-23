import { AgendaItem } from './types'

interface EventCardProps {
  item: AgendaItem
  onClick: () => void
}

function statusParticipacao(item: AgendaItem) {
  switch (item.rsvp?.resposta) {
    case 'PARTICIPAREI':
      return { label: 'Confirmado', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'NAO_PARTICIPAREI':
      return { label: 'Não participarei', className: 'bg-red-50 text-red-700 border-red-200' }
    case 'NAO_SEI':
      return { label: 'Ainda não sei', className: 'bg-amber-50 text-amber-700 border-amber-200' }
    default:
      return { label: 'Aguardando resposta', className: 'bg-slate-50 text-slate-600 border-slate-200' }
  }
}

export function EventCard({ item, onClick }: EventCardProps) {
  const inicio = new Date(item.evento.inicioEm)
  const fim = new Date(item.evento.fimEm)
  const day = String(inicio.getDate()).padStart(2, '0')
  const month = String(inicio.getMonth() + 1).padStart(2, '0')
  const year = inicio.getFullYear()
  const weekday = inicio.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  const timeInicio = inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const timeFim = fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const status = statusParticipacao(item)

  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-300"
    >
      <div className="flex gap-4">
        <div className="flex min-w-[74px] flex-col items-center justify-center rounded-xl bg-brand-50 px-3 py-3 text-brand-900">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">{weekday}</span>
          <span className="text-2xl font-bold leading-none">{day}</span>
          <span className="mt-1 text-xs font-semibold">{month}/{year}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <h3 className="font-semibold leading-snug text-slate-900">{item.evento.titulo}</h3>
            <span className={`inline-flex w-fit shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${status.className}`}>
              {status.label}
            </span>
          </div>

          <div className="mt-2 space-y-1.5 text-sm text-slate-600">
            <p className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{timeInicio} às {timeFim}</span>
            </p>

            {item.local && (
              <p className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{item.local.nome}</span>
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
              {item.evento.modalidade}
            </span>
            <span className="text-[11px] font-medium text-brand-700">Ver detalhes</span>
          </div>
        </div>
      </div>
    </button>
  )
}
