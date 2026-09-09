/// <reference lib="webworker" />
import { precacheAndRoute, PrecacheEntry } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | PrecacheEntry)[] }

// Precache resources injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST || [])

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const payload = event.data.json()
    const title = payload.titulo || 'Nova Notificação'
    const options: NotificationOptions = {
      body: payload.mensagem,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: {
        url: payload.url || '/'
      }
    }

    event.waitUntil(self.registration.showNotification(title, options))
  } catch (error) {
    console.error('Erro ao processar push payload:', error)
  }
})

export function resolveNotificationUrl(rawUrl: unknown, origin: string): string {
  if (typeof rawUrl !== 'string' || !rawUrl) {
    return '/'
  }

  try {
    const parsedUrl = new URL(rawUrl, origin)
    
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return '/'
    }

    if (parsedUrl.origin === origin) {
      return parsedUrl.pathname + parsedUrl.search + parsedUrl.hash
    }
  } catch (e) {
    // Ignora URL inválida e usa fallback '/'
  }

  return '/'
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const rawUrl = event.notification.data?.url
  const urlToOpen = resolveNotificationUrl(rawUrl, self.location.origin)

  const finalUrl = new URL(urlToOpen, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Verifica se já tem uma janela aberta com a mesma URL (ou a mesma origin)
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i]
        if (client.url.includes(finalUrl) && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(finalUrl)
      }
    })
  )
})
