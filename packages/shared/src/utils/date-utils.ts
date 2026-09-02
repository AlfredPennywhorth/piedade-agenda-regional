export function getSaoPauloDateString(dateIso: string): string {
  const d = new Date(dateIso)
  // Check valid date
  if (isNaN(d.getTime())) {
    throw new Error('Data inválida')
  }

  // Obter apenas a data no formato YYYY-MM-DD para o timezone de SP
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(d)
  const day = parts.find(p => p.type === 'day')?.value
  const month = parts.find(p => p.type === 'month')?.value
  const year = parts.find(p => p.type === 'year')?.value

  return `${year}-${month}-${day}`
}

export function isSameDayInSaoPaulo(dateIso1: string, dateIso2: string): boolean {
  try {
    const d1Str = getSaoPauloDateString(dateIso1)
    const d2Str = getSaoPauloDateString(dateIso2)
    return d1Str === d2Str
  } catch {
    return false
  }
}
