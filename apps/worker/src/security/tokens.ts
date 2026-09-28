import { hashStringSHA256 } from './hash'

// Para evitar problemas com base64 padrão (caracteres + e /) em URLs, e '=' no final.
function bufferToBase64Url(buffer: Uint8Array): string {
  // Converte Uint8Array para string binária
  let binary = ''
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  // Base64 padrão
  const base64 = btoa(binary)
  // Substitui caracteres para tornar URL-safe e remove padding
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function gerarTokenAleatorio(bytes: number = 32): string {
  const array = new Uint8Array(bytes)
  crypto.getRandomValues(array)
  return bufferToBase64Url(array)
}

export async function hashToken(token: string): Promise<string> {
  return await hashStringSHA256(token)
}
