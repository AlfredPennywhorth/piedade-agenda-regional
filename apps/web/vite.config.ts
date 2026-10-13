import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const beta = process.env.VITE_APP_ENV === 'beta'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: beta ? 'Agenda Regional São Paulo — Beta' : 'Agenda Regional São Paulo',
        short_name: beta ? 'AgendaSP Beta' : 'AgendaSP',
        description: 'Agenda Regional São Paulo — Gestão de reuniões e convocações',
        theme_color: '#1e3a5f',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
