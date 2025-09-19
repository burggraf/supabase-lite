import { WebVMFileStore } from '../persistence/WebVMFileStore'
import { extractTar } from '../utils/tar'

type WebVMLike = {
  ensureDir?: (path: string) => Promise<void>
  removeDir?: (path: string) => Promise<void>
  writeFile?: (path: string, data: ArrayBuffer | Uint8Array) => Promise<void>
  exec?: (command: string, args?: string[]) => Promise<unknown>
  fetch?: (url: string, init?: RequestInit) => Promise<Response>
  fs?: {
    writeFile?: (path: string, data: Uint8Array) => Promise<void>
  }
  runtime?: {
    exec?: (command: string, args?: string[]) => Promise<unknown>
  }
}

type MethodName = 'ensureDir' | 'removeDir' | 'writeFile' | 'exec' | 'fetch'

type PendingCall = {
  method: MethodName
  args: unknown[]
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

const pendingCalls: PendingCall[] = []
let activeWebVM: WebVMLike | null = null

const queuedWebVM = createQueuedWebVM()
;(globalThis as Record<string, unknown>).webvm = queuedWebVM

if (typeof window !== 'undefined') {
  void initializeRealRuntime()
}

function createQueuedWebVM(): WebVMLike {
  const enqueue = (method: MethodName) => {
    return (...args: unknown[]) => {
      if (activeWebVM && typeof (activeWebVM as Record<string, unknown>)[method] === 'function') {
        return (activeWebVM as Record<string, (...inner: unknown[]) => unknown>)[method](...args)
      }
      return new Promise<unknown>((resolve, reject) => {
        pendingCalls.push({ method, args, resolve, reject })
      })
    }
  }

  return {
    ensureDir: enqueue('ensureDir') as WebVMLike['ensureDir'],
    removeDir: enqueue('removeDir') as WebVMLike['removeDir'],
    writeFile: enqueue('writeFile') as WebVMLike['writeFile'],
    exec: enqueue('exec') as WebVMLike['exec'],
    fetch: enqueue('fetch') as WebVMLike['fetch'],
  }
}

async function initializeRealRuntime(): Promise<void> {
  try {
    const realWebVM = await createRealWebVM()
    setActiveWebVM(realWebVM)
    await flushPendingCalls()
  } catch (error) {
    console.error('[WebVM] failed to initialize real runtime, reverting to shim', error)
    const fallback = createFallbackShim()
    setActiveWebVM(fallback)
    await flushPendingCalls()
  }
}

function setActiveWebVM(vm: WebVMLike): void {
  activeWebVM = vm
  ;(globalThis as Record<string, unknown>).webvm = vm
}

async function flushPendingCalls(): Promise<void> {
  if (!activeWebVM) return
  while (pendingCalls.length > 0) {
    const call = pendingCalls.shift()
    if (!call) continue
    const method = activeWebVM[call.method]
    if (typeof method === 'function') {
      try {
        const result = method(...call.args)
        if (result instanceof Promise) {
          call.resolve(await result)
        } else {
          call.resolve(result)
        }
      } catch (error) {
        call.reject(error)
      }
    } else {
      call.reject(new Error(`WebVM method ${call.method} is not available`))
    }
  }
}

async function createRealWebVM(): Promise<WebVMLike> {
  const runtimeModuleUrl = 'https://cxrtnc.leaningtech.com/1.1.7/cx.esm.js'
  const module = await import(/* @vite-ignore */ runtimeModuleUrl)

  const {
    Linux,
    IDBDevice,
    OverlayDevice,
    DataDevice,
    WebDevice,
    HttpBytesDevice,
  } = module as {
    Linux: {
      create: (options: unknown) => Promise<any>
    }
    IDBDevice: { create: (namespace: string) => Promise<any> }
    OverlayDevice: { create: (base: any, overlay: any) => Promise<any> }
    DataDevice: { create: () => Promise<any> }
    WebDevice: { create: (namespace: string) => Promise<any> }
    HttpBytesDevice: { create: (url: string) => Promise<any> }
  }

  const diskImageUrl = new URL(
    '../../../../webvm/debian_mini_20230519_5022088024.ext2',
    import.meta.url,
  ).toString()

  const baseDevice = await HttpBytesDevice.create(diskImageUrl)
  const cacheDevice = await IDBDevice.create('supabase-lite-webvm-cache')
  const writableOverlay = await OverlayDevice.create(baseDevice, cacheDevice)
  const webDevice = await WebDevice.create('')
  const documentsDevice = await WebDevice.create('documents')
  const dataDevice = await DataDevice.create()

  const mounts = [
    { type: 'ext2', dev: writableOverlay, path: '/' },
    { type: 'dir', dev: webDevice, path: '/web' },
    { type: 'dir', dev: dataDevice, path: '/data' },
    { type: 'devs', path: '/dev' },
    { type: 'devpts', path: '/dev/pts' },
    { type: 'proc', path: '/proc' },
    { type: 'sys', path: '/sys' },
    { type: 'dir', dev: documentsDevice, path: '/home/user/documents' },
  ]

  const linux = await Linux.create({ mounts })

  const fsContainer = linux as {
    fs?: { writeFile?: (path: string, data: Uint8Array) => Promise<void> }
  }
  const runtimeContainer = linux as {
    runtime?: { exec?: (command: string, args?: string[]) => Promise<unknown> }
  }
  const ensureDir = linux.ensureDir?.bind(linux)
  const removeDir = linux.removeDir?.bind(linux)
  const execImpl =
    linux.exec?.bind(linux) ?? runtimeContainer.runtime?.exec?.bind(runtimeContainer.runtime) ?? (async () => undefined)
  const writeFileImpl =
    linux.writeFile?.bind(linux) ?? fsContainer.fs?.writeFile?.bind(fsContainer.fs) ?? (async () => undefined)
  const fetchImpl = linux.fetch?.bind(linux)

  return {
    ensureDir: ensureDir
      ? (path: string) => ensureDir(path)
      : (path: string) => execImpl('mkdir', ['-p', path]).then(() => undefined),
    removeDir: removeDir
      ? (path: string) => removeDir(path)
      : (path: string) => execImpl('rm', ['-rf', path]).then(() => undefined),
    writeFile: (path: string, data: ArrayBuffer | Uint8Array) =>
      writeFileImpl(path, toUint8Array(data)).then(() => undefined),
    exec: (command: string, args: string[] = []) => execImpl(command, args),
    fetch: fetchImpl
      ? (url: string, init?: RequestInit) => fetchImpl(url, init)
      : (url: string, init?: RequestInit) => fetch(url, init),
  }
}

function createFallbackShim(): WebVMLike {
  const fileStore = WebVMFileStore.getInstance()
  const appProcesses = new Map<number, { appId: string; root: string; pidFile: string }>()

  const writeToStore = async (path: string, data: Uint8Array) => {
    const { scope, id } = parseScope(path)
    if (!scope || !id) return
    await fileStore.writeFile(id, path, data.buffer)
  }

  const deleteScope = async (path: string) => {
    const { scope, id } = parseScope(path)
    if (!scope || !id) return
    await fileStore.deleteFiles(id)
  }

  const extractTarInto = async (tarPath: string, targetRoot: string) => {
    const { id } = parseScope(tarPath)
    if (!id) return
    const bundle = await fileStore.readFile(id, tarPath)
    if (!bundle) return
    const entries = extractTar(bundle)
    for (const entry of entries) {
      const fullPath = `${targetRoot}/${entry.name}`.replace(/\\+/g, '/').replace(/\/+$/, '')
      await fileStore.writeFile(id, entry.type === 'file' ? fullPath : `${fullPath}/`, entry.data)
    }
  }

  const handleShell = async (script: string) => {
    if (script.includes('python3 -m http.server')) {
      const rootMatch = script.match(/cd\s+([^&]+)\s+&&/)
      const portMatch = script.match(/python3 -m http\.server\s+(\d+)/)
      const pidMatch = script.match(/echo \$! > ([^\s]+)/)
      const root = rootMatch ? rootMatch[1].trim() : ''
      const port = portMatch ? Number(portMatch[1]) : NaN
      const pidFile = pidMatch ? pidMatch[1].trim() : ''
      const appMatch = root.match(/\/opt\/supabase\/apps\/([^/]+)/)
      if (!Number.isNaN(port) && appMatch) {
        appProcesses.set(port, { appId: appMatch[1], root, pidFile })
        const pidBuffer = new TextEncoder().encode(String(port)).buffer
        await fileStore.writeFile(appMatch[1], pidFile, pidBuffer)
      }
      return
    }

    if (script.includes('kill $(cat')) {
      const pidMatch = script.match(/kill \$\(cat ([^\s]+)\)/)
      const pidFile = pidMatch ? pidMatch[1].trim() : ''
      if (pidFile) {
        for (const [port, process] of appProcesses.entries()) {
          if (process.pidFile === pidFile) {
            appProcesses.delete(port)
            await fileStore.writeFile(process.appId, pidFile, new ArrayBuffer(0))
          }
        }
      }
    }
  }

  return {
    ensureDir: async (path: string) => {
      await writeToStore(`${path.replace(/\/+$/, '')}/`, new Uint8Array())
    },
    removeDir: async (path: string) => {
      await deleteScope(path)
    },
    writeFile: async (path: string, data: ArrayBuffer | Uint8Array) => {
      await writeToStore(path, toUint8Array(data))
    },
    exec: async (command: string, args: string[] = []) => {
      switch (command) {
        case 'mkdir':
          return
        case 'rm':
          if (args.includes('-rf')) {
            const target = args[args.length - 1]
            await deleteScope(target)
          }
          return
        case 'chmod':
        case 'systemctl':
          return
        case 'tar': {
          const tarPath = args[1]
          const targetRoot = args[3]
          if (tarPath && targetRoot) {
            await extractTarInto(tarPath, targetRoot)
          }
          return
        }
        case '/bin/sh':
          await handleShell(args[1] ?? '')
          return
        default:
          console.warn('[WebVM shim] unsupported exec command', command, args)
      }
    },
    fetch: async (url: string) => {
      const match = url.match(/^http:\/\/127\.0\.0\.1:(\d+)(\/.+)?$/)
      if (!match) {
        return new Response('Unsupported URL', { status: 501 })
      }
      const port = Number(match[1])
      const relative = decodeURIComponent(match[2] ?? '/').replace(/^\//, '')
      const process = appProcesses.get(port)
      if (!process) {
        return new Response('Application not running', { status: 502 })
      }
      const candidates = relative
        ? [`${process.root}/${relative}`, `${process.root}/${relative}/index.html`]
        : [`${process.root}/index.html`]
      for (const candidate of candidates) {
        const data = await fileStore.readFile(process.appId, candidate)
        if (data) {
          const body = new Uint8Array(data)
          return new Response(body, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        }
      }
      return new Response('File not found', { status: 404 })
    },
  }
}

function parseScope(path: string): { scope: 'runtime' | 'app' | null; id: string | null } {
  const runtime = path.match(/^\/opt\/supabase\/runtimes\/([^/]+)/)
  if (runtime) return { scope: 'runtime', id: runtime[1] }
  const app = path.match(/^\/opt\/supabase\/apps\/([^/]+)/)
  if (app) return { scope: 'app', id: app[1] }
  return { scope: null, id: null }
}

function toUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data)
}
