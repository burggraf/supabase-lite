// Browser-based Auth API service for handling auth requests from test-app
// This runs in the browser context where PGlite is available

import { AuthBridge } from '@/lib/auth/AuthBridge'
import type { AuthAPIRequest, AuthAPIResponse } from '@/lib/auth/AuthBridge'

class AuthAPIService {
  private authBridge: AuthBridge
  private initialized = false

  constructor() {
    this.authBridge = AuthBridge.getInstance()
  }

  async initialize() {
    if (!this.initialized) {
      await this.authBridge.initialize()
      this.initialized = true
    }
  }

  async handleAuthRequest(
    endpoint: string,
    method: string,
    body: any,
    headers: Record<string, string> = {}
  ): Promise<AuthAPIResponse> {
    await this.initialize()

    const url = new URL(`http://localhost:5173/auth/v1/${endpoint}`)
    
    const request: AuthAPIRequest = {
      endpoint,
      method: method as 'GET' | 'POST' | 'PUT' | 'DELETE',
      body,
      headers,
      url
    }

    return await this.authBridge.handleAuthRequest(request)
  }
}

// Global auth API service
export const authAPIService = new AuthAPIService()

// Expose auth endpoints on window for external requests
declare global {
  interface Window {
    supabaseLiteAuth: {
      signup: (body: any) => Promise<any>
      signin: (body: any) => Promise<any>
      signout: (body: any) => Promise<any>
      getUser: (headers: Record<string, string>) => Promise<any>
      updateUser: (body: any, headers: Record<string, string>) => Promise<any>
      refresh: (body: any) => Promise<any>
    }
  }
}

// Initialize and expose auth API
window.supabaseLiteAuth = {
  async signup(body: any) {
    const response = await authAPIService.handleAuthRequest('signup', 'POST', body)
    if (response.error) {
      throw new Error(response.error.message)
    }
    return response.data
  },

  async signin(body: any) {
    const response = await authAPIService.handleAuthRequest('signin', 'POST', body)
    if (response.error) {
      throw new Error(response.error.message)
    }
    return response.data
  },

  async signout(body: any = {}) {
    const response = await authAPIService.handleAuthRequest('logout', 'POST', body)
    if (response.error) {
      throw new Error(response.error.message)
    }
    return response.data
  },

  async getUser(headers: Record<string, string>) {
    const response = await authAPIService.handleAuthRequest('user', 'GET', {}, headers)
    if (response.error) {
      throw new Error(response.error.message)
    }
    return response.data
  },

  async updateUser(body: any, headers: Record<string, string>) {
    const response = await authAPIService.handleAuthRequest('user', 'PUT', body, headers)
    if (response.error) {
      throw new Error(response.error.message)
    }
    return response.data
  },

  async refresh(body: any) {
    const response = await authAPIService.handleAuthRequest('token', 'POST', body)
    if (response.error) {
      throw new Error(response.error.message)
    }
    return response.data
  }
}

console.log('Supabase Lite Auth API initialized on window.supabaseLiteAuth')