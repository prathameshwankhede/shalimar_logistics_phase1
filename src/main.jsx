// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// 🧹 Permanently wipe all localStorage items to force 100% direct MySQL connection
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
} catch (e) {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
