import type { IDBPDatabase } from 'idb'

export type WebVMState = 'unloaded' | 'loading' | 'booting' | 'ready' | 'hibernating' | 'error'

export interface SystemResources {
  memoryUsed?: number
  memoryTotal?: number
  diskUsed?: number
  diskTotal?: number
  cpuUsage?: number
  processCount?: number
  uptimeSeconds?: number
}

export interface WebVMStatus {
  state: WebVMState
  loadProgress: number
  bootTime?: Date
  lastHeartbeat?: Date
  installedRuntimes: string[]
  runningApps: string[]
  systemResources: SystemResources
  errorMessage?: string
}

export type RuntimeCategory = 'web-server' | 'runtime' | 'framework' | 'tool'

export type PackageStatus = 'available' | 'downloading' | 'installing' | 'installed' | 'removing' | 'error'

export interface RuntimePackage {
  id: string
  name: string
  description: string
  category: RuntimeCategory
  version: string
  size: number
  extractedSize?: number
  dependencies: string[]
  conflicts: string[]
  status: PackageStatus
  sourceUrl?: string
  documentationUrl?: string
  installDate?: Date
  lastUsed?: Date
  installDurationMs?: number
  errorMessage?: string
  postInstallCommands?: string[]
  serviceUnits?: RuntimeServiceUnit[]
}

export interface RuntimeServiceUnit {
  name: string
  enable?: boolean
  start?: boolean
}

export interface InstallOptions {
  force?: boolean
  skipDependencies?: boolean
  enableServices?: boolean
  timeoutSeconds?: number
  dryRun?: boolean
}

export interface RemoveOptions {
  force?: boolean
  removeUnused?: boolean
  disableServices?: boolean
  backup?: boolean
  dryRun?: boolean
}

export interface InstallResult {
  success: boolean
  packageId: string
  installedPackages: string[]
  warnings: string[]
  logs: string[]
  timeElapsedMs: number
  diskSpaceUsedMb?: number
  errorMessage?: string
}

export interface RemoveResult {
  success: boolean
  packageId: string
  removedPackages: string[]
  warnings: string[]
  logs: string[]
  timeElapsedMs: number
  diskSpaceFreedMb?: number
  errorMessage?: string
}

export interface RuntimeRepositorySnapshot {
  packages: RuntimePackage[]
  lastUpdated: Date
}

export interface ApplicationServerState {
  webvmStatus: WebVMStatus
  packages: RuntimePackage[]
  isBusy: boolean
  isLoading: boolean
  manifestError: string | null
  lastOperation?: RuntimeOperation
}

export interface RuntimeOperation {
  id: string
  packageId: string
  type: 'install' | 'remove'
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  startedAt: Date
  finishedAt?: Date
  logs: string[]
  errorMessage?: string
}

export interface PersistenceDriver<T = unknown> {
  initialize(): Promise<IDBPDatabase<T>>
}

export interface WebVMEventMap {
  status: WebVMStatus
  operation: RuntimeOperation
  error: Error
}

export type WebVMEventType = keyof WebVMEventMap

export type EventUnsubscribe = () => void

export type EventCallback<T extends WebVMEventType> = (payload: WebVMEventMap[T]) => void
