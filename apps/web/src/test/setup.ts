import '@testing-library/jest-dom'

// Polyfill mínimo para HTMLDialogElement no jsdom.
// jsdom define showModal()/close() como stubs que lançam "Not implemented".
// Sobrescrevemos incondicionalmente para que o atributo `open` seja gerenciado
// corretamente e getByRole('dialog') encontre o elemento.
// Não remova: testes de EventoDetalhe dependem disso.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '')
}
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open')
}
