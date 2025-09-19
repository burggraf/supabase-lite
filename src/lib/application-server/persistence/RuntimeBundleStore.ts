import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

interface RuntimeBundleRecord {
  id: string
  size: number
  storedAt: string
  data: ArrayBuffer
}

interface RuntimeBundleDB extends DBSchema {
  bundles: {
    key: string
    value: RuntimeBundleRecord
  }
}

const DB_NAME = 'supabase-lite.application-server.runtime-bundles'
const DB_VERSION = 1

export class RuntimeBundleStore {
  private static instance: RuntimeBundleStore
  private dbPromise?: Promise<IDBPDatabase<RuntimeBundleDB>>

  static getInstance(): RuntimeBundleStore {
    if (!RuntimeBundleStore.instance) {
      RuntimeBundleStore.instance = new RuntimeBundleStore()
    }
    return RuntimeBundleStore.instance
  }

  private constructor() {}

  async saveBundle(runtimeId: string, data: ArrayBuffer): Promise<void> {
    const db = await this.getDb()
    const record: RuntimeBundleRecord = {
      id: runtimeId,
      size: data.byteLength,
      storedAt: new Date().toISOString(),
      data,
    }
    await db.put('bundles', record, runtimeId)
  }

  async deleteBundle(runtimeId: string): Promise<void> {
    const db = await this.getDb()
    await db.delete('bundles', runtimeId)
  }

  async hasBundle(runtimeId: string): Promise<boolean> {
    const db = await this.getDb()
    const record = await db.get('bundles', runtimeId)
    return Boolean(record)
  }

  async getBundle(runtimeId: string): Promise<ArrayBuffer | null> {
    const db = await this.getDb()
    const record = await db.get('bundles', runtimeId)
    return record?.data ?? null
  }

  async getMetadata(runtimeId: string): Promise<RuntimeBundleRecord | null> {
    const db = await this.getDb()
    const record = await db.get('bundles', runtimeId)
    return record ?? null
  }

  async clearAll(): Promise<void> {
    const db = await this.getDb()
    const tx = db.transaction('bundles', 'readwrite')
    await tx.store.clear()
    await tx.done
  }

  private async getDb(): Promise<IDBPDatabase<RuntimeBundleDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<RuntimeBundleDB>(DB_NAME, DB_VERSION, {
        upgrade(database) {
          if (!database.objectStoreNames.contains('bundles')) {
            database.createObjectStore('bundles')
          }
        },
      })
    }
    return this.dbPromise
  }
}
