export function AjudaContextual() {
  return (
    <button
      type="button"
      className="m-2 rounded-lg border px-3 py-2 text-sm font-semibold"
      onClick={e =>
        window.dispatchEvent(new CustomEvent('abrir-ajuda-contextual', { detail: e.currentTarget }))
      }
    >
      Ajuda desta tela
    </button>
  )
}
