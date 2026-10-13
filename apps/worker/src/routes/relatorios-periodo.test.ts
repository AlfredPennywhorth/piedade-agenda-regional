import { describe, expect, it } from 'vitest'
import { dataValidaRelatorio, inicioDiaSaoPauloUtc, limiteFinalExclusivoSaoPauloUtc } from './relatorios-periodo'

describe('limites civis dos relatórios em America/Sao_Paulo', () => {
  it('aplica UTC-03 nas datas atuais, inclusive no fim exclusivo', () => {
    expect(inicioDiaSaoPauloUtc('2026-10-01')).toBe('2026-10-01T03:00:00.000Z')
    expect(limiteFinalExclusivoSaoPauloUtc('2026-10-01')).toBe('2026-10-02T03:00:00.000Z')
  })
  it('aplica UTC-02 no horário de verão histórico', () => {
    expect(inicioDiaSaoPauloUtc('2018-01-15')).toBe('2018-01-15T02:00:00.000Z')
  })
  it('encontra o primeiro horário válido do dia de transição sem meia-noite', () => {
    expect(inicioDiaSaoPauloUtc('2018-11-04')).toBe('2018-11-04T03:00:00.000Z')
    expect(limiteFinalExclusivoSaoPauloUtc('2018-11-03')).toBe('2018-11-04T03:00:00.000Z')
  })
  it('preserva anos inferiores a 0100 sem normalizar para 1900', () => {
    expect(dataValidaRelatorio('0002-01-01')).toBe(true)
    expect(inicioDiaSaoPauloUtc('0002-01-01').startsWith('0002-')).toBe(true)
  })
  it('rejeita anos ambíguos e datas inválidas', () => {
    expect(dataValidaRelatorio('0000-01-01')).toBe(false)
    expect(dataValidaRelatorio('0001-01-01')).toBe(false)
    expect(dataValidaRelatorio('2026-02-30')).toBe(false)
    expect(dataValidaRelatorio('2026-10-01')).toBe(true)
  })
  it('não permite o limite final do calendário ISO de quatro dígitos', () => {
    expect(() => limiteFinalExclusivoSaoPauloUtc('9999-12-31')).toThrow(RangeError)
  })
})
