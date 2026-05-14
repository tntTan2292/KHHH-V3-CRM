import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// [HOTFIX] CLEAR STALE DEV CACHE & SERVICE WORKERS
if (import.meta.env.DEV) {
  // 1. Unregister any accidental service workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister().then(() => console.log('Stale ServiceWorker Unregistered'));
      }
    });
  }

  // 2. Clear known stale dev markers to force fresh graph
  const devMarkers = ['vite-client-id', 'hmr-client-id'];
  devMarkers.forEach(m => localStorage.removeItem(m));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
