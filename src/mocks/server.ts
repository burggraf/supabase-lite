import { setupServer } from 'msw/node'
import { handlers } from '../api/index'

// This configures a request interception server with the given request handlers.
export const server = setupServer(...handlers)