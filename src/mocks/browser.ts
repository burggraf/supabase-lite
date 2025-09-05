import { setupWorker } from 'msw/browser'
import { handlers } from './handlers/index'

// This configures a Service Worker with the given request handlers.
export const worker = setupWorker(...handlers)