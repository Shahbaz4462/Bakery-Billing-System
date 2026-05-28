import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initMockElectronAPI } from './utils/mockElectronAPI'

// Initialize mock API for browser preview (when not running in Electron)
initMockElectronAPI()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
