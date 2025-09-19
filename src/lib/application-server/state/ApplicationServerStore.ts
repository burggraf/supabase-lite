import { WebVMManager } from '../WebVMManager'
import { RuntimeRepository } from '../RuntimeRepository'
import type {
  ApplicationServerState,
  InstallOptions,
  RemoveOptions,
} from '../types'

const defaultState = (): ApplicationServerState => ({
  webvmStatus: WebVMManager.getInstance().getStatus(),
  packages: [],
  isBusy: false,
  isLoading: true,
  manifestError: null,
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
  ) {
    this.state = defaultState()
    this.webvm.on('status', (status) => {
      this.update({ webvmStatus: status })
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
    this.update({ webvmStatus: this.webvm.getStatus() })
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
    })
  }

  private update(partial: Partial<ApplicationServerState>): void {
    this.state = { ...this.state, ...partial }
    this.listeners.forEach((listener) => listener())
  }
}
