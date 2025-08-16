import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Start MSW for browser-based API simulation
const { worker } = await import('./mocks/browser')
await worker.start({
  onUnhandledRequest: 'bypass',
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
