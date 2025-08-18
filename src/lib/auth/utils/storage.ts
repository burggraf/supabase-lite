import type { Session, RefreshToken } from '../types'

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  clear(): Promise<void>
}

export class LocalStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key)
  }

  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value)
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key)
  }

  async clear(): Promise<void> {
    localStorage.clear()
  }
}

export class IndexedDBAdapter implements StorageAdapter {
  private dbName = 'supabase-lite-auth'
  private version = 1
  private storeName = 'sessions'

  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' })
          store.createIndex('expires_at', 'expires_at', { unique: false })
        }
      }
    })
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const db = await this.getDB()
      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      
      return new Promise((resolve, reject) => {
        const request = store.get(key)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const result = request.result
          if (result && (!result.expires_at || result.expires_at > Date.now())) {
            resolve(result.value)
          } else {
            if (result && result.expires_at && result.expires_at <= Date.now()) {
              // Clean up expired item
              this.removeItem(key)
            }
            resolve(null)
          }
        }
      })
    } catch (error) {
      console.warn('IndexedDB error, falling back to localStorage:', error)
      return localStorage.getItem(key)
    }
  }

  async setItem(key: string, value: string, expiresAt?: number): Promise<void> {
    try {
      const db = await this.getDB()
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      
      return new Promise((resolve, reject) => {
        const request = store.put({
          key,
          value,
          expires_at: expiresAt,
          created_at: Date.now()
        })
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      })
    } catch (error) {
      console.warn('IndexedDB error, falling back to localStorage:', error)
      localStorage.setItem(key, value)
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const db = await this.getDB()
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      
      return new Promise((resolve, reject) => {
        const request = store.delete(key)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      })
    } catch (error) {
      console.warn('IndexedDB error, falling back to localStorage:', error)
      localStorage.removeItem(key)
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.getDB()
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      
      return new Promise((resolve, reject) => {
        const request = store.clear()
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      })
    } catch (error) {
      console.warn('IndexedDB error, falling back to localStorage:', error)
      localStorage.clear()
    }
  }

  async cleanupExpired(): Promise<void> {
    try {
      const db = await this.getDB()
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const index = store.index('expires_at')
      
      const now = Date.now()
      const range = IDBKeyRange.upperBound(now)
      
      return new Promise((resolve, reject) => {
        const request = index.openCursor(range)
        request.onerror = () => reject(request.error)
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result
          if (cursor) {
            cursor.delete()
            cursor.continue()
          } else {
            resolve()
          }
        }
      })
    } catch (error) {
      console.warn('IndexedDB cleanup error:', error)
    }
  }
}

export class AuthStorage {
  private static instance: AuthStorage
  private adapter: StorageAdapter
  private namespace: string

  constructor(adapter?: StorageAdapter, namespace: string = 'supabase-lite-auth') {
    this.adapter = adapter || new IndexedDBAdapter()
    this.namespace = namespace
  }

  static getInstance(): AuthStorage {
    if (!AuthStorage.instance) {
      AuthStorage.instance = new AuthStorage()
    }
    return AuthStorage.instance
  }

  private getKey(key: string): string {
    return `${this.namespace}.${key}`
  }

  async storeSession(session: Session): Promise<void> {
    const key = this.getKey(`session.${session.user_id}`)
    await this.adapter.setItem(key, JSON.stringify(session))
  }

  async getSession(userId: string): Promise<Session | null> {
    const key = this.getKey(`session.${userId}`)
    const data = await this.adapter.getItem(key)
    return data ? JSON.parse(data) : null
  }

  async removeSession(userId: string): Promise<void> {
    const key = this.getKey(`session.${userId}`)
    await this.adapter.removeItem(key)
  }

  async storeRefreshToken(token: RefreshToken): Promise<void> {
    const key = this.getKey(`refresh_token.${token.user_id}`)
    await this.adapter.setItem(key, JSON.stringify(token))
  }

  async getRefreshToken(userId: string): Promise<RefreshToken | null> {
    const key = this.getKey(`refresh_token.${userId}`)
    const data = await this.adapter.getItem(key)
    return data ? JSON.parse(data) : null
  }

  async removeRefreshToken(userId: string): Promise<void> {
    const key = this.getKey(`refresh_token.${userId}`)
    await this.adapter.removeItem(key)
  }

  async storeCurrentUser(userId: string): Promise<void> {
    const key = this.getKey('current_user')
    await this.adapter.setItem(key, userId)
  }

  async getCurrentUser(): Promise<string | null> {
    const key = this.getKey('current_user')
    return await this.adapter.getItem(key)
  }

  async removeCurrentUser(): Promise<void> {
    const key = this.getKey('current_user')
    await this.adapter.removeItem(key)
  }

  async clear(): Promise<void> {
    await this.adapter.clear()
  }
}

export class CrossTabSync {
  private static instance: CrossTabSync
  private channel: BroadcastChannel
  private listeners: Set<(event: any) => void> = new Set()

  constructor(channelName: string = 'supabase-lite-auth-sync') {
    this.channel = new BroadcastChannel(channelName)
    this.channel.addEventListener('message', this.handleMessage.bind(this))
  }

  static getInstance(): CrossTabSync {
    if (!CrossTabSync.instance) {
      CrossTabSync.instance = new CrossTabSync()
    }
    return CrossTabSync.instance
  }

  private handleMessage(event: MessageEvent): void {
    this.listeners.forEach(listener => listener(event.data))
  }

  subscribe(listener: (event: any) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  broadcast(type: string, payload: any): void {
    this.channel.postMessage({ type, payload, timestamp: Date.now() })
  }

  close(): void {
    this.channel.close()
  }
}