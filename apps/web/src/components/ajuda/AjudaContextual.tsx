export function AjudaContextual() {
  return (
    <button
      type="button"
      className="m-2 rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-900"
      onClick={e =>
        window.dispatchEvent(new CustomEvent('abrir-ajuda-contextual', { detail: e.currentTarget }))
      }
    >
      Ajuda desta tela
    </button>
  )
}
