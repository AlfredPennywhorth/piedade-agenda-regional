export interface LinhaListaPresenca { nome: string; funcao: string; entrada: string }
export interface DadosListaPresenca {
  titulo: string; local: string; endereco: string; cnpj: string;
  inicio: string; fim: string; emitidoEm: string; linhas: LinhaListaPresenca[]
}
// PDF A4, Helvetica/WinAnsi, fluxo textual ASCII. Sem bibliotecas externas.
function escaparPdf(texto: string) {
  const extras: Record<number, number> = {8211:150, 8212:151, 8216:145, 8217:146, 8220:147, 8221:148, 8230:133, 8364:128}
  return Array.from(texto.normalize('NFC')).map(c => {
    const code = c.codePointAt(0) ?? 32
    if (c === '(' || c === ')' || c === '\\') return '\\' + c
    if (code >= 32 && code <= 126) return c
    const b = code >= 160 && code <= 255 ? code : extras[code]
    return b === undefined ? '?' : '\\' + b.toString(8).padStart(3, '0')
  }).join('')
}
function escrever(x: number, y: number, valor: string, size = 9, bold = false) {
  return `BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escaparPdf(valor)}) Tj ET\n`
}
function dividir(texto: string, limite: number) {
  const saida: string[] = []
  let atual = ''
  for (const palavra of texto.trim().split(/\s+/)) {
    if (atual && atual.length + palavra.length + 1 > limite) {
      saida.push(atual); atual = ''
    }
    for (let i = 0; i < palavra.length; i += limite) {
      const parte = palavra.slice(i, i + limite)
      if (atual && atual.length + parte.length + 1 > limite) {
        saida.push(atual); atual = ''
      }
      atual += (atual ? ' ' : '') + parte
    }
  }
  if (atual) saida.push(atual)
  return saida.length ? saida : ['']
}
function altura(item: LinhaListaPresenca) {
  return Math.max(dividir(item.nome, 43).length, dividir(item.funcao, 28).length) * 12 + 10
}
function comporPagina(d: DadosListaPresenca, itens: LinhaListaPresenca[], pagina: number, total: number) {
  let stream = '0 G 0.4 w\n'
  stream += escrever(165, 802, 'CONGREGAÇÃO CRISTÃ NO BRASIL', 13, true)
  stream += escrever(44, 781, 'LISTA DE PRESENÇA', 12, true)
  for (const [i, t] of dividir(d.titulo, 90).entries()) stream += escrever(44, 764 - i * 12, t, 10, true)
  stream += escrever(44, 735, `Local: ${d.local}`, 9)
  for (const [i, t] of dividir(`Endereço: ${d.endereco}`, 95).entries()) stream += escrever(44, 720 - i * 12, t, 8)
  stream += escrever(44, 694, `CNPJ do Setor: ${d.cnpj}`, 9)
  stream += escrever(44, 679, `Início: ${d.inicio}     Término: ${d.fim}`, 9)
  stream += '44 666 m 551 666 l S\n'
  stream += escrever(46, 649, 'NOME', 9, true)
  stream += escrever(292, 649, 'MINISTÉRIO / FUNÇÃO', 9, true)
  stream += escrever(465, 649, 'ENTRADA', 9, true)
  stream += '44 641 m 551 641 l S\n'
  let y = 624
  for (const item of itens) {
    const nomes = dividir(item.nome, 43)
    const funcoes = dividir(item.funcao, 28)
    for (let i = 0; i < Math.max(nomes.length, funcoes.length); i++) {
      if (nomes[i]) stream += escrever(46, y - i * 12, nomes[i], 8.2)
      if (funcoes[i]) stream += escrever(292, y - i * 12, funcoes[i], 8)
      if (i === 0) stream += escrever(465, y, item.entrada, 8)
    }
    y -= altura(item)
    stream += `44 ${y + 6} m 551 ${y + 6} l S\n`
  }
  stream += '44 58 m 551 58 l S\n'
  stream += escrever(44, 43, `Emitido em ${d.emitidoEm}`, 8)
  stream += escrever(491, 43, `Pág. ${pagina}/${total}`, 8)
  return stream
}
export function gerarListaPresencaPdf(dados: DadosListaPresenca): Uint8Array {
  const grupos: LinhaListaPresenca[][] = []
  let atual: LinhaListaPresenca[] = []
  let ocupada = 0
  for (const item of dados.linhas) {
    const h = altura(item)
    if (atual.length && ocupada + h > 558) {
      grupos.push(atual); atual = []; ocupada = 0
    }
    atual.push(item); ocupada += h
  }
  if (atual.length || !grupos.length) grupos.push(atual)
  const objs: string[] = ['', '<< /Type /Catalog /Pages 2 0 R >>', '']
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  const ids: number[] = []
  for (const [i, itens] of grupos.entries()) {
    const id = 6 + i * 2
    ids.push(id)
    const stream = comporPagina(dados, itens, i + 1, grupos.length)
    objs[id] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents ${id + 1} 0 R >>`
    objs[id + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`
  }
  objs[2] = `<< /Type /Pages /Kids [${ids.map(id => `${id} 0 R`).join(' ')}] /Count ${ids.length} >>`
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (let i = 1; i < objs.length; i++) {
    offsets.push(pdf.length)
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`
  }
  const xref = pdf.length
  pdf += `xref\n0 ${objs.length}\n0000000000 65535 f \n`
  for (let i = 1; i < objs.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}
