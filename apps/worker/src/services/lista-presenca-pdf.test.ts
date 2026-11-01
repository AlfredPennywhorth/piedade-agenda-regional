import { describe, expect, it } from 'vitest'
import { gerarListaPresencaPdf } from './lista-presenca-pdf'

const dados = {
  titulo: 'Reunião de Atendimento da Obra da Piedade',
  local: 'Bom Retiro - São Paulo/SP',
  endereco: 'Rua Anhaia, 613 - Bom Retiro - São Paulo/SP',
  cnpj: '61.526.398/0004-31',
  inicio: '05/09/2026, 06:10:00',
  fim: '05/09/2026, 09:00:00',
  emitidoEm: '31/10/2026, 17:30:53',
}

function textoPdf(linhas: Array<{ nome: string; funcao: string; entrada: string }>, sobrescrever = {}) {
  return new TextDecoder().decode(gerarListaPresencaPdf({ ...dados, ...sobrescrever, linhas }))
}

describe('Lista de Presença em PDF — modelo institucional SIGA', () => {
  it('mantém A4, cabeçalho centralizado, colunas SIGA e rodapé Folha', () => {
    const pdf = textoPdf([
      { nome: 'Telma Gabriel Alves Campos', funcao: 'Irmã da Obra da Piedade', entrada: '05/09/2026, 06:26:57' },
    ])
    expect(pdf.startsWith('%PDF-1.4')).toBe(true)
    expect(pdf).toContain('/MediaBox [0 0 595 842]')
    expect(pdf).toContain('/BaseFont /Courier /')
    expect(pdf).toContain('/BaseFont /Courier-Bold /')
    expect(pdf).toContain('CONGREGA\\307\\303O CRIST\\303 NO BRASIL')
    expect(pdf).toContain('S\\303O PAULO - SP')
    expect(pdf).toContain('CNPJ 61.526.398/0004-31')
    expect(pdf).toContain('NOME')
    expect(pdf).toContain('MINIST\\311RIO/FUN\\307\\303O')
    expect(pdf).toContain('HOR\\301RIO DE ENTRADA')
    expect(pdf).toContain('TELMA GABRIEL ALVES CAMPOS')
    expect(pdf).toContain('05/09/2026 06:26:57')
    expect(pdf).not.toContain('05/09/2026, 06:26:57')
    expect(pdf).toContain('[1 2] 0 d')
    expect(pdf).toContain('Folha 1/1')
    expect(pdf).not.toContain(' - IE')
    expect((pdf.match(/\/Type \/Page \/Parent/g) || []).length).toBe(1)
    expect(pdf).toContain('startxref')
  })

  it('pagina lista extensa, com o cabeçalho institucional em cada folha e sem página em branco', () => {
    const linhas = Array.from({ length: 180 }, (_, i) => ({
      nome: 'Participante ' + String(i + 1).padStart(3, '0') + ' da reunião de atendimento',
      funcao: 'Diácono',
      entrada: '05/09/2026, 06:08:00',
    }))
    const pdf = textoPdf(linhas)
    const paginas = (pdf.match(/\/Type \/Page \/Parent/g) || []).length
    expect(paginas).toBeGreaterThan(2)
    expect(pdf).toContain(' /Count ' + paginas + ' ')
    expect(pdf).toContain('Folha ' + paginas + '/' + paginas)
    expect((pdf.match(/CONGREGA\\307\\303O CRIST\\303 NO BRASIL/g) || []).length).toBe(paginas)
  })

  it('mantém CNPJ, titulo e tabela separados mesmo com endereço muito extenso', () => {
    const longo = 'Avenida dos Trabalhadores da Obra da Piedade '.repeat(8) + ' São Paulo/SP'
    const pdf = textoPdf([
      { nome: 'Participante Exemplo', funcao: 'Diácono', entrada: '05/09/2026, 06:08:00' },
    ], { endereco: longo })
    const cnpj = pdf.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm \(CNPJ /)
    const nome = pdf.match(/1 0 0 1 28\.0 ([\d.]+) Tm \(PARTICIPANTE EXEMPLO\)/)
    expect(cnpj).not.toBeNull()
    expect(nome).not.toBeNull()
    expect(Number(cnpj![2])).toBeGreaterThan(Number(nome![1]) + 35)
  })

  it('preserva acentos via WinAnsi e quebra nomes e funções longas sem truncar', () => {
    const pdf = textoPdf([{
      nome: 'José Antônio de Azevedo dos Santos e Gonçalves da Silva',
      funcao: 'Irmã da Obra da Piedade e membro de grupo de trabalho',
      entrada: '05/09/2026, 06:08:00',
    }])
    expect(pdf).toContain('JOS\\311 ANT\\324NIO')
    expect(pdf).toContain('IRM\\303 DA OBRA DA PIEDADE')
    expect(pdf).toContain('GON\\307ALVES DA SILVA')
    expect(pdf).toContain('GRUPO DE TRABALHO')
  })

  it('não corta nomes de cidades que contêm hífen', () => {
    const pdf = textoPdf([], { local: 'Centro - Embu-Guaçu/SP' })
    expect(pdf).toContain('EMBU-GUA\\307U - SP')
    expect(pdf).not.toContain('Tm (GUA\\307U - SP)')
  })

  it('evita sobreposição entre município longo e endereço de duas linhas', () => {
    const pdf = textoPdf([], {
      local: 'Centro - Santa Rita do Passa Quatro/SP',
      endereco: 'Avenida dos Trabalhadores, 123 - Jardim Primavera - Santa Rita do Passa Quatro/SP - CEP 13670-000',
    })
    const cidade = pdf.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm \(SANTA RITA DO PASSA QUATRO - SP\)/)
    const endereco = pdf.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm \(AVENIDA DOS TRABALHADORES/)
    expect(cidade).not.toBeNull()
    expect(endereco).not.toBeNull()
    expect(Number(cidade![2]) - Number(endereco![2])).toBeGreaterThanOrEqual(14)
    expect(pdf).toContain('CEP 13670-000')
  })
  it('não cria dados de presença artificialmente para uma lista vazia', () => {
    const pdf = textoPdf([])
    expect((pdf.match(/\/Type \/Page \/Parent/g) || []).length).toBe(1)
    expect(pdf).toContain('Folha 1/1')
    expect(pdf).not.toContain('N\\343o registrado')
  })
})
