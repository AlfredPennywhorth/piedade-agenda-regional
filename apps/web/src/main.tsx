import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { IosInstallPrompt } from './components/pwa/IosInstallPrompt'

const root = document.getElementById('root')
if (!root) throw new Error('Elemento #root não encontrado')

createRoot(root).render(
  <StrictMode>
    <>
      <App />
      <IosInstallPrompt />
    </>
  </StrictMode>
)
