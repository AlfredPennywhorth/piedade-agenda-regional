import { useEffect, useRef } from 'react'

export function useTerritorialFormNavigation(
  aberto: boolean,
  carregandoDetalhes: boolean,
  carregandoLista: boolean,
  fallbackId: string
) {
  const formRef = useRef<HTMLDivElement>(null)
  const origem = useRef<string | null>(null)
  const restaurar = useRef(false)

  useEffect(() => {
    if (!aberto || carregandoDetalhes) return
    const campo = formRef.current?.querySelector<HTMLElement>('input, select')
    campo?.focus({ preventScroll: true })
    formRef.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
  }, [aberto, carregandoDetalhes])

  useEffect(() => {
    if (aberto || carregandoLista || !restaurar.current) return
    const alvo =
      (origem.current ? document.getElementById(origem.current) : null) ??
      document.getElementById(fallbackId)
    alvo?.focus({ preventScroll: true })
    alvo?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' })
    restaurar.current = false
  }, [aberto, carregandoLista, fallbackId])

  return {
    formRef,
    guardarOrigem: (elemento: HTMLElement) => {
      origem.current = elemento.id
    },
    retornar: () => {
      restaurar.current = true
    },
  }
}
