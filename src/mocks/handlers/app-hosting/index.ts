import { appHostingHandlers as hostingHandlers } from './hosting'

/**
 * All App Hosting handlers
 * Combines SPA hosting and deployment functionality
 */
export const appHostingHandlers = [
  ...hostingHandlers
]

// Re-export individual modules for direct access
export { appHostingHandlers as hostingHandlers } from './hosting'