export interface LinhaListaPresenca { nome: string; funcao: string; entrada: string }
export interface DadosListaPresenca {
  titulo: string; local: string; endereco: string; cnpj: string;
  inicio: string; fim: string; emitidoEm: string; linhas: LinhaListaPresenca[]
}

// Modelo institucional inspirado nas listas SIGA: A4, Courier, tabela compacta.
// Usa exclusivamente fontes padrao PDF e codificacao WinAnsi; nao depende
// de arquivos de fonte nem de bibliotecas nativas no Cloudflare Worker.
const PAGINA_LARGURA = 595
const PAGINA_ALTURA = 842
const MARGEM = 28
const FONTE_LINHA = 7
const COLUNAS = { nome: 28, funcao: 207, entrada: 369 }
const ALTURA_LINHA = 10
const ALTURA_REGISTRO = 18.7
const RODAPE_SUPERIOR = 61

function pdfTexto(texto: string): string {
  const extras: Record<number, number> = {
    8211: 150, 8212: 151, 8216: 145, 8217: 146, 8220: 147,
    8221: 148, 8230: 133, 8364: 128, 8226: 149,
  }
  return Array.from(texto.normalize('NFC')).map(c => {
    const codigo = c.codePointAt(0) ?? 32
    if (c === '(' || c === ')' || c === '\\') return '\\' + c
    if (codigo >= 32 && codigo <= 126) return c
    const byte = codigo >= 160 && codigo <= 255 ? codigo : extras[codigo]
    return byte === undefined ? '?' : '\\' + byte.toString(8).padStart(3, '0')
  }).join('')
}

function escrever(x: number, y: number, texto: string, tamanho = FONTE_LINHA, negrito = false): string {
  return 'BT /' + (negrito ? 'F2' : 'F1') + ' ' + tamanho +
    ' Tf 1 0 0 1 ' + x.toFixed(1) + ' ' + y.toFixed(1) +
    ' Tm (' + pdfTexto(texto) + ') Tj ET\n'
}

function largura(texto: string, tamanho: number): number {
  // Courier e Courier-Bold tem avancos uniformes: 600/1000 em.
  return Array.from(texto).length * tamanho * 0.6
}

function centralizado(y: number, texto: string, tamanho: number, negrito = false): string {
  return escrever(Math.max(MARGEM, (PAGINA_LARGURA - largura(texto, tamanho)) / 2), y, texto, tamanho, negrito)
}

function direita(y: number, texto: string, tamanho = FONTE_LINHA): string {
  return escrever(Math.max(315, PAGINA_LARGURA - MARGEM - largura(texto, tamanho)), y, texto, tamanho)
}

function dividir(texto: string, limite: number): string[] {
  const linhas: string[] = []
  let atual = ''
  for (const palavra of texto.trim().split(/\s+/).filter(Boolean)) {
    if (atual && atual.length + palavra.length + 1 > limite) {
      linhas.push(atual)
      atual = ''
    }
    for (let i = 0; i < palavra.length; i += limite) {
      const bloco = palavra.slice(i, i + limite)
      if (atual && atual.length + bloco.length + 1 > limite) {
        linhas.push(atual)
        atual = ''
      }
      atual += (atual ? ' ' : '') + bloco
    }
  }
  if (atual) linhas.push(atual)
  return linhas.length ? linhas : ['']
}

function formatarHorario(valor: string): string {
  // O SIGA nao usa virgula entre a data e a hora de entrada.
  return valor.replace(/(\d{2}\/\d{2}\/\d{4}),\s*(\d{2}:\d{2})/, '$1 $2')
}

function cidadeUf(local: string): string {
  const match = local.match(/[-–]\s*([^/–-]+)\/([A-Z]{2})\s*$/i)
  return match ? match[1].trim().toUpperCase() + ' - ' + match[2].toUpperCase() : ''
}

function linhasItem(item: LinhaListaPresenca) {
  return {
    nomes: dividir(item.nome.toLocaleUpperCase('pt-BR'), 40),
    funcoes: dividir(item.funcao.toLocaleUpperCase('pt-BR'), 36),
  }
}

function alturaItem(item: LinhaListaPresenca): number {
  const { nomes, funcoes } = linhasItem(item)
  return ALTURA_REGISTRO + (Math.max(nomes.length, funcoes.length) - 1) * ALTURA_LINHA
}

function cabecalho(d: DadosListaPresenca, pagina: number): { stream: string; inicioTabela: number } {
  let out = '0 G 0.35 w\n'
  out += centralizado(803, 'CONGREGAÇÃO CRISTÃ NO BRASIL', 10, true)
  const cidade = cidadeUf(d.local)
  if (cidade) out += centralizado(791, cidade, 9)

  // A direita, como no SIGA. O numero de linhas desloca dinamicamente
  // o CNPJ, o titulo e a tabela para impedir sobreposicoes.
  let yDireita = 798
  out += direita(809, 'Folha ' + pagina, 7)
  for (const parte of dividir(d.endereco.toLocaleUpperCase('pt-BR'), 50)) {
    out += direita(yDireita, parte)
    yDireita -= 10
  }
  out += direita(yDireita, 'CNPJ ' + d.cnpj)
  const separador = Math.min(775, yDireita - 9)
  out += '28 ' + separador.toFixed(1) + ' m 567 ' + separador.toFixed(1) + ' l S\n'

  let tituloY = separador - 22
  const titulo = 'Lista de Presença da ' + d.titulo
  for (const parte of dividir(titulo, 72)) {
    out += centralizado(tituloY, parte, 12, true)
    tituloY -= 14
  }
  tituloY -= 8
  out += centralizado(tituloY, 'Realizada no dia ' + formatarHorario(d.inicio) + '.', 12, true)

  const topoTabela = tituloY - 18
  out += '28 ' + topoTabela.toFixed(1) + ' m 567 ' + topoTabela.toFixed(1) + ' l S\n'
  const tituloTabelaY = topoTabela - 13
  out += escrever(COLUNAS.nome, tituloTabelaY, 'NOME')
  out += escrever(COLUNAS.funcao, tituloTabelaY, 'MINISTÉRIO/FUNÇÃO')
  out += escrever(COLUNAS.entrada, tituloTabelaY, 'HORÁRIO DE ENTRADA')
  const inicioTabela = tituloTabelaY - 13
  if (inicioTabela < 95) throw new Error('Cabeçalho institucional excede a área disponível da página')
  return { stream: out, inicioTabela }
}

function pagina(d: DadosListaPresenca, itens: LinhaListaPresenca[], numero: number, total: number): string {
  const cab = cabecalho(d, numero)
  let out = cab.stream
  let y = cab.inicioTabela
  for (const item of itens) {
    const linhas = linhasItem(item)
    const max = Math.max(linhas.nomes.length, linhas.funcoes.length)
    for (let i = 0; i < max; i++) {
      const yy = y - i * ALTURA_LINHA
      if (linhas.nomes[i]) out += escrever(COLUNAS.nome, yy, linhas.nomes[i])
      if (linhas.funcoes[i]) out += escrever(COLUNAS.funcao, yy, linhas.funcoes[i])
      if (i === 0) out += escrever(COLUNAS.entrada, yy, formatarHorario(item.entrada))
    }
    y -= alturaItem(item)
    out += '[1 2] 0 d 28 ' + (y + 4).toFixed(1) + ' m 567 ' + (y + 4).toFixed(1) + ' l S [] 0 d\n'
  }
  out += '28 ' + RODAPE_SUPERIOR + ' m 567 ' + RODAPE_SUPERIOR + ' l S\n'
  out += escrever(MARGEM, 45, 'AGENDA REGIONAL SP - Emitido em ' + formatarHorario(d.emitidoEm))
  out += escrever(PAGINA_LARGURA - MARGEM - largura('Folha ' + numero + '/' + total, 7),
    45, 'Folha ' + numero + '/' + total)
  return out
}

export function gerarListaPresencaPdf(dados: DadosListaPresenca): Uint8Array {
  const grupos: LinhaListaPresenca[][] = []
  let atual: LinhaListaPresenca[] = []
  let usado = 0
  const disponivel = cabecalho(dados, 1).inicioTabela - (RODAPE_SUPERIOR + 13)
  for (const item of dados.linhas) {
    const altura = alturaItem(item)
    if (altura > disponivel) throw new Error('Registro maior do que a área útil da Lista de Presença')
    if (atual.length && usado + altura > disponivel) {
      grupos.push(atual)
      atual = []
      usado = 0
    }
    atual.push(item)
    usado += altura
  }
  if (atual.length || !grupos.length) grupos.push(atual)

  const objetos: string[] = ['', '<< /Type /Catalog /Pages 2 0 R >>', '']
  objetos[3] = '<< /Producer (Agenda Regional Sao Paulo) >>'
  objetos[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'
  objetos[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>'
  const ids: number[] = []
  for (const [index, itens] of grupos.entries()) {
    const id = 6 + index * 2
    ids.push(id)
    const stream = pagina(dados, itens, index + 1, grupos.length)
    objetos[id] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PAGINA_LARGURA +
      ' ' + PAGINA_ALTURA + '] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents ' + (id + 1) + ' 0 R >>'
    objetos[id + 1] = '<< /Length ' + stream.length + ' >>\nstream\n' + stream + 'endstream'
  }
  objetos[2] = '<< /Type /Pages /Kids [' + ids.map(id => id + ' 0 R').join(' ') +
    '] /Count ' + ids.length + ' >>'

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (let i = 1; i < objetos.length; i++) {
    offsets.push(pdf.length)
    pdf += i + ' 0 obj\n' + objetos[i] + '\nendobj\n'
  }
  const inicioXref = pdf.length
  pdf += 'xref\n0 ' + objetos.length + '\n0000000000 65535 f \n'
  for (let i = 1; i < objetos.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n'
  }
  pdf += 'trailer\n<< /Size ' + objetos.length + ' /Root 1 0 R >>\nstartxref\n' + inicioXref + '\n%%EOF\n'
  return new TextEncoder().encode(pdf)
}
