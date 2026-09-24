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
  const alvoLocalNoMinuto = Date.UTC(year, month - 1, day, hour, minute, 0)
  const janelaInicio = alvoLocalNoMinuto - 15 * 60 * 60 * 1000
  const janelaFim = alvoLocalNoMinuto + 15 * 60 * 60 * 1000
  const correspondencias: number[] = []

  // Procura todas as ocorrências possíveis do horário local em passos de 1 minuto,
  // sempre alinhadas em :00 para depois aplicar os segundos desejados.
  for (let instante = janelaInicio; instante <= janelaFim; instante += 60 * 1000) {
    const partes = obterPartesNoFuso(new Date(instante), timeZone)
    if (
      partes.year === year &&
      partes.month === month &&
      partes.day === day &&
      partes.hour === hour &&
      partes.minute === minute
    ) {
      correspondencias.push(instante + second * 1000)
    }
  }

  if (correspondencias.length === 0) {
    throw new Error('Horário local inválido para o fuso informado')
  }

  return new Date(Math.max(...correspondencias))
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
