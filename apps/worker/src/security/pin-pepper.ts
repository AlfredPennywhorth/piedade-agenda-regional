import type { Env } from '../index'

export function obterPinPepper(env?: Partial<Env>): string {
  const configurado = env?.PIN_PEPPER
  if (configurado?.trim()) return configurado

  // Compatibilidade com a suíte de testes, que em alguns casos injeta apenas o DB.
  if (!env?.APP_ENV || env.APP_ENV === 'test') {
    return 'test-pepper'
  }

  throw new Error('PIN_PEPPER não configurado para este ambiente')
}
