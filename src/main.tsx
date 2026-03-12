import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SettingsPage } from './components/Chat/SettingsPage'
import './styles/index.css'

const params = new URLSearchParams(window.location.search)
const page = params.get('page')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {page === 'settings' ? <SettingsPage /> : <App />}
  </React.StrictMode>
)
