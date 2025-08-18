import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Start MSW for browser-based API simulation
async function initializeApp() {
  try {
    const { worker } = await import('./mocks/browser')
    await worker.start({
      onUnhandledRequest: 'bypass',
    })
    console.log('MSW worker started successfully')
  } catch (error) {
    console.error('Failed to start MSW worker:', error)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

initializeApp()
