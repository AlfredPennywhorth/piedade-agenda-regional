import { useEffect, useState } from 'react'

// Recarrega a aplicação quando o PWA assumir uma nova versão.
// A edição de formulários impede o reload automático para preservar dados digitados.
export function PwaAtualizacao() {
  const [novaVersao, setNovaVersao] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Marca apenas formulários de edição; filtros fora de <form> não bloqueiam atualizações.
    // O estado é mantido após submit: envio não comprova persistência da API.
    const formulariosPendentes = new Set<HTMLFormElement>()
    let atualizarEmAndamento = false
    let possuiControlador = Boolean(navigator.serviceWorker.controller)

    const marcarEdicao = (event: Event) => {
      const alvo = event.target
      if (!(alvo instanceof HTMLElement) ||
        !(alvo.matches('input, textarea, select') || alvo.isContentEditable)) return
      const formulario = alvo.closest('form')
      if (formulario) formulariosPendentes.add(formulario)
    }

    const podeRecarregar = () => {
      // A navegação ou o fechamento do formulário descarta sua edição pendente.
      // Não limpar no submit: validações/requisições assíncronas ainda podem falhar.
      for (const formulario of formulariosPendentes) {
        if (!formulario.isConnected) formulariosPendentes.delete(formulario)
      }
      return formulariosPendentes.size === 0 &&
        !document.querySelector('[role="dialog"], dialog[open]')
    }

    const aoTrocarControlador = () => {
      if (!possuiControlador) {
        possuiControlador = true
        return
      }
      if (atualizarEmAndamento) return
      atualizarEmAndamento = true
      if (podeRecarregar()) {
        window.location.reload()
      } else {
        setNovaVersao(true)
      }
    }

    const verificarAtualizacao = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const registro = await navigator.serviceWorker.getRegistration()
        await registro?.update()
      } catch {
        // Rede indisponível: a próxima verificação tentará novamente.
      }
    }

    document.addEventListener('input', marcarEdicao, true)
    document.addEventListener('change', marcarEdicao, true)
    navigator.serviceWorker.addEventListener('controllerchange', aoTrocarControlador)
    window.addEventListener('focus', verificarAtualizacao)
    document.addEventListener('visibilitychange', verificarAtualizacao)
    const intervalo = window.setInterval(verificarAtualizacao, 5 * 60 * 1000)
    void verificarAtualizacao()

    return () => {
      document.removeEventListener('input', marcarEdicao, true)
      document.removeEventListener('change', marcarEdicao, true)
      navigator.serviceWorker.removeEventListener('controllerchange', aoTrocarControlador)
      window.removeEventListener('focus', verificarAtualizacao)
      document.removeEventListener('visibilitychange', verificarAtualizacao)
      window.clearInterval(intervalo)
    }
  }, [])

  if (!novaVersao) return null
  return (
    <div role="status" className="fixed bottom-16 left-3 right-3 z-[100] mx-auto max-w-md rounded-lg border border-blue-300 bg-white p-4 shadow-xl">
      <p className="text-sm font-medium text-slate-900">Uma nova versão da Agenda está disponível.</p>
      <p className="mt-1 text-xs text-slate-600">Salve suas alterações antes de atualizar.</p>
      <button type="button" onClick={() => window.location.reload()}
        className="mt-3 rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
        Atualizar agora
      </button>
    </div>
  )
}
