// Converte buffer para string hex
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const hashArray = Array.from(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Converte string hex para Uint8Array
export function hexToBuffer(hex: string): Uint8Array {
  const match = hex.match(/.{1,2}/g)
  if (!match) return new Uint8Array()
  return new Uint8Array(match.map((byte) => parseInt(byte, 16)))
}

export async function hashStringSHA256(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  return bufferToHex(hashBuffer)
}
