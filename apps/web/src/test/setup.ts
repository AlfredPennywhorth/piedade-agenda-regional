import '@testing-library/jest-dom'

// Polyfill mínimo para HTMLDialogElement no jsdom
// jsdom não implementa showModal() nem close() nativamente.
// Não remova: testes de EventoDetalhe dependem disso.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
    }
  }
} else {
  // jsdom pode não ter HTMLDialogElement; definir no window
  ;(window as any).HTMLDialogElement = class extends HTMLElement {
    showModal() {
      this.setAttribute('open', '')
    }
    close() {
      this.removeAttribute('open')
    }
  }
}
