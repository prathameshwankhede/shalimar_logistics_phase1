// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// 🛡️ Remove legacy mock store keys without wiping authenticated session tokens
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('transflow_mock_db');
    window.localStorage.removeItem('transflow_legacy_store');
    window.localStorage.removeItem('transflow_db_v1');
  }
} catch (e) {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
