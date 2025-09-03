/**
 * Supabase Edge Functions module for Supabase Lite
 * 
 * This module provides Edge Functions support that integrates seamlessly
 * with the Supabase.js client library in a local development environment.
 */

export { FunctionsClient } from './FunctionsClient'
export { createFunctionsClient } from './FunctionsClient'
export { addFunctionsToClient, getFunctionsClientOptions } from './integration'