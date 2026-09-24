import { describe, expect, it } from 'vitest'
import { generateQrMatrix } from './qrGenerator'

describe('generateQrMatrix', () => {
  it('suporta payload de 78 bytes na versão 4-L', () => {
    const matrix = generateQrMatrix('x'.repeat(78))
    expect(matrix).toHaveLength(33)
    expect(matrix.every(row => row.length === 33)).toBe(true)
  })

  it('suporta payload de 83 bytes na versão 5-L', () => {
    const matrix = generateQrMatrix('x'.repeat(83))
    expect(matrix).toHaveLength(37)
    expect(matrix.every(row => row.length === 37)).toBe(true)
  })

  it('suporta URL beta típica de cadastro de convidado', () => {
    const url = 'https://beta.piedade-agenda-regional.pages.dev/c?p=' + 'A'.repeat(32)
    const matrix = generateQrMatrix(url)
    expect(matrix.length).toBeGreaterThanOrEqual(37)
  })
})
