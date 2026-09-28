import { describe, expect, it } from 'vitest'
import { montarCsv } from '../utils/csv'

describe('REL-PRES-04 — exportação CSV', () => {
  it('gera CSV com BOM, ponto e vírgula e escape de aspas', () => {
    const csv = montarCsv(
      ['Nome', 'Situação'],
      [
        ['Ana', 'PRESENTE'],
        ['João "Júnior"', 'AUSENTE'],
      ]
    )

    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('"Nome";"Situação"')
    expect(csv).toContain('"Ana";"PRESENTE"')
    expect(csv).toContain('"João ""Júnior""";"AUSENTE"')
  })

  it('converte valores nulos em células vazias', () => {
    const csv = montarCsv(['Nome', 'RSVP'], [['Ana', null]])
    expect(csv).toContain('"Ana";""')
  })
})
