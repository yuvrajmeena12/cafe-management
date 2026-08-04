import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { CafeSettingsProvider } from './context/CafeSettingsContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <CafeSettingsProvider>
        <AuthProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </AuthProvider>
      </CafeSettingsProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
