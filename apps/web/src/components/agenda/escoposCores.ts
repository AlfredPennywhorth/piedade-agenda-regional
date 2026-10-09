import type { AgendaItem } from './types'

export function corEscopoEvento(item: AgendaItem) {
  if (item.evento.pessoal) return { nome: 'Pessoal', ponto: 'bg-slate-500', borda: 'border-l-slate-500', selo: 'bg-slate-100 text-slate-800' }
  if (item.evento.abrangencia === 'INTERNACIONAL') return { nome: 'Internacional', ponto: 'bg-fuchsia-600', borda: 'border-l-fuchsia-600', selo: 'bg-fuchsia-100 text-fuchsia-900' }
  if (item.evento.abrangencia === 'NACIONAL') return { nome: 'Nacional', ponto: 'bg-orange-600', borda: 'border-l-orange-600', selo: 'bg-orange-100 text-orange-900' }
  if (item.evento.grupoTrabalhoId) return { nome: 'Grupo de Trabalho', ponto: 'bg-teal-600', borda: 'border-l-teal-600', selo: 'bg-teal-100 text-teal-900' }
  if (item.evento.casaId) return { nome: 'Casa de Oração', ponto: 'bg-emerald-600', borda: 'border-l-emerald-600', selo: 'bg-emerald-100 text-emerald-900' }
  if (item.evento.setorId) return { nome: 'Setor', ponto: 'bg-sky-600', borda: 'border-l-sky-600', selo: 'bg-sky-100 text-sky-900' }
  if (item.evento.administracaoId) return { nome: 'Administração', ponto: 'bg-indigo-600', borda: 'border-l-indigo-600', selo: 'bg-indigo-100 text-indigo-900' }
  return { nome: 'Regional', ponto: 'bg-violet-600', borda: 'border-l-violet-600', selo: 'bg-violet-100 text-violet-900' }
}
export const legendaEscopos = [
  ['Pessoal', 'bg-slate-500'], ['Casa de Oração', 'bg-emerald-600'],
  ['Setor', 'bg-sky-600'], ['Administração', 'bg-indigo-600'],
  ['Regional', 'bg-violet-600'], ['Grupo de Trabalho', 'bg-teal-600'],
  ['Nacional', 'bg-orange-600'], ['Internacional', 'bg-fuchsia-600'],
] as const
