import { useEffect, useRef } from 'react'

interface QrCodeModalProps {
  destinatarioId: string
  tituloEvento: string
  onClose: () => void
}

export function QrCodeModal({ destinatarioId, tituloEvento, onClose }: QrCodeModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (dialogRef.current) {
      dialogRef.current.showModal()
    }
  }, [])

  const handleClose = () => {
    if (dialogRef.current) {
      dialogRef.current.close()
    }
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleClose}
      className="p-0 rounded-xl shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm bg-white m-auto w-full max-w-sm overflow-hidden border border-slate-200 open:animate-in open:fade-in open:zoom-in-95"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qrcode-modal-titulo"
    >
      <div className="flex justify-between items-center bg-brand-900 text-white p-4 border-b border-brand-800">
        <h2 id="qrcode-modal-titulo" className="font-semibold text-base truncate pr-2">
          QR Code de Presença
        </h2>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-brand-800 rounded-full transition-colors flex-shrink-0"
          aria-label="Fechar QR Code"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-6 flex flex-col items-center text-center space-y-4">
        <p className="text-sm font-medium text-slate-700">{tituloEvento}</p>

        {/* Representação legível do QR Code opaco */}
        <div className="bg-slate-100 p-6 rounded-2xl border-2 border-slate-200 flex flex-col items-center justify-center w-56 h-56 shadow-inner">
          <svg className="w-36 h-36 text-slate-900" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm-2 12h8v8H2v-8zm2 2v4h4v-4H4zm12-16h8v8h-8V2zm2 2v4h4V4h-4zM4 11h2v2H4v-2zm4 0h2v2H8v-2zm-4 4h2v2H4v-2zm8-4h2v2h-2v-2zm4 0h2v2h-2v-2zm0 4h2v2h-2v-2zm-4 0h2v2h-2v-2zm4 4h2v2h-2v-2zm-4 0h2v2h-2v-2zm8-4h2v2h-2v-2zm0 4h2v2h-2v-2z" />
          </svg>
          <span className="mt-2 text-[10px] font-mono text-slate-500 tracking-tight break-all uppercase">
            {destinatarioId.substring(0, 18)}...
          </span>
        </div>

        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-lg text-xs leading-relaxed">
          Apresente este código na portaria para registrar sua presença no evento.
        </div>

        <button
          onClick={handleClose}
          className="w-full py-3 bg-brand-600 text-white font-medium rounded-lg text-sm hover:bg-brand-700 transition-colors"
        >
          Fechar
        </button>
      </div>
    </dialog>
  )
}
