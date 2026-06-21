import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.js'
import { initTheme } from './theme.js'

initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
