export type RecurrenceType = 'DIARIA' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL_DIA_FIXO' | 'MENSAL_POSICAO_SEMANA'

export interface RecurrenceInput {
  frequencia: RecurrenceType
  intervalo: number
  dataInicio: string // YYYY-MM-DD
  dataFim: string // YYYY-MM-DD
  horarioInicio: string // HH:MM
  horarioFim: string // HH:MM
  diaSemana?: number | null // 0-6
  diaMes?: number | null // 1-31
  posicaoSemanaMes?: number | null // 1-5 or -1
}

export interface RecurrenceOccurrence {
  inicioEm: string // ISO 8601 UTC
  fimEm: string // ISO 8601 UTC
}

/**
 * Cria uma data UTC a partir de YYYY-MM-DD, HH:MM iterando reversamente a partir de um alvo no fuso America/Sao_Paulo
 * utilizando APIs nativas (Intl.DateTimeFormat) para resolver a defasagem real (inclusive com DST histórico).
 */
export function createUtcDateFromSaoPaulo(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)
  const targetLocalMs = Date.UTC(year, month - 1, day, hour, minute, 0)
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false
  })
  
  const parts = formatter.formatToParts(new Date(targetLocalMs))
  const p: any = {}
  parts.forEach(part => p[part.type] = part.value)
  
  let parsedHour = Number(p.hour)
  // Alguns motores Node formatam 00:00 como 24:00 quando hour12: false
  if (parsedHour === 24) parsedHour = 0
  
  const guessLocalMs = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), parsedHour, Number(p.minute), Number(p.second))
  
  const offsetMs = guessLocalMs - targetLocalMs
  const trueUtcMs = targetLocalMs - offsetMs
  return new Date(trueUtcMs).toISOString()
}

/**
 * Extrai a data local (YYYY-MM-DD) correspondente a um timestamp UTC no fuso America/Sao_Paulo.
 */
export function getLocalDateFromUtc(utcIso: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  })
  
  const parts = formatter.formatToParts(new Date(utcIso))
  const p: any = {}
  parts.forEach(part => p[part.type] = part.value)
  
  return `${p.year}-${p.month}-${p.day}`
}

/**
 * Retorna o dia da semana (0 = Domingo, 6 = Sábado) de uma data YYYY-MM-DD.
 */
function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  // Date constructor with year, month (0-indexed), day evaluates in local time,
  // but if we use UTC methods we avoid timezone shifts.
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCDay()
}

/**
 * Soma N dias a uma data YYYY-MM-DD e retorna uma nova YYYY-MM-DD.
 */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  const iso = dt.toISOString()
  return iso.split('T')[0]
}

/**
 * Adiciona N meses a uma data e tenta preservar o dia.
 * Se o dia for maior que o último dia do mês destino, ele volta pro último dia?
 * A instrução diz: SE o dia solicitado não existir naquele mês, NÃO criar ocorrência naquele mês.
 * Entao nós não arredondamos para trás.
 */
function addMonthsExactDay(dateStr: string, months: number, targetDay: number): string | null {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 + months, 1))
  const newY = dt.getUTCFullYear()
  const newM = dt.getUTCMonth()
  
  // Find last day of new month
  const lastDay = new Date(Date.UTC(newY, newM + 1, 0)).getUTCDate()
  if (targetDay > lastDay) {
    return null // Day does not exist in this month
  }
  
  return `${newY}-${String(newM + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`
}

function getPositionalDayOfMonth(year: number, month: number, targetDayOfWeek: number, position: number): string | null {
  let count = 0
  let lastMatchingDate: string | null = null
  
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  
  for (let day = 1; day <= lastDay; day++) {
    const dt = new Date(Date.UTC(year, month - 1, day))
    if (dt.getUTCDay() === targetDayOfWeek) {
      count++
      const dtStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      lastMatchingDate = dtStr
      if (count === position) {
        return dtStr
      }
    }
  }
  
  if (position === -1) {
    return lastMatchingDate
  }
  
  return null
}

export function generateOccurrences(input: RecurrenceInput): RecurrenceOccurrence[] {
  const occurrences: RecurrenceOccurrence[] = []
  
  let currentDate = input.dataInicio
  const endDate = input.dataFim
  const interval = input.intervalo || 1
  
  if (currentDate > endDate) {
    return []
  }

  // Pre-calculate target day of week for SEMANAL / QUINZENAL / MENSAL_POSICAO
  const targetDow = input.diaSemana ?? 0
  
  if (input.frequencia === 'DIARIA') {
    while (currentDate <= endDate) {
      occurrences.push({
        inicioEm: createUtcDateFromSaoPaulo(currentDate, input.horarioInicio),
        fimEm: createUtcDateFromSaoPaulo(currentDate, input.horarioFim)
      })
      currentDate = addDays(currentDate, interval)
    }
  } 
  else if (input.frequencia === 'SEMANAL' || input.frequencia === 'QUINZENAL') {
    const actualIntervalDays = input.frequencia === 'QUINZENAL' ? 14 : (7 * interval)
    
    // Find the first occurrence that matches the target day of week
    while (getDayOfWeek(currentDate) !== targetDow && currentDate <= endDate) {
      currentDate = addDays(currentDate, 1)
    }
    
    while (currentDate <= endDate) {
      occurrences.push({
        inicioEm: createUtcDateFromSaoPaulo(currentDate, input.horarioInicio),
        fimEm: createUtcDateFromSaoPaulo(currentDate, input.horarioFim)
      })
      currentDate = addDays(currentDate, actualIntervalDays)
    }
  }
  else if (input.frequencia === 'MENSAL_DIA_FIXO') {
    const targetDay = input.diaMes ?? 1
    const [y, m] = currentDate.split('-').map(Number)
    let monthsToAdd = 0
    
    while (true) {
      const candidateDate = addMonthsExactDay(currentDate, monthsToAdd, targetDay)
      if (candidateDate) {
        if (candidateDate > endDate) break
        if (candidateDate >= input.dataInicio) {
          occurrences.push({
            inicioEm: createUtcDateFromSaoPaulo(candidateDate, input.horarioInicio),
            fimEm: createUtcDateFromSaoPaulo(candidateDate, input.horarioFim)
          })
        }
      } else {
        // If candidateDate is null, this specific month does not have the day (e.g. Feb 31st).
        // The rule says we skip the occurrence this month, so we just continue.
        // We still need to check if the hypotetical next month would surpass endDate.
        const fakeDate = new Date(Date.UTC(y, m - 1 + monthsToAdd, 1))
        const fY = fakeDate.getUTCFullYear()
        const fM = fakeDate.getUTCMonth() + 1
        if (`${fY}-${String(fM).padStart(2, '0')}-01` > endDate) {
          break
        }
      }
      monthsToAdd += interval
    }
  }
  else if (input.frequencia === 'MENSAL_POSICAO_SEMANA') {
    const position = input.posicaoSemanaMes ?? 1
    const [y, m] = currentDate.split('-').map(Number)
    let monthsToAdd = 0
    
    while (true) {
      const dt = new Date(Date.UTC(y, m - 1 + monthsToAdd, 1))
      const targetY = dt.getUTCFullYear()
      const targetM = dt.getUTCMonth() + 1
      
      const candidateDate = getPositionalDayOfMonth(targetY, targetM, targetDow, position)
      
      if (candidateDate) {
        if (candidateDate > endDate) break
        if (candidateDate >= input.dataInicio) {
          occurrences.push({
            inicioEm: createUtcDateFromSaoPaulo(candidateDate, input.horarioInicio),
            fimEm: createUtcDateFromSaoPaulo(candidateDate, input.horarioFim)
          })
        }
      } else {
        if (`${targetY}-${String(targetM).padStart(2, '0')}-01` > endDate) {
          break
        }
      }
      monthsToAdd += interval
    }
  }

  return occurrences
}
