/**
 * Gerador de matriz QR Code de versão adaptativa (v1-v4) em TypeScript puro.
 * Converte qualquer string (ex: UUID do destinatarioId) em uma matriz de módulos (booleans).
 */

// GF(256) Log & Exp tables com polinômio 0x11d (285)
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

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0
  return EXP_TABLE[(LOG_TABLE[x] + LOG_TABLE[y]) % 255]
}

function rsComputePoly(numNum: number): Uint8Array {
  let poly = new Uint8Array([1])
  for (let i = 0; i < numNum; i++) {
    const nextPoly = new Uint8Array(poly.length + 1)
    for (let j = 0; j < poly.length; j++) {
      nextPoly[j] ^= gfMul(poly[j], EXP_TABLE[i])
      nextPoly[j + 1] ^= poly[j]
    }
    poly = nextPoly
  }
  return poly
}

function rsEncode(data: Uint8Array, numNum: number): Uint8Array {
  const genPoly = rsComputePoly(numNum)
  const res = new Uint8Array(numNum)
  for (let i = 0; i < data.length; i++) {
    const m = data[i] ^ res[0]
    for (let j = 0; j < numNum - 1; j++) {
      res[j] = res[j + 1] ^ gfMul(genPoly[j], m)
    }
    res[numNum - 1] = gfMul(genPoly[numNum - 1], m)
  }
  return res
}

// Configuração QR Code v3-L (29x29) ou v4-L (33x33) para UUIDs de 36 caracteres
interface QRVersionConfig {
  version: number
  size: number
  totalCodewords: number
  dataCodewords: number
  ecCodewords: number
  alignPos: number[]
}

function getVersionConfig(dataLen: number): QRVersionConfig {
  // byte mode header = 4 bits + len bits (8 bits) = 12 bits -> 1.5 bytes. Total data bytes needed = dataLen + 2
  const needed = dataLen + 3
  if (needed <= 19) return { version: 1, size: 21, totalCodewords: 26, dataCodewords: 19, ecCodewords: 7, alignPos: [] }
  if (needed <= 34) return { version: 2, size: 25, totalCodewords: 44, dataCodewords: 34, ecCodewords: 10, alignPos: [6, 18] }
  if (needed <= 55) return { version: 3, size: 29, totalCodewords: 70, dataCodewords: 55, ecCodewords: 15, alignPos: [6, 22] }
  return { version: 4, size: 33, totalCodewords: 100, dataCodewords: 80, ecCodewords: 20, alignPos: [6, 26] }
}

export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text)
  const config = getVersionConfig(bytes.length)
  const size = config.size

  // 1. Bitstream
  const bits: number[] = []
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1)
    }
  }

  // Byte mode indicator: 0100
  pushBits(0b0100, 4)
  // Character count (8 bits)
  pushBits(bytes.length, 8)
  // Data bytes
  for (let i = 0; i < bytes.length; i++) {
    pushBits(bytes[i], 8)
  }
  // Terminator (4 zero bits)
  const maxDataBits = config.dataCodewords * 8
  const termLen = Math.min(4, maxDataBits - bits.length)
  pushBits(0, termLen)
  // Bit padding to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0)
  }
  // Pad bytes (0xEC, 0x11)
  const padPatterns = [0xec, 0x11]
  let padIdx = 0
  while (bits.length < maxDataBits) {
    pushBits(padPatterns[padIdx], 8)
    padIdx = (padIdx + 1) % 2
  }

  // Convert bits to data codewords
  const dataCodewords = new Uint8Array(config.dataCodewords)
  for (let i = 0; i < config.dataCodewords; i++) {
    let b = 0
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i * 8 + j]
    }
    dataCodewords[i] = b
  }

  // RS Error Correction
  const ecCodewords = rsEncode(dataCodewords, config.ecCodewords)

  // Combinar data + ec
  const finalCodewords = new Uint8Array(config.totalCodewords)
  finalCodewords.set(dataCodewords, 0)
  finalCodewords.set(ecCodewords, config.dataCodewords)

  // 2. Matriz de Módulos (true = preto, false = branco)
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))

  function setModule(r: number, c: number, val: boolean) {
    grid[r][c] = val
    reserved[r][c] = true
  }

  // Desenhar Finder Pattern (7x7)
  function drawFinder(r: number, c: number) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const nr = r + dr
        const nc = c + dc
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          reserved[nr][nc] = true
          if (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) {
            const isBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6
            const isCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4
            grid[nr][nc] = isBorder || isCenter
          } else {
            grid[nr][nc] = false
          }
        }
      }
    }
  }

  drawFinder(0, 0)
  drawFinder(0, size - 7)
  drawFinder(size - 7, 0)

  // Desenhar Alignment Patterns
  if (config.alignPos.length >= 2) {
    for (const ar of config.alignPos) {
      for (const ac of config.alignPos) {
        if (reserved[ar][ac]) continue
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBorder = Math.abs(dr) === 2 || Math.abs(dc) === 2
            const isCenter = dr === 0 && dc === 0
            grid[ar + dr][ac + dc] = isBorder || isCenter
            reserved[ar + dr][ac + dc] = true
          }
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) {
      grid[6][i] = i % 2 === 0
      reserved[6][i] = true
    }
    if (!reserved[i][6]) {
      grid[i][6] = i % 2 === 0
      reserved[i][6] = true
    }
  }

  // Dark module
  grid[4 * config.version + 9][8] = true
  reserved[4 * config.version + 9][8] = true

  // Reservar Format Info áreas
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      reserved[8][i] = true
      reserved[i][8] = true
    }
  }
  for (let i = size - 8; i < size; i++) {
    reserved[8][i] = true
    reserved[i][8] = true
  }

  // 3. Inserir Codewords em Zigzag
  const allBits: number[] = []
  for (let i = 0; i < finalCodewords.length; i++) {
    for (let b = 7; b >= 0; b--) {
      allBits.push((finalCodewords[i] >> b) & 1)
    }
  }

  let bitIdx = 0
  let up = true
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1 // Skip vertical timing column
    const rows = Array.from({ length: size }, (_, r) => (up ? size - 1 - r : r))
    for (const row of rows) {
      for (let c = col; c > col - 2; c--) {
        if (!reserved[row][c]) {
          const bitVal = bitIdx < allBits.length ? allBits[bitIdx++] === 1 : false
          // Aplicar Máscara 0: (row + col) % 2 === 0
          const mask = (row + c) % 2 === 0
          grid[row][c] = bitVal !== mask
        }
      }
    }
    up = !up
  }

  // 4. Inserir Format Info (Máscara 0, EC Level L = 01)
  // Format bit string para Level L + Mask 0 com BCH = 0x77c4
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0]
  const formatPosRow1 = [0, 1, 2, 3, 4, 5, 7, 8]
  const formatPosCol1 = [8, 8, 8, 8, 8, 8, 8, 8]

  for (let i = 0; i < 8; i++) {
    grid[formatPosRow1[i]][formatPosCol1[i]] = formatBits[i] === 1
  }
  for (let i = 0; i < 7; i++) {
    grid[8][size - 1 - i] = formatBits[i] === 1
  }
  for (let i = 0; i < 7; i++) {
    grid[size - 1 - i][8] = formatBits[8 + i] === 1
  }
  grid[8][7] = formatBits[8] === 1

  return grid
}
