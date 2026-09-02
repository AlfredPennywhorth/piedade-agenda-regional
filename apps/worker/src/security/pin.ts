import { bufferToHex, hexToBuffer } from './hash'

const PBKDF2_ITERATIONS = 100000
const PBKDF2_KEY_LENGTH = 32 // 256 bits
const HASH_VERSION = 'v1'

export function gerarSalt(): string {
  const saltBuffer = new Uint8Array(16)
  crypto.getRandomValues(saltBuffer)
  return bufferToHex(saltBuffer)
}

async function aplicarPepperHMAC(pin: string, pepper: string): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  
  // A chave HMAC será o Pepper.
  // Se pepper estiver vazio, importará uma chave vazia (em testes ou erro de config), 
  // mas o HMAC ainda ocorrerá.
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(pin))
  return new Uint8Array(signature)
}

async function derivarChavePBKDF2(pinBuffer: Uint8Array, saltHex: string, iterations: number): Promise<string> {
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
      iterations: iterations,
      hash: 'SHA-256',
    },
    baseKey,
    PBKDF2_KEY_LENGTH * 8
  )

  return bufferToHex(derivedBits)
}

export async function hashPin(pin: string, saltHex: string, pepper: string): Promise<string> {
  const pepperedPin = await aplicarPepperHMAC(pin, pepper)
  const hashHex = await derivarChavePBKDF2(pepperedPin, saltHex, PBKDF2_ITERATIONS)
  
  // Retorna no formato estilo PHC
  return `$${HASH_VERSION}$pbkdf2-sha256$i=${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`
}

export async function verifyPin(pin: string, pepper: string, expectedHashString: string): Promise<boolean> {
  // Parsing do PHC
  // Formato esperado: $v1$pbkdf2-sha256$i=100000$saltHex$hashHex
  // Antigo formato puro S03 sem versionamento: apenas o hashHex (fallback fail-safe? Não, PO quer que rejeite com erro seguro versão desconhecida)
  
  const parts = expectedHashString.split('$')
  if (parts.length !== 6 || parts[0] !== '') {
    return false // Formato inválido ou versão desconhecida
  }
  
  const version = parts[1]
  const alg = parts[2]
  const iterStr = parts[3]
  const saltHex = parts[4]
  const expectedHashHex = parts[5]

  if (version !== 'v1' || alg !== 'pbkdf2-sha256' || !iterStr.startsWith('i=')) {
    return false // Versão ou algoritmo desconhecidos
  }

  const iterations = parseInt(iterStr.substring(2), 10)
  if (isNaN(iterations) || iterations <= 0) {
    return false
  }

  const pepperedPin = await aplicarPepperHMAC(pin, pepper)
  const computedHashHex = await derivarChavePBKDF2(pepperedPin, saltHex, iterations)
  
  const computedBytes = hexToBuffer(computedHashHex)
  const expectedBytes = hexToBuffer(expectedHashHex)

  if (computedBytes.length !== expectedBytes.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < computedBytes.length; i++) {
    result |= computedBytes[i] ^ expectedBytes[i]
  }

  return result === 0
}
