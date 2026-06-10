import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { hydrateSessionFromRememberedAuth, sanitizePersistedAuth } from './utils/auth-session'
import './index.css'

sanitizePersistedAuth()
hydrateSessionFromRememberedAuth()

document.documentElement.classList.remove('dark')
document.documentElement.classList.add('light')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
