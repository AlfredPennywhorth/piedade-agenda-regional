/**
 * Normaliza um número de celular removendo todos os caracteres não numéricos.
 * Retorna uma string contendo apenas os dígitos (0-9).
 * 
 * @param celular Número de telefone com formatação (ex: (11) 98765-4321)
 * @returns Número apenas com dígitos (ex: 11987654321)
 */
export function normalizarCelular(celular: string | undefined | null): string {
  if (!celular) return ''
  return celular.replace(/\D/g, '')
}
