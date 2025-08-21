import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CrossOriginAPIHandler } from './lib/api/CrossOriginAPIHandler'

// Start MSW for browser-based API simulation and cross-origin API handler
async function initializeApp() {
  try {
    const { worker } = await import('./mocks/browser')
    await worker.start({
      onUnhandledRequest: 'bypass',
    })
    console.log('MSW worker started successfully')
    
    // Initialize cross-origin API handler for test app communication
    new CrossOriginAPIHandler()
    console.log('Cross-origin API handler initialized')
  } catch (error) {
    console.error('Failed to start MSW worker or cross-origin handler:', error)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

initializeApp()
