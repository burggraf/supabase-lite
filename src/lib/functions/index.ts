/**
 * Supabase Edge Functions module for Supabase Lite
 * 
 * This module provides Edge Functions support that integrates seamlessly
 * with the Supabase.js client library in a local development environment.
 */

export { FunctionsClient, createFunctionsClient } from './FunctionsClient'
export { 
  createFunctionsClient as createFunctionsClientIntegration,
  addFunctionsToClient, 
  getFunctionsClientOptions 
} from './integration'