import { PersistenceManager } from './persistence/PersistenceManager'
import type {
  InstallOptions,
  InstallResult,
  RemoveOptions,
  RemoveResult,
  RuntimeOperation,
  RuntimePackage,
  RuntimeRepositorySnapshot,
} from './types'
import type { WebVMManager } from './WebVMManager'

interface RuntimeManifest {
  packages: Array<RuntimeManifestEntry>
  version: string
  generatedAt: string
}

interface RuntimeManifestEntry {
  id: string
  name: string
  description: string
  category: RuntimePackage['category']
  version: string
  size: number
  extractedSize?: number
  dependencies?: string[]
  conflicts?: string[]
  sourceUrl?: string
  documentationUrl?: string
  postInstallCommands?: string[]
  serviceUnits?: Array<{
    name: string
    enable?: boolean
    start?: boolean
  }>
}

const MANIFEST_URL = '/runtime-packages/index.json'
const timestamp = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now())

export class RuntimeRepository {
  private static instance: RuntimeRepository

  static getInstance(webvm: WebVMManager): RuntimeRepository {
    if (!RuntimeRepository.instance) {
      RuntimeRepository.instance = new RuntimeRepository(webvm)
    }
    return RuntimeRepository.instance
  }

  private constructor(private readonly webvm: WebVMManager) {}

  private persistence = PersistenceManager.getInstance()
  private packages = new Map<string, RuntimePackage>()
  private manifestVersion?: string
  private lastLoaded?: Date
  private isLoading = false
  private lastError: string | null = null
  private snapshotHydrated = false

  async initialize(): Promise<void> {
    if (this.isLoading) return

    if (!this.snapshotHydrated) {
      this.isLoading = true
      try {
        const snapshot = await this.persistence.loadRuntimeSnapshot()
        if (snapshot) {
          snapshot.packages.forEach((pkg) => this.packages.set(pkg.id, pkg))
          this.manifestVersion = snapshot.lastUpdated.toISOString()
        }
        this.snapshotHydrated = true
      } finally {
        this.isLoading = false
      }
    }

    if (this.lastLoaded) {
      return
    }

    this.isLoading = true
    try {
      const manifest = await this.fetchManifest()
      this.mergeManifest(manifest)
      this.lastLoaded = new Date()
      this.lastError = null
      await this.persistSnapshot()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.lastError = message
      this.lastLoaded = new Date()
      console.warn('[RuntimeRepository] Failed to load runtime manifest:', message)
    } finally {
      this.isLoading = false
    }
  }

  async getAvailablePackages(): Promise<RuntimePackage[]> {
    await this.initialize()
    return Array.from(this.packages.values())
  }

  async getInstalledPackages(): Promise<RuntimePackage[]> {
    const packages = await this.getAvailablePackages()
    return packages.filter((pkg) => pkg.status === 'installed')
  }

  async getPackageInfo(packageId: string): Promise<RuntimePackage | null> {
    await this.initialize()
    return this.packages.get(packageId) ?? null
  }

  async installPackage(packageId: string, options: InstallOptions = {}): Promise<InstallResult> {
    await this.initialize()
    const target = this.packages.get(packageId)
    if (!target) {
      throw new Error(`Runtime package "${packageId}" not found`)
    }

    if (target.status === 'installed') {
      return {
        success: true,
        packageId,
        installedPackages: [packageId],
        warnings: ['Package already installed'],
        logs: [],
        timeElapsedMs: 0,
      }
    }

    const warnings: string[] = []
    const dependencies = this.resolveDependencies(packageId)
    const missingDependencies = dependencies.filter((dep) => this.packages.get(dep)?.status !== 'installed')

    if (missingDependencies.length > 0 && !options.skipDependencies) {
      for (const dependency of missingDependencies) {
        await this.installPackage(dependency, options)
      }
    }

    target.status = 'installing'
    await this.persistSnapshot()

    const operation: RuntimeOperation = {
      id: globalThis.crypto?.randomUUID() ?? Math.random().toString(36).slice(2),
      packageId,
      type: 'install',
      status: 'running',
      startedAt: new Date(),
      logs: ['Preparing installation'],
    }
    this.webvm.emitOperation(operation)

    const start = timestamp()

    try {
      await this.webvm.ensureRunning()
      await this.webvm.installRuntimePackage(target)
      target.status = 'installed'
      target.installDate = new Date()
      target.installDurationMs = timestamp() - start
      operation.status = 'succeeded'
      operation.finishedAt = new Date()
      operation.logs.push('Installation completed')
      await this.persistSnapshot()
      this.webvm.emitOperation(operation)
      return {
        success: true,
        packageId,
        installedPackages: [packageId, ...dependencies],
        warnings,
        logs: operation.logs,
        timeElapsedMs: target.installDurationMs ?? 0,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      target.status = 'error'
      target.errorMessage = message
      operation.status = 'failed'
      operation.finishedAt = new Date()
      operation.errorMessage = message
      operation.logs.push(message)
      await this.persistSnapshot()
      this.webvm.emitOperation(operation)
      return {
        success: false,
        packageId,
        installedPackages: [],
        warnings,
        logs: operation.logs,
        timeElapsedMs: timestamp() - start,
        errorMessage: message,
      }
    }
  }

  async removePackage(packageId: string, options: RemoveOptions = {}): Promise<RemoveResult> {
    await this.initialize()
    const target = this.packages.get(packageId)
    if (!target) {
      throw new Error(`Runtime package "${packageId}" not found`)
    }

    if (target.status !== 'installed') {
      return {
        success: true,
        packageId,
        removedPackages: [],
        warnings: ['Package is not installed'],
        logs: [],
        timeElapsedMs: 0,
      }
    }

    target.status = 'removing'
    await this.persistSnapshot()

    const operation: RuntimeOperation = {
      id: globalThis.crypto?.randomUUID() ?? Math.random().toString(36).slice(2),
      packageId,
      type: 'remove',
      status: 'running',
      startedAt: new Date(),
      logs: ['Preparing removal'],
    }
    this.webvm.emitOperation(operation)

    const start = timestamp()

    try {
      await this.webvm.ensureRunning()
      await this.webvm.removeRuntimePackage(target, options)
      target.status = 'available'
      target.installDate = undefined
      target.installDurationMs = undefined
      target.errorMessage = undefined
      operation.status = 'succeeded'
      operation.finishedAt = new Date()
      operation.logs.push('Removal completed')
      await this.persistSnapshot()
      this.webvm.emitOperation(operation)
      return {
        success: true,
        packageId,
        removedPackages: [packageId],
        warnings: [],
        logs: operation.logs,
        timeElapsedMs: timestamp() - start,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      target.status = 'error'
      target.errorMessage = message
      operation.status = 'failed'
      operation.finishedAt = new Date()
      operation.errorMessage = message
      operation.logs.push(message)
      await this.persistSnapshot()
      this.webvm.emitOperation(operation)
      return {
        success: false,
        packageId,
        removedPackages: [],
        warnings: [],
        logs: operation.logs,
        timeElapsedMs: timestamp() - start,
        errorMessage: message,
      }
    }
  }

  resolveDependencies(packageId: string): string[] {
    const pkg = this.packages.get(packageId)
    if (!pkg) return []
    return pkg.dependencies ?? []
  }

  private async fetchManifest(): Promise<RuntimeManifest> {
    const response = await fetch(MANIFEST_URL, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`Failed to load runtime manifest (${response.status})`)
    }
    return response.json() as Promise<RuntimeManifest>
  }

  private mergeManifest(manifest: RuntimeManifest) {
    manifest.packages.forEach((entry) => {
      const existing = this.packages.get(entry.id)
      const normalized: RuntimePackage = {
        id: entry.id,
        name: entry.name,
        description: entry.description,
        category: entry.category,
        version: entry.version,
        size: entry.size,
        extractedSize: entry.extractedSize,
        dependencies: entry.dependencies ?? [],
        conflicts: entry.conflicts ?? [],
        status: existing?.status ?? 'available',
        sourceUrl: entry.sourceUrl,
        documentationUrl: entry.documentationUrl,
        installDate: existing?.installDate,
        lastUsed: existing?.lastUsed,
        installDurationMs: existing?.installDurationMs,
        errorMessage: existing?.errorMessage,
        postInstallCommands: entry.postInstallCommands ?? existing?.postInstallCommands,
        serviceUnits: entry.serviceUnits ?? existing?.serviceUnits,
      }
      this.packages.set(entry.id, normalized)
    })
    this.manifestVersion = manifest.version
  }

  private async persistSnapshot(): Promise<void> {
    const packages = Array.from(this.packages.values())
    const snapshot: RuntimeRepositorySnapshot = {
      packages,
      lastUpdated: new Date(),
    }
    await this.persistence.saveRuntimeSnapshot(snapshot)
  }

  snapshot(): RuntimeRepositorySnapshot {
    return {
      packages: Array.from(this.packages.values()),
      lastUpdated: new Date(),
    }
  }

  getLastError(): string | null {
    return this.lastError
  }

  isManifestLoading(): boolean {
    return this.isLoading
  }

  async refreshManifest(): Promise<void> {
    this.lastLoaded = undefined
    await this.initialize()
  }
}
