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


function obterPartesNoFuso(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(date)
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(part => part.type === tipo)?.value)

  return {
    year: valor('year'),
    month: valor('month'),
    day: valor('day'),
    hour: valor('hour'),
    minute: valor('minute'),
    second: valor('second'),
  }
}

function converterHorarioLocalParaUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const localComoUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  let instanteUtc = localComoUtc

  // Duas iterações acomodam mudanças históricas de offset do fuso (ex.: horário de verão).
  for (let i = 0; i < 2; i++) {
    const partes = obterPartesNoFuso(new Date(instanteUtc), timeZone)
    const representacaoUtc = Date.UTC(
      partes.year,
      partes.month - 1,
      partes.day,
      partes.hour,
      partes.minute,
      partes.second
    )
    const offset = representacaoUtc - instanteUtc
    instanteUtc = localComoUtc - offset
  }

  return new Date(instanteUtc)
}

export function getSaoPauloEndOfDayIso(dateIso: string): string {
  const dataSaoPaulo = getSaoPauloDateString(dateIso)
  const [year, month, day] = dataSaoPaulo.split('-').map(Number)

  if (!year || !month || !day) {
    throw new Error('Data inválida')
  }

  return converterHorarioLocalParaUtc(
    year,
    month,
    day,
    23,
    59,
    59,
    'America/Sao_Paulo'
  ).toISOString()
}
