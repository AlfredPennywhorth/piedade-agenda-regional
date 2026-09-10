import { useEffect, useRef, useMemo } from 'react'
import { generateQrMatrix } from './qrGenerator'

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

  // Gera a matriz QR codificando exatamente o destinatarioId
  const matrix = useMemo(() => {
    return generateQrMatrix(destinatarioId)
  }, [destinatarioId])

  const size = matrix.length

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

        {/* QR Code SVG dinâmico codificando destinatarioId */}
        <div
          className="bg-white p-4 rounded-2xl border-2 border-slate-200 flex flex-col items-center justify-center shadow-inner"
          data-testid="qrcode-canvas"
          data-qr-payload={destinatarioId}
        >
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-48 h-48 bg-white"
            shapeRendering="crispEdges"
            role="img"
            aria-label={`QR Code para o destinatário ${destinatarioId}`}
          >
            {matrix.map((row, r) =>
              row.map((cell, c) =>
                cell ? (
                  <rect
                    key={`${r}-${c}`}
                    x={c}
                    y={r}
                    width={1}
                    height={1}
                    fill="#000000"
                  />
                ) : null
              )
            )}
          </svg>
          <span className="mt-2 text-[10px] font-mono text-slate-500 tracking-tight break-all uppercase">
            {destinatarioId}
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
