import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.js'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Registered post-load so it never delays first paint. Skipped outside
// production (Vite's dev server rewrites/HMR don't play well with an active
// service worker intercepting fetches) and outside secure contexts, since
// browsers refuse to register one there anyway.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installability is a progressive enhancement — silently skip if it fails.
    })
  })
}
