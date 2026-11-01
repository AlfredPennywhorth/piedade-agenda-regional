import { describe, expect, it } from 'vitest'
import { gerarListaPresencaPdf } from './lista-presenca-pdf'

const dados = {
  titulo: 'Reunião de Atendimento da Obra da Piedade',
  local: 'Bom Retiro - São Paulo/SP',
  endereco: 'Rua Anhaia, 613 - Bom Retiro - São Paulo/SP',
  cnpj: '61.526.398/0004-31',
  inicio: '05/09/2026, 06:05',
  fim: '05/09/2026, 06:35',
  emitidoEm: '05/09/2026, 12:15',
}

describe('Lista de Presença em PDF', () => {
  it('emite PDF A4 válido com cabeçalho institucional, CNPJ e apenas presentes', () => {
    const buffer = gerarListaPresencaPdf({ ...dados, linhas: [
      { nome: 'João da Silva', funcao: 'Diácono', entrada: '05/09/2026, 06:07' },
      { nome: 'Maria Oliveira', funcao: 'Secretaria', entrada: '05/09/2026, 06:09' },
    ] })
    const pdf = new TextDecoder().decode(buffer)
    expect(pdf.startsWith('%PDF-1.4')).toBe(true)
    expect(pdf).toContain('61.526.398/0004-31')
    expect(pdf).toContain('Bom Retiro')
    expect(pdf).toContain('P')
    expect((pdf.match(/\/Type \/Page \/Parent/g) || []).length).toBe(1)
    expect(pdf).toContain('startxref')
  })

  it('pagina listas extensas sem página extra em branco', () => {
    const linhas = Array.from({ length: 180 }, (_, i) => ({
      nome: `Participante ${String(i + 1).padStart(3, '0')} de uma localidade institucional`,
      funcao: 'Diácono',
      entrada: '05/09/2026, 06:08',
    }))
    const pdf = new TextDecoder().decode(gerarListaPresencaPdf({ ...dados, linhas }))
    const paginas = (pdf.match(/\/Type \/Page \/Parent/g) || []).length
    expect(paginas).toBeGreaterThan(2)
    expect(pdf).toContain(` /Count ${paginas} `)
    expect(pdf).toContain(`P\\341g. ${paginas}/${paginas}`)
  })

  it('codifica caracteres acentuados sem gerar bytes inválidos', () => {
    const pdf = new TextDecoder().decode(gerarListaPresencaPdf({ ...dados, linhas: [
      { nome: 'José Antônio', funcao: 'Ancião', entrada: '05/09/2026, 06:08' },
    ] }))
    expect(pdf).toContain('Jos\\351')
    expect(pdf).toContain('Anci\\343o')
  })
})
