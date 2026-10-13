// Limites de datas civis da agenda, independentes do fuso UTC do banco.
const calendarioSaoPaulo = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit',
  day: '2-digit', calendar: 'gregory',
})

export function dataValidaRelatorio(valor: string | undefined): boolean {
  if (!valor) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  // Intl.DateTimeFormat usa ano de era, ambíguo na fronteira 0000/0001.
  if (valor.startsWith('0000-') || valor.startsWith('0001-')) return false
  const data = new Date(`${valor}T00:00:00.000Z`)
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor
}

function diaEmSaoPaulo(instante: number): string {
  const partes = Object.fromEntries(calendarioSaoPaulo.formatToParts(new Date(instante))
    .filter(parte => parte.type !== 'literal')
    .map(parte => [parte.type, parte.value]))
  return `${partes.year.padStart(4, '0')}-${partes.month}-${partes.day}`
}

export function inicioDiaSaoPauloUtc(dia: string): string {
  const meiaNoiteUtc = Date.parse(`${dia}T00:00:00.000Z`)
  if (!Number.isFinite(meiaNoiteUtc)) throw new RangeError('Data inválida')
  let menor = meiaNoiteUtc - 36 * 60 * 60 * 1000
  let maior = meiaNoiteUtc + 36 * 60 * 60 * 1000
  while (menor < maior) {
    const meio = menor + Math.floor((maior - menor) / 2)
    if (diaEmSaoPaulo(meio) < dia) menor = meio + 1
    else maior = meio
  }
  return new Date(menor).toISOString()
}

export function limiteFinalExclusivoSaoPauloUtc(dataFim: string): string {
  if (dataFim === '9999-12-31') throw new RangeError('Data final fora do intervalo')
  const proximoDia = new Date(`${dataFim}T00:00:00.000Z`)
  proximoDia.setUTCDate(proximoDia.getUTCDate() + 1)
  return inicioDiaSaoPauloUtc(proximoDia.toISOString().slice(0, 10))
}
