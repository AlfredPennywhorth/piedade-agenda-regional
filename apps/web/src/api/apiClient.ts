export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787/api/v1'

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
    throw new Error(errorBody.error || `HTTP error! status: ${response.status}`)
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
