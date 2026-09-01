export function normalizarCelular(celular: string | null | undefined): string | null {
  if (!celular) return null

  // Remove tudo que não for dígito
  const apenasDigitos = celular.replace(/\D/g, '')

  if (!apenasDigitos) return null

  // Celular brasileiro padrão (DDD + 9 dígitos) = 11 dígitos
  // Fixo brasileiro padrão (DDD + 8 dígitos) = 10 dígitos (embora esperado celular, vamos validar 10 ou 11)

  // Se tem 12 ou 13 dígitos e começa com 55, removemos o 55 do DDI
  if ((apenasDigitos.length === 12 || apenasDigitos.length === 13) && apenasDigitos.startsWith('55')) {
    const semDdi = apenasDigitos.substring(2)
    // Valida se o que sobrou é um DDD válido + número válido (10 ou 11 dígitos)
    if (semDdi.length === 10 || semDdi.length === 11) {
      return semDdi
    }
  }

  // Se já tem 10 ou 11 dígitos, consideramos nacional (mesmo que seja DDD 55 do RS)
  if (apenasDigitos.length === 10 || apenasDigitos.length === 11) {
    return apenasDigitos
  }

  // Se não se encaixa nas regras de normalização para convergência, não tentamos truncar/adivinhar.
  // Rejeita retornando null para o chamador tratar como inválido.
  return null
}
