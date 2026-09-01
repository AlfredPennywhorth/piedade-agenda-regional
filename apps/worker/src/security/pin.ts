import { bufferToHex, hexToBuffer } from './hash'

// Documentado na S03: 100.000 iterações é razoável para PBKDF2-SHA256 em V8/Workers
const PBKDF2_ITERATIONS = 100000
const PBKDF2_KEY_LENGTH = 32 // 256 bits

export function gerarSalt(): string {
  const saltBuffer = new Uint8Array(16)
  crypto.getRandomValues(saltBuffer)
  return bufferToHex(saltBuffer)
}

async function derivarChavePBKDF2(pin: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder()
  const pinBuffer = encoder.encode(pin)
  const saltBuffer = hexToBuffer(saltHex)

  const baseKey = await crypto.subtle.importKey(
    'raw',
    pinBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    PBKDF2_KEY_LENGTH * 8
  )

  return bufferToHex(derivedBits)
}

export async function hashPin(pin: string, saltHex: string): Promise<string> {
  return derivarChavePBKDF2(pin, saltHex)
}

export async function verifyPin(pin: string, saltHex: string, expectedHashHex: string): Promise<boolean> {
  const hash = await hashPin(pin, saltHex)
  
  const hashBytes = hexToBuffer(hash)
  const expectedBytes = hexToBuffer(expectedHashHex)

  if (hashBytes.length !== expectedBytes.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < hashBytes.length; i++) {
    result |= hashBytes[i] ^ expectedBytes[i]
  }

  return result === 0
}
