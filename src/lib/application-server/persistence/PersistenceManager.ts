import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  Application,
  RuntimePackage,
  RuntimeRepositorySnapshot,
  WebVMStatus,
} from '../types'

interface ApplicationServerDB extends DBSchema {
  'webvm-status': {
    key: string
    value: SerializedWebVMStatus
  }
  'runtime-packages': {
    key: string
    value: SerializedRuntimeSnapshot
  }
  applications: {
    key: string
    value: SerializedApplications
  }
}

type SerializedWebVMStatus = ReturnType<typeof serializeWebVMStatus>

type SerializedRuntimeSnapshot = ReturnType<typeof serializeRuntimeSnapshot>

type SerializedApplications = ReturnType<typeof serializeApplications>

const DB_NAME = 'supabase-lite.application-server'
const DB_VERSION = 2
const WEBVM_STATUS_KEY = 'singleton'
const RUNTIME_SNAPSHOT_KEY = 'snapshot'
const APPLICATIONS_KEY = 'applications'

export class PersistenceManager {
  private static instance: PersistenceManager
  private dbPromise?: Promise<IDBPDatabase<ApplicationServerDB>>

  static getInstance(): PersistenceManager {
    if (!PersistenceManager.instance) {
      PersistenceManager.instance = new PersistenceManager()
    }
    return PersistenceManager.instance
  }

  async saveWebVMStatus(status: WebVMStatus): Promise<void> {
    const db = await this.getDb()
    await db.put('webvm-status', serializeWebVMStatus(status), WEBVM_STATUS_KEY)
  }

  async loadWebVMStatus(): Promise<WebVMStatus | null> {
    const db = await this.getDb()
    const stored = await db.get('webvm-status', WEBVM_STATUS_KEY)
    if (!stored) return null
    return deserializeWebVMStatus(stored)
  }

  async saveRuntimeSnapshot(snapshot: RuntimeRepositorySnapshot): Promise<void> {
    const db = await this.getDb()
    await db.put('runtime-packages', serializeRuntimeSnapshot(snapshot), RUNTIME_SNAPSHOT_KEY)
  }

  async loadRuntimeSnapshot(): Promise<RuntimeRepositorySnapshot | null> {
    const db = await this.getDb()
    const stored = await db.get('runtime-packages', RUNTIME_SNAPSHOT_KEY)
    if (!stored) return null
    return deserializeRuntimeSnapshot(stored)
  }

  async clear(): Promise<void> {
    const db = await this.getDb()
    await Promise.all([
      db.delete('webvm-status', WEBVM_STATUS_KEY),
      db.delete('runtime-packages', RUNTIME_SNAPSHOT_KEY),
      db.delete('applications', APPLICATIONS_KEY),
    ])
  }

  async saveApplications(applications: Application[]): Promise<void> {
    const db = await this.getDb()
    await db.put('applications', serializeApplications(applications), APPLICATIONS_KEY)
  }

  async loadApplications(): Promise<Application[]> {
    const db = await this.getDb()
    const stored = await db.get('applications', APPLICATIONS_KEY)
    if (!stored) return []
    return deserializeApplications(stored)
  }

  private async getDb(): Promise<IDBPDatabase<ApplicationServerDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<ApplicationServerDB>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
          if (!db.objectStoreNames.contains('webvm-status')) {
            db.createObjectStore('webvm-status')
          }
          if (!db.objectStoreNames.contains('runtime-packages')) {
            db.createObjectStore('runtime-packages')
          }
          if (oldVersion < 2 && !db.objectStoreNames.contains('applications')) {
            db.createObjectStore('applications')
          }
        },
      })
    }
    return this.dbPromise
  }
}

function serializeWebVMStatus(status: WebVMStatus) {
  return {
    ...status,
    bootTime: status.bootTime?.toISOString() ?? null,
    lastHeartbeat: status.lastHeartbeat?.toISOString() ?? null,
  }
}

function deserializeWebVMStatus(value: SerializedWebVMStatus): WebVMStatus {
  return {
    ...value,
    bootTime: value.bootTime ? new Date(value.bootTime) : undefined,
    lastHeartbeat: value.lastHeartbeat ? new Date(value.lastHeartbeat) : undefined,
  }
}

function serializeRuntimeSnapshot({ packages, lastUpdated }: RuntimeRepositorySnapshot) {
  return {
    lastUpdated: lastUpdated.toISOString(),
    packages: packages.map((pkg) => ({
      ...pkg,
      installDate: pkg.installDate?.toISOString() ?? null,
      lastUsed: pkg.lastUsed?.toISOString() ?? null,
    })),
  }
}

function deserializeRuntimeSnapshot(value: SerializedRuntimeSnapshot): RuntimeRepositorySnapshot {
  return {
    lastUpdated: new Date(value.lastUpdated),
    packages: value.packages.map((pkg) => ({
      ...pkg,
      installDate: pkg.installDate ? new Date(pkg.installDate) : undefined,
      lastUsed: pkg.lastUsed ? new Date(pkg.lastUsed) : undefined,
    })),
  }
}

function serializeApplications(applications: Application[]) {
  return applications.map((app) => ({
    ...app,
    lastDeployedAt: app.lastDeployedAt?.toISOString() ?? null,
    lastStartedAt: app.lastStartedAt?.toISOString() ?? null,
  }))
}

function deserializeApplications(records: SerializedApplications): Application[] {
  return records.map((app) => ({
    ...app,
    lastDeployedAt: app.lastDeployedAt ? new Date(app.lastDeployedAt) : undefined,
    lastStartedAt: app.lastStartedAt ? new Date(app.lastStartedAt) : undefined,
  }))
}
