import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Сигнализируем Telegram что приложение загружено (нужно для инъекции initData)
window.Telegram?.WebApp?.ready()
window.Telegram?.WebApp?.expand()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
