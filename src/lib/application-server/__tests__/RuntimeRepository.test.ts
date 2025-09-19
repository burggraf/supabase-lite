import 'fake-indexeddb/auto'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { RuntimeRepository } from '../RuntimeRepository'
import { WebVMManager } from '../WebVMManager'

const manifestResponse = {
  version: '2025.03.05',
  generatedAt: '2025-03-05T00:00:00.000Z',
  packages: [
    {
      id: 'nginx',
      name: 'nginx 1.24',
      description: 'Nginx runtime',
      category: 'web-server' as const,
      version: '1.24.0',
      size: 25,
      sourceUrl: '/runtime-packages/nginx/nginx-runtime.tar',
    },
    {
      id: 'nodejs',
      name: 'Node.js 20 LTS',
      description: 'Node runtime',
      category: 'runtime' as const,
      version: '20.12.2',
      size: 90,
      dependencies: ['nginx'],
      sourceUrl: '/runtime-packages/nodejs/nodejs-runtime.tar',
    },
  ],
}

const originalFetch = global.fetch

async function resetDatabase() {
  if ('localStorage' in globalThis && typeof localStorage.clear === 'function') {
    localStorage.clear()
  }
  await new Promise<void>((resolve) => {
    if (!('indexedDB' in globalThis)) {
      resolve()
      return
    }
    const request = indexedDB.deleteDatabase('supabase-lite.application-server')
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}

describe('RuntimeRepository', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await resetDatabase()
    const managerHolder = WebVMManager as unknown as { instance?: WebVMManager }
    if (managerHolder.instance) {
      await managerHolder.instance.stop()
    }
    managerHolder.instance = undefined
    const repoHolder = RuntimeRepository as unknown as { instance?: RuntimeRepository }
    delete repoHolder.instance
  })

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as any).fetch
    }
  })

  it('loads runtime manifest packages', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => manifestResponse,
    } as unknown as Response)

    const repo = RuntimeRepository.getInstance(WebVMManager.getInstance())
    await repo.initialize()
    const packages = await repo.getAvailablePackages()

    expect(packages.map((pkg) => pkg.id)).toEqual(['nginx', 'nodejs'])
    expect(repo.getLastError()).toBeNull()
  })

  it('captures manifest fetch failures without clearing cached packages', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => manifestResponse,
      } as unknown as Response)
      .mockRejectedValueOnce(new Error('offline'))
    global.fetch = fetchMock
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const repo = RuntimeRepository.getInstance(WebVMManager.getInstance())
    await repo.initialize()
    expect(repo.getLastError()).toBeNull()

    await repo.refreshManifest()

    expect(repo.getLastError()).toContain('offline')
    const packages = await repo.getAvailablePackages()
    expect(packages.map((pkg) => pkg.id)).toEqual(['nginx', 'nodejs'])

    warnSpy.mockRestore()
  })
})
