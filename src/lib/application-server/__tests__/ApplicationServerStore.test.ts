import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApplicationServerStore } from '../state/ApplicationServerStore'
import { WebVMManager } from '../WebVMManager'
import { PersistenceManager } from '../persistence/PersistenceManager'

describe('ApplicationServerStore static app smoke test', () => {
  beforeEach(async () => {
    await WebVMManager.__resetForTests()
    await PersistenceManager.getInstance().clear()
    ;(ApplicationServerStore as unknown as { instance?: ApplicationServerStore }).instance = undefined
    delete (globalThis as Record<string, unknown>).webvm
  })

  it('deploys, starts, and stops a static app via WebVM bridge', async () => {
    const store = ApplicationServerStore.getInstance()
    await store.initialize()

    const encoder = new TextEncoder()
    const fileData = encoder.encode('<html><body>Hello</body></html>').buffer
    const file: File = {
      name: 'index.html',
      size: fileData.byteLength,
      type: 'text/html',
      lastModified: Date.now(),
      arrayBuffer: async () => fileData,
    } as File

    const ensureDirMock = vi.fn().mockResolvedValue(undefined)
    const writeFileMock = vi.fn().mockResolvedValue(undefined)
    const execMock = vi.fn().mockResolvedValue(undefined)

    ;(globalThis as Record<string, unknown>).webvm = {
      ensureDir: ensureDirMock,
      writeFile: writeFileMock,
      exec: execMock,
    }

    await store.deployStaticApplication('static-app', [file])

    const deployed = store.getSnapshot().applications[0]
    expect(deployed).toBeDefined()
    expect(deployed.status).toBe('stopped')
    expect(deployed.deployPath).toContain(deployed.id)
    await store.startApplication(deployed.id)

    const running = store.getSnapshot().applications[0]
    expect(running.status).toBe('running')
    expect(running.port).toBeGreaterThan(0)

    const startCommand = execMock.mock.calls.find(
      (call) => Array.isArray(call[1]) && call[1][1]?.includes('python3 -m http.server'),
    )
    expect(startCommand).toBeTruthy()

    await store.stopApplication(deployed.id)

    const stopped = store.getSnapshot().applications[0]
    expect(stopped.status).toBe('stopped')

    const stopCommand = execMock.mock.calls.find(
      (call) => Array.isArray(call[1]) && call[1][1]?.includes('kill $(cat'),
    )
    expect(stopCommand).toBeTruthy()
  })

  it('handles start/stop when WebVM bridge is unavailable', async () => {
    const store = ApplicationServerStore.getInstance()
    await store.initialize()

    const buffer = new TextEncoder().encode('<html></html>').buffer
    const file: File = {
      name: 'index.html',
      size: buffer.byteLength,
      type: 'text/html',
      lastModified: Date.now(),
      arrayBuffer: async () => buffer,
    } as File

    await store.deployStaticApplication('offline-app', [file])
    const deployed = store.getSnapshot().applications[0]
    expect(deployed.status).toBe('stopped')

    await store.startApplication(deployed.id)
    expect(store.getSnapshot().applications[0].status).toBe('running')

    await store.stopApplication(deployed.id)
    expect(store.getSnapshot().applications[0].status).toBe('stopped')
  })
})
