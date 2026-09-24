import { describe, expect, it } from 'vitest'
import { getSaoPauloEndOfDayIso } from './date-utils'

describe('date-utils — fim do dia em São Paulo', () => {
  it('usa UTC-03 em data atual sem horário de verão', () => {
    expect(getSaoPauloEndOfDayIso('2026-09-23T15:00:00.000Z'))
      .toBe('2026-09-24T02:59:59.000Z')
  })

  it('respeita UTC-02 em período histórico de horário de verão', () => {
    expect(getSaoPauloEndOfDayIso('2018-12-01T15:00:00.000Z'))
      .toBe('2018-12-02T01:59:59.000Z')
  })
})
