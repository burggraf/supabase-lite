export class WebVMUnavailableError extends Error {
  constructor(message = 'WebVM bridge unavailable') {
    super(message)
    this.name = 'WebVMUnavailableError'
  }
}

export class WebVMUnsupportedError extends Error {
  constructor(operation: string) {
    super(`WebVM bridge does not support ${operation}`)
    this.name = 'WebVMUnsupportedError'
  }
}

type WebVMLike = {
  writeFile?: (path: string, data: Uint8Array) => Promise<void> | void
  exec?: (command: string, args?: string[]) => Promise<unknown> | unknown
  fs?: {
    writeFile?: (path: string, data: Uint8Array) => Promise<void> | void
  }
  runtime?: {
    exec?: (command: string, args?: string[]) => Promise<unknown> | unknown
  }
  ensureDir?: (path: string) => Promise<void> | void
  removeDir?: (path: string) => Promise<void> | void
}

function toUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data)
}

export class WebVMBridge {
  private static instance: WebVMBridge

  static getInstance(): WebVMBridge {
    if (!WebVMBridge.instance) {
      WebVMBridge.instance = new WebVMBridge()
    }
    return WebVMBridge.instance
  }

  private constructor() {}

  isAvailable(): boolean {
    return Boolean(this.getVM())
  }

  async writeFile(path: string, data: ArrayBuffer | Uint8Array): Promise<void> {
    const vm = this.getVM(true)
    const payload = toUint8Array(data)

    if (typeof vm.writeFile === 'function') {
      await vm.writeFile(path, payload)
      return
    }

    if (vm.fs?.writeFile) {
      await vm.fs.writeFile(path, payload)
      return
    }

    throw new WebVMUnsupportedError('writeFile')
  }

  async exec(command: string, args: string[] = []): Promise<void> {
    const vm = this.getVM(true)
    if (typeof vm.exec === 'function') {
      await vm.exec(command, args)
      return
    }
    if (vm.runtime?.exec) {
      await vm.runtime.exec(command, args)
      return
    }
    throw new WebVMUnsupportedError('exec')
  }

  async ensureDirectory(path: string): Promise<boolean> {
    const vm = this.getVM()
    if (!vm) return false
    try {
      if (typeof vm.ensureDir === 'function') {
        await vm.ensureDir(path)
        return true
      }
      await this.exec('mkdir', ['-p', path])
      return true
    } catch (error) {
      console.warn('[WebVMBridge] failed to ensure directory', path, error)
      return false
    }
  }

  async removeDirectory(path: string): Promise<boolean> {
    const vm = this.getVM()
    if (!vm) return false
    try {
      if (typeof vm.removeDir === 'function') {
        await vm.removeDir(path)
        return true
      }
      await this.exec('rm', ['-rf', path])
      return true
    } catch (error) {
      console.warn('[WebVMBridge] failed to remove directory', path, error)
      return false
    }
  }

  private getVM(throwOnMissing = false): WebVMLike | null {
    const vm = (globalThis as unknown as { webvm?: WebVMLike }).webvm ?? null
    if (throwOnMissing && !vm) {
      throw new WebVMUnavailableError()
    }
    return vm
  }
}
