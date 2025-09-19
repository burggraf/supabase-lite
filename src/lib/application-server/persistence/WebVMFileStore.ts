import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

interface FileRecord {
  runtimeId: string
  path: string
  storedAt: string
  size: number
  data: ArrayBuffer
}

interface WebVMFileDB extends DBSchema {
  files: {
    key: string
    value: FileRecord
  }
}

const DB_NAME = 'supabase-lite.application-server.webvm-files'
const DB_VERSION = 1

export class WebVMFileStore {
  private static instance: WebVMFileStore
  private dbPromise?: Promise<IDBPDatabase<WebVMFileDB>>

  static getInstance(): WebVMFileStore {
    if (!WebVMFileStore.instance) {
      WebVMFileStore.instance = new WebVMFileStore()
    }
    return WebVMFileStore.instance
  }

  private constructor() {}

  async writeFile(runtimeId: string, path: string, data: ArrayBuffer): Promise<void> {
    const db = await this.getDb()
    const record: FileRecord = {
      runtimeId,
      path,
      storedAt: new Date().toISOString(),
      size: data.byteLength,
      data,
    }
    await db.put('files', record, this.makeKey(runtimeId, path))
  }

  async readFile(runtimeId: string, path: string): Promise<ArrayBuffer | null> {
    const db = await this.getDb()
    const record = await db.get('files', this.makeKey(runtimeId, path))
    return record?.data ?? null
  }

  async listFiles(runtimeId: string): Promise<FileRecord[]> {
    const db = await this.getDb()
    const tx = db.transaction('files', 'readonly')
    const records: FileRecord[] = []
    for await (const cursor of tx.store.iterate()) {
      if (cursor.value.runtimeId === runtimeId) {
        records.push(cursor.value)
      }
    }
    await tx.done
    return records
  }

  async deleteFiles(runtimeId: string): Promise<void> {
    const db = await this.getDb()
    const tx = db.transaction('files', 'readwrite')
    for await (const cursor of tx.store.iterate()) {
      if (cursor.value.runtimeId === runtimeId) {
        await cursor.delete()
      }
    }
    await tx.done
  }

  async clearAll(): Promise<void> {
    const db = await this.getDb()
    const tx = db.transaction('files', 'readwrite')
    await tx.store.clear()
    await tx.done
  }

  private makeKey(runtimeId: string, path: string): string {
    return `${runtimeId}:${path}`
  }

  private async getDb(): Promise<IDBPDatabase<WebVMFileDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<WebVMFileDB>(DB_NAME, DB_VERSION, {
        upgrade(database) {
          if (!database.objectStoreNames.contains('files')) {
            database.createObjectStore('files')
          }
        },
      })
    }
    return this.dbPromise
  }
}
