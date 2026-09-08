import { useEffect, useRef, useState } from 'react'
import { AgendaItem } from './types'
import * as apiClient from '../../api/apiClient'

interface EventoDetalheProps {
  item: AgendaItem
  onClose: () => void
  onRsvpUpdated?: (
    destinatarioId: string,
    rsvp: {
      resposta: 'PARTICIPAREI' | 'NAO_PARTICIPAREI' | 'NAO_SEI'
      justificativa?: string | null
      periodosParticipacao?: string[] | null
    }
  ) => void
}

export function EventoDetalhe({ item, onClose, onRsvpUpdated }: EventoDetalheProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  
  const [respostaLocal, setRespostaLocal] = useState<string | null>(item.rsvp?.resposta ?? null)
  const [ausenciaSelecionada, setAusenciaSelecionada] = useState(false)
  const [isEditingParticipacao, setIsEditingParticipacao] = useState(false)
  
  const [justificativa, setJustificativa] = useState(item.rsvp?.justificativa ?? '')
  const [periodosLocal, setPeriodosLocal] = useState<string[]>(item.rsvp?.periodosParticipacao ?? [])
  
  const [isLoadingRsvp, setIsLoadingRsvp] = useState(false)
  const [rsvpError, setRsvpError] = useState('')

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

  const handleRsvp = async (resposta: 'PARTICIPAREI' | 'NAO_PARTICIPAREI' | 'NAO_SEI', bypassEditCheck = false) => {
    if (resposta === 'NAO_PARTICIPAREI' && !justificativa.trim()) {
      setRsvpError('Justificativa é obrigatória para ausência.')
      return
    }

    const numPeriodos = [item.evento.possuiManha, item.evento.possuiTarde, item.evento.possuiNoite].filter(Boolean).length
    const exigePeriodo = numPeriodos > 1

    if (resposta === 'PARTICIPAREI' && !bypassEditCheck) {
      if (exigePeriodo) {
        setPeriodosLocal(item.rsvp?.periodosParticipacao ?? [])
        setIsEditingParticipacao(true)
        setAusenciaSelecionada(false)
        return
      }
    }

    // Se exige período e está confirmando
    if (resposta === 'PARTICIPAREI' && bypassEditCheck) {
      if (exigePeriodo && periodosLocal.length === 0) {
        setRsvpError('Por favor, selecione pelo menos um período de participação.')
        return
      }
    }

    setRsvpError('')
    setIsLoadingRsvp(true)

    try {
      const payload: any = {
        resposta,
        justificativa: resposta === 'NAO_PARTICIPAREI' ? justificativa : null
      }
      
      if (resposta === 'PARTICIPAREI') {
        if (periodosLocal.length > 0) payload.periodosParticipacao = periodosLocal
      }

      await apiClient.putWithAuth(`/minha-agenda/rsvp/${item.destinatarioId}`, payload)
      
      const rsvpAtualizado = {
        resposta,
        justificativa: resposta === 'NAO_PARTICIPAREI' ? justificativa : null,
        periodosParticipacao: resposta === 'PARTICIPAREI' ? (periodosLocal.length > 0 ? periodosLocal : null) : null
      }
      
      setRespostaLocal(resposta)
      if (onRsvpUpdated) {
        onRsvpUpdated(item.destinatarioId, rsvpAtualizado)
      }
      if (resposta !== 'NAO_PARTICIPAREI') {
        setJustificativa('')
      }
      if (resposta !== 'PARTICIPAREI') {
        setPeriodosLocal([])
      }
      
      setAusenciaSelecionada(false)
      setIsEditingParticipacao(false)
    } catch (err: any) {
      setRsvpError(err.message || 'Erro ao registrar resposta.')
    } finally {
      setIsLoadingRsvp(false)
    }
  }

  const handlePeriodoToggle = (periodo: string) => {
    setPeriodosLocal(prev => 
      prev.includes(periodo) ? prev.filter(p => p !== periodo) : [...prev, periodo]
    )
  }

  const getRefeicaoLabel = (tipo: string) => {
    switch(tipo) {
      case 'CAFE_MANHA': return 'Café da manhã'
      case 'ALMOCO': return 'Almoço'
      case 'LANCHE': return 'Lanche'
      case 'JANTAR': return 'Jantar'
      default: return tipo
    }
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

        <div className="border-t border-slate-100 pt-6 pb-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Sua Participação</h3>
            {respostaLocal === 'PARTICIPAREI' && <span className="text-xs font-bold px-2 py-1 bg-green-100 text-green-700 rounded uppercase">Confirmado</span>}
            {respostaLocal === 'NAO_PARTICIPAREI' && <span className="text-xs font-bold px-2 py-1 bg-red-100 text-red-700 rounded uppercase">Ausente</span>}
            {respostaLocal === 'NAO_SEI' && <span className="text-xs font-bold px-2 py-1 bg-slate-200 text-slate-700 rounded uppercase">Pendente</span>}
          </div>

          {dateObjInicio <= new Date() ? (
            <div className="bg-slate-50 text-slate-600 p-4 rounded-lg text-sm text-center">
              Resposta bloqueada após início do evento
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => handleRsvp('PARTICIPAREI')}
                  disabled={isLoadingRsvp}
                  className={`flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-colors border ${
                    (respostaLocal === 'PARTICIPAREI' || isEditingParticipacao)
                      ? 'bg-green-50 border-green-200 text-green-700' 
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  ✓ Vou participar
                </button>
                <button
                  onClick={() => { setIsEditingParticipacao(false); handleRsvp('NAO_SEI') }}
                  disabled={isLoadingRsvp}
                  className={`flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-colors border ${
                    respostaLocal === 'NAO_SEI' && !isEditingParticipacao
                      ? 'bg-slate-100 border-slate-300 text-slate-800' 
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  ? Não sei ainda
                </button>
              </div>
              
              {isEditingParticipacao && (
                <div className="p-4 bg-green-50/50 border border-green-100 rounded-lg animate-in slide-in-from-top-2">
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Período de participação *</h4>
                    <div className="flex flex-col gap-2">
                      {item.evento.possuiManha && (
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input type="checkbox" value="MANHA" 
                            checked={periodosLocal.includes('MANHA')}
                            onChange={() => handlePeriodoToggle('MANHA')}
                            className="rounded text-green-600 focus:ring-green-500" />
                          Manhã
                        </label>
                      )}
                      {item.evento.possuiTarde && (
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input type="checkbox" value="TARDE" 
                            checked={periodosLocal.includes('TARDE')}
                            onChange={() => handlePeriodoToggle('TARDE')}
                            className="rounded text-green-600 focus:ring-green-500" />
                          Tarde
                        </label>
                      )}
                      {item.evento.possuiNoite && (
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input type="checkbox" value="NOITE" 
                            checked={periodosLocal.includes('NOITE')}
                            onChange={() => handlePeriodoToggle('NOITE')}
                            className="rounded text-green-600 focus:ring-green-500" />
                          Noite
                        </label>
                      )}
                    </div>
                  </div>



                  <button
                    onClick={() => handleRsvp('PARTICIPAREI', true)}
                    disabled={isLoadingRsvp}
                    className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    {isLoadingRsvp ? 'Salvando...' : 'Confirmar Participação'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingParticipacao(false)
                      setPeriodosLocal(item.rsvp?.periodosParticipacao ?? [])
                    }}
                    disabled={isLoadingRsvp}
                    className="w-full mt-2 py-2 text-slate-500 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              <div className="pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <input 
                    type="radio" 
                    id="radio-nao-vou" 
                    checked={ausenciaSelecionada || (respostaLocal === 'NAO_PARTICIPAREI' && !isEditingParticipacao)}
                    onChange={() => { setAusenciaSelecionada(true); setIsEditingParticipacao(false) }}
                    disabled={isLoadingRsvp}
                    className="w-4 h-4 text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="radio-nao-vou" className="text-sm font-medium text-slate-700 cursor-pointer">
                    ✗ Não vou participar
                  </label>
                </div>

                {(ausenciaSelecionada || (respostaLocal === 'NAO_PARTICIPAREI' && !isEditingParticipacao)) && (
                  <div className="pl-6 animate-in slide-in-from-top-2">
                    <textarea
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      placeholder="Por favor, justifique sua ausência..."
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      rows={2}
                      disabled={isLoadingRsvp}
                    />
                    <button
                      onClick={() => handleRsvp('NAO_PARTICIPAREI')}
                      disabled={isLoadingRsvp}
                      className="mt-2 w-full py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      {isLoadingRsvp ? 'Salvando...' : 'Confirmar Ausência'}
                    </button>
                  </div>
                )}
              </div>

              {rsvpError && (
                <div className="text-red-600 text-sm mt-2 font-medium bg-red-50 p-2 rounded">
                  {rsvpError}
                </div>
              )}
            </div>
          )}
        </div>

        {item.evento.refeicoesOferecidas && item.evento.refeicoesOferecidas.length > 0 && (
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Alimentação Oferecida</h3>
            <div className="bg-slate-50 text-slate-700 border border-slate-100 rounded-lg p-4 text-sm">
              <ul className="list-disc pl-5">
                {item.evento.refeicoesOferecidas.map(tipo => (
                  <li key={tipo}>{getRefeicaoLabel(tipo)}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </dialog>
  )
}
