import { useState, useEffect } from 'react'
import * as apiClient from '../../api/apiClient'

// Função auxiliar base64UrlToUint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function NotificacoesControl() {
  const [suportado, setSuportado] = useState(false)
  const [status, setStatus] = useState<'Não suportado' | 'Não autorizado' | 'Ativado' | 'Desativado' | 'Carregando'>('Carregando')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setSuportado(false)
      setStatus('Não suportado')
      return
    }
    setSuportado(true)

    if (Notification.permission === 'denied') {
      setStatus('Não autorizado')
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        setStatus('Ativado')
      } else {
        setStatus('Desativado')
      }
    } catch (e) {
      console.error(e)
      setStatus('Não suportado')
    }
  }

  const handleAtivar = async () => {
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('Não autorizado')
        return
      }

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      
      if (!subscription) {
        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
        if (!vapidPublicKey) {
          throw new Error('VAPID public key não configurada no frontend')
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        })
      }

      await apiClient.fetchWithAuth('/minha-agenda/notificacoes/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      })

      setStatus('Ativado')
    } catch (e) {
      console.error('Erro ao ativar notificações', e)
    } finally {
      setLoading(false)
    }
  }

  const handleDesativar = async () => {
    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      
      if (subscription) {
        await apiClient.fetchWithAuth('/minha-agenda/notificacoes/unsubscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        })
        await subscription.unsubscribe()
      }
      setStatus('Desativado')
    } catch (e) {
      console.error('Erro ao desativar notificações', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Notificações Push</h2>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600">Estado atual:</p>
          <p className="font-medium text-slate-900">{status}</p>
        </div>
        <div>
          {suportado && status !== 'Não suportado' && status !== 'Não autorizado' && status !== 'Carregando' && (
            <>
              {status === 'Ativado' ? (
                <button
                  onClick={handleDesativar}
                  disabled={loading}
                  className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 font-medium text-sm disabled:opacity-50"
                >
                  {loading ? 'Desativando...' : 'Desativar Notificações'}
                </button>
              ) : (
                <button
                  onClick={handleAtivar}
                  disabled={loading}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium text-sm disabled:opacity-50"
                >
                  {loading ? 'Ativando...' : 'Ativar Notificações'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
