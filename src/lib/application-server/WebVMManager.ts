import { PersistenceManager } from './persistence/PersistenceManager'
import { RuntimeBundleStore } from './persistence/RuntimeBundleStore'
import { WebVMFileStore } from './persistence/WebVMFileStore'
import { WebVMBridge, WebVMUnavailableError } from './WebVMBridge'
import { extractTar } from './utils/tar'
import type {
  Application,
  EventCallback,
  EventUnsubscribe,
  InstallOptions,
  InstallResult,
  RemoveOptions,
  RuntimeOperation,
  RuntimePackage,
  WebVMEventType,
  WebVMStatus,
} from './types'

const DEFAULT_STATUS: WebVMStatus = {
  state: 'unloaded',
  loadProgress: 0,
  installedRuntimes: [],
  runningApps: [],
  systemResources: {},
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class WebVMManager {
  private static instance: WebVMManager

  static getInstance(): WebVMManager {
    if (!WebVMManager.instance) {
      WebVMManager.instance = new WebVMManager()
    }
    return WebVMManager.instance
  }

  private constructor() {}

  static async __resetForTests(): Promise<void> {
    if (WebVMManager.instance) {
      await Promise.all([
        WebVMManager.instance.bundles.clearAll(),
        WebVMManager.instance.files.clearAll(),
      ])
    } else {
      await Promise.all([
        RuntimeBundleStore.getInstance().clearAll(),
        WebVMFileStore.getInstance().clearAll(),
      ])
    }
    await PersistenceManager.getInstance().clear()
    WebVMManager.instance = undefined
  }

  private readonly persistence = PersistenceManager.getInstance()
  private readonly bundles = RuntimeBundleStore.getInstance()
  private readonly files = WebVMFileStore.getInstance()
  private readonly bridge = WebVMBridge.getInstance()
  private status: WebVMStatus = DEFAULT_STATUS
  private initialized = false
  private listeners: Partial<{ [K in WebVMEventType]: Set<EventCallback<K>> }> = {}
  private isBooting = false

  async hydrate(): Promise<void> {
    if (this.initialized) return
    const stored = await this.persistence.loadWebVMStatus()
    if (stored) {
      this.status = stored
    }
    this.initialized = true
  }

  getStatus(): WebVMStatus {
    return this.status
  }

  hasBridge(): boolean {
    return this.bridge.isAvailable()
  }

  async initialize(): Promise<void> {
    await this.hydrate()
    const currentState = this.status.state

    if (currentState === 'ready' || currentState === 'loading' || currentState === 'booting') {
      return
    }

    if (currentState === 'hibernating') {
      this.updateStatus({ state: 'booting' })
      await wait(150)
      this.updateStatus({ state: 'ready', loadProgress: 100 })
      return
    }

    if (currentState !== 'unloaded' && currentState !== 'error') {
      return
    }

    this.updateStatus({ state: 'loading', loadProgress: 0 })
    for (let i = 1; i <= 3; i += 1) {
      await wait(150)
      this.updateStatus({ loadProgress: Math.min(90, i * 30) })
    }
    this.updateStatus({ state: 'booting', loadProgress: 95 })
    await wait(200)
    this.updateStatus({ state: 'ready', loadProgress: 100, bootTime: new Date() })
  }

  async ensureRunning(): Promise<void> {
    await this.initialize()
    if (this.status.state === 'hibernating') {
      this.updateStatus({ state: 'booting' })
      await wait(100)
      this.updateStatus({ state: 'ready' })
    }
    if (this.status.state !== 'ready') {
      throw new Error('WebVM failed to start')
    }
  }

  async start(): Promise<void> {
    await this.ensureRunning()
  }

  async stop(): Promise<void> {
    if (this.status.state === 'unloaded') return
    this.updateStatus({ state: 'hibernating', runningApps: [], systemResources: {} })
    await wait(50)
    await this.persistence.saveWebVMStatus(this.status)
  }

  async restart(): Promise<void> {
    this.updateStatus({ state: 'booting' })
    await wait(200)
    this.updateStatus({ state: 'ready', bootTime: new Date() })
  }

  async installRuntimePackage(pkg: RuntimePackage, options: InstallOptions = {}): Promise<InstallResult> {
    await this.ensureRunning()
    void options

    const logs: string[] = []
    const start = Date.now()
    let downloadedBundle: ArrayBuffer | null = null

    if (pkg.sourceUrl) {
      if (typeof fetch !== 'function') {
        throw new Error('Runtime bundle fetching is not supported in this environment')
      }
      logs.push(`Downloading runtime bundle from ${pkg.sourceUrl}`)
      const response = await fetch(pkg.sourceUrl)
      if (!response.ok) {
        throw new Error(`Failed to download runtime bundle (status: ${response.status})`)
      }
      downloadedBundle = await response.arrayBuffer()
      const sizeKb = Math.max(1, Math.round(downloadedBundle.byteLength / 1024))
      logs.push(`Fetched ${sizeKb} KB`)
      await wait(150)
    } else {
      logs.push('No runtime bundle associated, skipping download step')
    }

    await wait(250)
    const installed = new Set(this.status.installedRuntimes)
    installed.add(pkg.id)
    this.updateStatus({ installedRuntimes: Array.from(installed) })
    const bundle = downloadedBundle ?? new ArrayBuffer(0)
    await this.bundles.saveBundle(pkg.id, bundle)
    const root = this.runtimeRoot(pkg.id)
    await this.files.writeFile(pkg.id, `${root}/bundle.tar`, bundle)

    const entries = bundle.byteLength > 0 ? extractTar(bundle) : []
    let extractedFiles = 0
    const executablePaths: string[] = []

    for (const entry of entries) {
      const sanitizedName = entry.name.replace(/^\/+/g, '').replace(/\/+/g, '/')
      const basePath = `${root}/${sanitizedName}`.replace(/\/+/g, '/').replace(/\/+$/, '')
      if (entry.type === 'file') {
        await this.files.writeFile(pkg.id, basePath, entry.data)
        extractedFiles += 1
        if (this.shouldMarkExecutable(entry.name)) {
          executablePaths.push(basePath)
        }
      } else {
        await this.files.writeFile(pkg.id, `${basePath}/`, new ArrayBuffer(0))
      }
    }

    if (this.bridge.isAvailable()) {
      try {
        await this.bridge.ensureDirectory(root)
        await this.bridge.writeFile(`${root}/bundle.tar`, bundle)
        if (bundle.byteLength > 0) {
          await this.bridge.exec('tar', ['-xf', `${root}/bundle.tar`, '-C', root])
          for (const path of executablePaths) {
            await this.bridge.exec('chmod', ['+x', path])
          }
        }
        logs.push(`Runtime staged inside WebVM via tar (${extractedFiles} files)`)
      } catch (error) {
        logs.push(`WebVM extraction failed: ${error instanceof Error ? error.message : String(error)}`)
        logs.push('Falling back to browser-side extracted files only')
      }
    } else if (bundle.byteLength > 0) {
      logs.push('WebVM bridge unavailable; runtime files stored locally for later injection')
    } else {
      logs.push('Runtime staged inside WebVM storage (empty bundle)')
    }

    if (pkg.postInstallCommands?.length) {
      if (!this.bridge.isAvailable()) {
        logs.push('WebVM bridge unavailable; post-install commands not executed')
      } else if (options.dryRun) {
        logs.push('Dry run enabled; skipping post-install commands')
      } else {
        for (const command of pkg.postInstallCommands) {
          try {
            await this.execInShell(command)
            logs.push(`post-install: ${command}`)
          } catch (error) {
            logs.push(`post-install failed (${command}): ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      }
    }

    if (pkg.serviceUnits?.length) {
      if (!this.bridge.isAvailable()) {
        logs.push('WebVM bridge unavailable; service units not configured')
      } else if (options.enableServices === false) {
        logs.push('Service enablement disabled via install options; skipping service unit configuration')
      } else if (options.dryRun) {
        logs.push('Dry run enabled; skipping service unit configuration')
      } else {
        for (const unit of pkg.serviceUnits) {
          try {
            if (unit.enable !== false) {
              await this.bridge.exec('systemctl', ['enable', unit.name])
              logs.push(`systemctl enable ${unit.name}`)
            }
            if (unit.start !== false) {
              await this.bridge.exec('systemctl', ['start', unit.name])
              logs.push(`systemctl start ${unit.name}`)
            }
          } catch (error) {
            logs.push(`Failed to configure service ${unit.name}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      }
    }

    logs.push(`Cached runtime contents locally (${extractedFiles} files) for offline use`)

    return {
      success: true,
      packageId: pkg.id,
      installedPackages: [pkg.id],
      warnings: [],
      logs,
      timeElapsedMs: Date.now() - start,
    }
  }

  async removeRuntimePackage(pkg: RuntimePackage, options: RemoveOptions = {}): Promise<void> {
    await this.ensureRunning()
    void options
    await wait(150)
    const installed = new Set(this.status.installedRuntimes)
    installed.delete(pkg.id)
    this.updateStatus({ installedRuntimes: Array.from(installed) })
    await Promise.all([
      this.bundles.deleteBundle(pkg.id),
      this.files.deleteFiles(pkg.id),
    ])
    if (this.bridge.isAvailable()) {
      await this.bridge.removeDirectory(this.runtimeRoot(pkg.id))
    }
  }

  async hasRuntimeBundle(runtimeId: string): Promise<boolean> {
    return this.bundles.hasBundle(runtimeId)
  }

  async listRuntimeFiles(runtimeId: string) {
    return this.files.listFiles(runtimeId)
  }

  emitOperation(operation: RuntimeOperation): void {
    this.emit('operation', operation)
  }

  private runtimeRoot(runtimeId: string): string {
    return `/opt/supabase/runtimes/${runtimeId}`
  }

  private parentDirectory(path: string): string | null {
    const normalized = path.replace(/\/+$/, '')
    const index = normalized.lastIndexOf('/')
    if (index <= 0) return null
    return normalized.substring(0, index)
  }

  private shouldMarkExecutable(name: string): boolean {
    return /(^|\/)bin\//.test(name) || name.endsWith('.sh')
  }

  private async execInShell(command: string): Promise<void> {
    await this.bridge.exec('/bin/sh', ['-lc', command])
  }

  async startStaticApplication(app: Application, port: number): Promise<void> {
    if (!this.bridge.isAvailable()) {
      console.warn('[WebVMManager] bridge unavailable, marking static app as running without VM process')
      return
    }
    const publicPath = app.deployPath
    const logsPath = app.logsPath ?? `${this.runtimeRoot(app.id)}/server.log`
    const pidFile = app.pidFile ?? `${this.runtimeRoot(app.id)}/server.pid`

    await this.bridge.ensureDirectory(this.runtimeRoot(app.id))
    await this.bridge.ensureDirectory(publicPath)
    await this.execInShell(
      `cd ${publicPath} && nohup python3 -m http.server ${port} >${logsPath} 2>&1 & echo $! > ${pidFile}`,
    )
  }

  async stopStaticApplication(app: Application): Promise<void> {
    if (!this.bridge.isAvailable()) {
      console.warn('[WebVMManager] bridge unavailable, treating static app as stopped')
      return
    }
    const pidFile = app.pidFile ?? `${this.runtimeRoot(app.id)}/server.pid`
    await this.execInShell(
      `if [ -f ${pidFile} ]; then kill $(cat ${pidFile}) >/dev/null 2>&1 || true; rm -f ${pidFile}; fi`,
    )
  }

  async proxyStaticApplication(app: Application, relativePath: string, request: Request): Promise<Response | null> {
    if (!this.bridge.isAvailable() || !app.port) {
      return null
    }

    const targetUrl = `http://127.0.0.1:${app.port}/${relativePath}`.replace(/\/+/, '/').replace(/(?<!:)\/\//g, '/')
    const init: RequestInit = {
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
    }

    if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
      init.body = await request.clone().arrayBuffer()
    }

    try {
      return await this.bridge.fetch(targetUrl, init)
    } catch (error) {
      console.warn('[WebVMManager] proxyStaticApplication failed', error)
      return null
    }
  }

  on<T extends WebVMEventType>(type: T, callback: EventCallback<T>): EventUnsubscribe {
    if (!this.listeners[type]) {
      this.listeners[type] = new Set()
    }
    const set = this.listeners[type] as Set<EventCallback<T>>
    set.add(callback)
    return () => {
      set.delete(callback)
      if (set.size === 0) {
        delete this.listeners[type]
      }
    }
  }

  private emit<T extends WebVMEventType>(type: T, payload: Parameters<EventCallback<T>>[0]): void {
    const listeners = this.listeners[type] as Set<EventCallback<T>> | undefined
    if (!listeners) return
    listeners.forEach((listener) => {
      try {
        listener(payload)
      } catch (error) {
        console.error('[WebVMManager] listener error', error)
      }
    })
  }

  private updateStatus(partial: Partial<WebVMStatus>): void {
    this.status = {
      ...this.status,
      ...partial,
    }
    void this.persistence.saveWebVMStatus(this.status)
    this.emit('status', this.status)
  }
}
