/** Formata datas civis dos controles date/datetime-local sem conversão para o fuso UTC do usuário. */
export function formatarDiaSemana(dataLocal: string): string {
  const data = dataLocal.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return ''
  const [ano, mes, dia] = data.split('-').map(Number)
  const instante = new Date(Date.UTC(ano, mes - 1, dia, 12))
  // Evita normalização silenciosa de datas inválidas, por exemplo 31/02.
  if (instante.getUTCFullYear() !== ano || instante.getUTCMonth() !== mes - 1 || instante.getUTCDate() !== dia) return ''
  const texto = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(instante)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
