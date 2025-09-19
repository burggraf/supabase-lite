import { WebVMManager } from '../WebVMManager'
import { RuntimeRepository } from '../RuntimeRepository'
import { ApplicationDeployer } from '../ApplicationDeployer'
import { PersistenceManager } from '../persistence/PersistenceManager'
import type { Application, ApplicationServerState, InstallOptions, RemoveOptions } from '../types'

const defaultState = (): ApplicationServerState => ({
  webvmStatus: WebVMManager.getInstance().getStatus(),
  packages: [],
  isBusy: false,
  isLoading: true,
  manifestError: null,
  bridgeAvailable: WebVMManager.getInstance().hasBridge(),
  applications: [],
})

export class ApplicationServerStore {
  private static instance: ApplicationServerStore

  static getInstance(): ApplicationServerStore {
    if (!ApplicationServerStore.instance) {
      ApplicationServerStore.instance = new ApplicationServerStore()
    }
    return ApplicationServerStore.instance
  }

  private constructor(
    private readonly webvm = WebVMManager.getInstance(),
    private readonly repository = RuntimeRepository.getInstance(WebVMManager.getInstance()),
    private readonly persistence = PersistenceManager.getInstance(),
    private readonly deployer = new ApplicationDeployer(),
  ) {
    this.state = defaultState()
    this.webvm.on('status', (status) => {
      this.update({ webvmStatus: status, bridgeAvailable: this.webvm.hasBridge() })
    })
    this.webvm.on('operation', () => {
      void this.refreshPackages({ force: false })
    })
  }

  private state: ApplicationServerState
  private listeners = new Set<() => void>()
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
    await this.webvm.hydrate()
    await this.refreshPackages({ force: false })
    const applications = await this.persistence.loadApplications()
    this.update({
      webvmStatus: this.webvm.getStatus(),
      bridgeAvailable: this.webvm.hasBridge(),
      applications,
    })
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): ApplicationServerState {
    return this.state
  }

  async ensureWebVM(): Promise<void> {
    await this.webvm.initialize()
    this.update({ webvmStatus: this.webvm.getStatus() })
  }

  async installRuntime(packageId: string, options: InstallOptions = {}): Promise<void> {
    await this.ensureWebVM()
    this.update({ isBusy: true })
    try {
      await this.repository.installPackage(packageId, options)
      await this.refreshPackages({ force: false })
    } finally {
      this.update({ isBusy: false })
    }
  }

  async removeRuntime(packageId: string, options: RemoveOptions = {}): Promise<void> {
    await this.ensureWebVM()
    this.update({ isBusy: true })
    try {
      await this.repository.removePackage(packageId, options)
      await this.refreshPackages({ force: false })
    } finally {
      this.update({ isBusy: false })
    }
  }

  async refreshPackages(options: { force: boolean } = { force: false }): Promise<void> {
    const shouldShowLoading = this.state.packages.length === 0
    if (shouldShowLoading) {
      this.update({ isLoading: true })
    }
    if (options.force) {
      await this.repository.refreshManifest()
    } else {
      await this.repository.initialize()
    }
    const snapshot = this.repository.snapshot()
    this.update({
      packages: snapshot.packages,
      manifestError: this.repository.getLastError(),
      isLoading: false,
      bridgeAvailable: this.webvm.hasBridge(),
    })
  }

  async deployStaticApplication(name: string, files: File[]): Promise<void> {
    if (!name.trim()) {
      throw new Error('Application name is required')
    }
    await this.ensureWebVM()

    const id = crypto.randomUUID()
    const app: Application = {
      id,
      name,
      kind: 'static',
      runtime: 'static-web',
      deployPath: `/opt/supabase/apps/${id}/public`,
      status: 'deploying',
      logsPath: `/opt/supabase/apps/${id}/server.log`,
      pidFile: `/opt/supabase/apps/${id}/server.pid`,
    }

    this.setApplications([...this.state.applications, app])

    try {
      await this.deployer.deployStaticApplication(app, files)
      const updated: Application = {
        ...app,
        status: 'stopped',
        lastDeployedAt: new Date(),
      }
      this.replaceApplication(updated)
    } catch (error) {
      const failed: Application = {
        ...app,
        status: 'error',
      }
      this.replaceApplication(failed)
      throw error
    }
  }

  async startApplication(appId: string): Promise<void> {
    await this.ensureWebVM()
    const app = this.getApplication(appId)
    if (!app) throw new Error('Application not found')
    if (app.status === 'running' || app.status === 'starting') return

    const port = app.port ?? this.allocatePort()
    const starting = { ...app, status: 'starting', port }
    this.replaceApplication(starting)

    try {
      await this.webvm.startStaticApplication(starting, port)
      this.replaceApplication({
        ...starting,
        status: 'running',
        lastStartedAt: new Date(),
      })
    } catch (error) {
      this.replaceApplication({ ...starting, status: 'error' })
      throw error
    }
  }

  async stopApplication(appId: string): Promise<void> {
    await this.ensureWebVM()
    const app = this.getApplication(appId)
    if (!app) throw new Error('Application not found')
    if (app.status !== 'running' && app.status !== 'starting') return

    this.replaceApplication({ ...app, status: 'stopping' })

    try {
      await this.webvm.stopStaticApplication(app)
      this.replaceApplication({ ...app, status: 'stopped' })
    } catch (error) {
      this.replaceApplication({ ...app, status: 'error' })
      throw error
    }
  }

  private getApplication(appId: string): Application | undefined {
    return this.state.applications.find((app) => app.id === appId)
  }

  private allocatePort(): number {
    const used = new Set<number>(
      this.state.applications
        .map((app) => app.port)
        .filter((port): port is number => port != null),
    )
    const base = 4210
    let candidate = base
    while (used.has(candidate)) {
      candidate += 1
    }
    return candidate
  }

  private replaceApplication(application: Application): void {
    const next = this.state.applications.map((current) =>
      current.id === application.id ? application : current,
    )
    this.setApplications(next)
  }

  private setApplications(applications: Application[]): void {
    this.state = { ...this.state, applications }
    this.listeners.forEach((listener) => listener())
    void this.persistence.saveApplications(applications)
  }

  private update(partial: Partial<ApplicationServerState>): void {
    this.state = { ...this.state, ...partial }
    if (partial.applications) {
      void this.persistence.saveApplications(partial.applications)
    }
    this.listeners.forEach((listener) => listener())
  }
}
