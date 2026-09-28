export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787/api/v1'

export class ApiError<T = any> extends Error {
  status: number
  body: T

  constructor(status: number, message: string, body: T) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export async function fetchWithAuth<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('session_token')
  const headers = new Headers(options.headers || {})
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  })
  
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    const message = errorBody.error || errorBody.message || `HTTP error! status: ${response.status}`
    throw new ApiError(response.status, message, errorBody)
  }
  
  return response.json()
}

export async function putWithAuth<T = any>(endpoint: string, body: any): Promise<T> {
  return fetchWithAuth<T>(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
}

export async function postWithAuth<T = any>(endpoint: string, body: any): Promise<T> {
  return fetchWithAuth<T>(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
}

export async function patchWithAuth<T = any>(endpoint: string, body: any): Promise<T> {
  return fetchWithAuth<T>(endpoint, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
}



export async function fetchPublic<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options)

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    const message = errorBody.error || errorBody.message || `HTTP error! status: ${response.status}`
    throw new ApiError(response.status, message, errorBody)
  }

  return response.json()
}

export async function postPublic<T = any>(endpoint: string, body: any): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    const message = errorBody.error || errorBody.message || `HTTP error! status: ${response.status}`
    throw new ApiError(response.status, message, errorBody)
  }

  return response.json()
}

export function salvarTokenSessao(token: string) {
  localStorage.setItem('session_token', token)
}

export function limparTokenSessao() {
  localStorage.removeItem('session_token')
}

export function possuiTokenSessao() {
  return Boolean(localStorage.getItem('session_token'))
}
