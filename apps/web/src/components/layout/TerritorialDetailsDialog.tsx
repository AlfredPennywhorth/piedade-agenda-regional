import { useEffect, useId, useRef, type ReactNode } from 'react'

export function TerritorialDetailsDialog({
  titulo,
  onClose,
  children,
}: {
  titulo: string
  onClose: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const tituloId = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    const origem = document.activeElement as HTMLElement | null
    if (dialog?.showModal) dialog.showModal()
    else dialog?.setAttribute('open', '')
    return () => {
      dialog?.close?.()
      origem?.focus()
    }
  }, [])
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={tituloId}
      onCancel={e => {
        e.preventDefault()
        onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[85dvh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 sm:p-5 text-slate-800 shadow-xl backdrop:bg-slate-900/40 [overflow-wrap:anywhere]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
        <h3 id={tituloId} className="min-w-0 font-bold text-base">
          {titulo}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar detalhes"
          className="min-h-[44px] shrink-0 px-3 rounded-lg bg-slate-100 hover:bg-slate-200"
        >
          ✕
        </button>
      </div>
      {children}
    </dialog>
  )
}
