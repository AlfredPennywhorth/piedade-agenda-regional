/**
 * Gerador QR Code em modo byte, nível L, versões 1 a 4.
 * Suporta os identificadores e URLs curtas usados pelo sistema.
 */

const EXP_TABLE = new Uint8Array(256)
const LOG_TABLE = new Uint8Array(256)

let x = 1
for (let i = 0; i < 255; i++) {
  EXP_TABLE[i] = x
  LOG_TABLE[x] = i
  x <<= 1
  if (x & 256) x ^= 0x11d
}
EXP_TABLE[255] = EXP_TABLE[0]

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return EXP_TABLE[(LOG_TABLE[a] + LOG_TABLE[b]) % 255]
}

function polyMul(a: number[], b: number[]): number[] {
  const out = new Array(a.length + b.length - 1).fill(0)
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      out[i + j] ^= gfMul(a[i], b[j])
    }
  }
  return out
}

function rsGenerator(ecCount: number): number[] {
  let generator = [1]
  for (let i = 0; i < ecCount; i++) {
    generator = polyMul(generator, [1, EXP_TABLE[i]])
  }
  return generator
}

function rsEncode(data: number[], ecCount: number): number[] {
  const generator = rsGenerator(ecCount)
  const message = [...data, ...new Array(ecCount).fill(0)]

  for (let i = 0; i < data.length; i++) {
    const factor = message[i]
    if (factor === 0) continue
    for (let j = 0; j < generator.length; j++) {
      message[i + j] ^= gfMul(generator[j], factor)
    }
  }

  return message.slice(-ecCount)
}

interface QRVersionConfig {
  version: number
  size: number
  totalCodewords: number
  dataCodewords: number
  ecCodewords: number
  alignPos: number[]
}

function getVersionConfig(dataLen: number): QRVersionConfig {
  const needed = dataLen + 3
  if (needed <= 19) return { version: 1, size: 21, totalCodewords: 26, dataCodewords: 19, ecCodewords: 7, alignPos: [] }
  if (needed <= 34) return { version: 2, size: 25, totalCodewords: 44, dataCodewords: 34, ecCodewords: 10, alignPos: [6, 18] }
  if (needed <= 55) return { version: 3, size: 29, totalCodewords: 70, dataCodewords: 55, ecCodewords: 15, alignPos: [6, 22] }
  if (needed <= 80) return { version: 4, size: 33, totalCodewords: 100, dataCodewords: 80, ecCodewords: 20, alignPos: [6, 26] }
  throw new Error('Conteúdo grande demais para o QR Code suportado.')
}

export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text)
  const config = getVersionConfig(bytes.length)
  const size = config.size
  const bits: number[] = []

  const pushBits = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1)
  }

  pushBits(0b0100, 4)
  pushBits(bytes.length, 8)
  for (const byte of bytes) pushBits(byte, 8)

  const maxDataBits = config.dataCodewords * 8
  pushBits(0, Math.min(4, maxDataBits - bits.length))
  while (bits.length % 8 !== 0) bits.push(0)

  const pads = [0xec, 0x11]
  let pad = 0
  while (bits.length < maxDataBits) {
    pushBits(pads[pad], 8)
    pad = 1 - pad
  }

  const dataCodewords: number[] = []
  for (let i = 0; i < config.dataCodewords; i++) {
    let value = 0
    for (let j = 0; j < 8; j++) value = (value << 1) | bits[i * 8 + j]
    dataCodewords.push(value)
  }

  const finalCodewords = [...dataCodewords, ...rsEncode(dataCodewords, config.ecCodewords)]
  const grid: Array<Array<boolean | null>> = Array.from({ length: size }, () => Array(size).fill(null))

  const drawFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      const rr = row + r
      if (rr < 0 || rr >= size) continue
      for (let c = -1; c <= 7; c++) {
        const cc = col + c
        if (cc < 0 || cc >= size) continue
        grid[rr][cc] =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
      }
    }
  }

  drawFinder(0, 0)
  drawFinder(size - 7, 0)
  drawFinder(0, size - 7)

  for (const row of config.alignPos) {
    for (const col of config.alignPos) {
      if (grid[row][col] !== null) continue
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          grid[row + r][col + c] =
            r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)
        }
      }
    }
  }

  for (let i = 8; i < size - 8; i++) {
    if (grid[i][6] === null) grid[i][6] = i % 2 === 0
    if (grid[6][i] === null) grid[6][i] = i % 2 === 0
  }

  // Level L + máscara 0 = 0x77c4. Os bits são aplicados LSB-first.
  const format = 0x77c4
  const formatBit = (i: number) => ((format >> i) & 1) === 1

  for (let i = 0; i < 15; i++) {
    const bit = formatBit(i)
    if (i < 6) grid[i][8] = bit
    else if (i < 8) grid[i + 1][8] = bit
    else grid[size - 15 + i][8] = bit
  }

  for (let i = 0; i < 15; i++) {
    const bit = formatBit(i)
    if (i < 8) grid[8][size - i - 1] = bit
    else if (i < 9) grid[8][15 - i] = bit
    else grid[8][15 - i - 1] = bit
  }
  grid[size - 8][8] = true

  let row = size - 1
  let direction = -1
  let byteIndex = 0
  let bitIndex = 7

  for (let baseCol = size - 1; baseCol > 0; baseCol -= 2) {
    let col = baseCol
    if (col <= 6) col--

    while (true) {
      for (const currentCol of [col, col - 1]) {
        if (grid[row][currentCol] !== null) continue

        let dark = false
        if (byteIndex < finalCodewords.length) {
          dark = ((finalCodewords[byteIndex] >> bitIndex) & 1) === 1
        }

        if ((row + currentCol) % 2 === 0) dark = !dark
        grid[row][currentCol] = dark

        bitIndex--
        if (bitIndex < 0) {
          byteIndex++
          bitIndex = 7
        }
      }

      row += direction
      if (row < 0 || row >= size) {
        row -= direction
        direction = -direction
        break
      }
    }
  }

  return grid.map(rowData => rowData.map(cell => Boolean(cell)))
}
