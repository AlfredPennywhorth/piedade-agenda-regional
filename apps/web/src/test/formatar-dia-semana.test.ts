import { describe, expect, it } from 'vitest'
import { formatarDiaSemana } from '../utils/formatarDiaSemana'

describe('formatarDiaSemana', () => {
  it('mostra dia da semana e data em pt-BR para datetime-local', () => {
    expect(formatarDiaSemana('2026-11-10T19:00')).toBe('Terça-feira, 10 de novembro de 2026')
  })
  it('atualiza corretamente na virada de ano', () => {
    expect(formatarDiaSemana('2026-12-31')).toBe('Quinta-feira, 31 de dezembro de 2026')
    expect(formatarDiaSemana('2027-01-01')).toBe('Sexta-feira, 1 de janeiro de 2027')
  })
  it('não aceita valores ausentes ou inválidos', () => {
    expect(formatarDiaSemana('')).toBe('')
    expect(formatarDiaSemana('2026-02-31T19:00')).toBe('')
  })
})
