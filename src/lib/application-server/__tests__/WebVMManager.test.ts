import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { WebVMManager } from '../WebVMManager'
import { PersistenceManager } from '../persistence/PersistenceManager'
import { RuntimeBundleStore } from '../persistence/RuntimeBundleStore'
import { WebVMFileStore } from '../persistence/WebVMFileStore'

interface TarEntryInput {
  name: string
  content: string
}

const encoder = new TextEncoder()

function createTar(entries: TarEntryInput[]): ArrayBuffer {
  const blocks: number[] = []

  const writeBytes = (byteArray: Uint8Array) => {
    for (const byte of byteArray) {
      blocks.push(byte)
    }
  }

  const padToBlock = () => {
    const remainder = blocks.length % 512
    if (remainder !== 0) {
      for (let i = 0; i < 512 - remainder; i += 1) {
        blocks.push(0)
      }
    }
  }

  for (const entry of entries) {
    const header = new Uint8Array(512)
    const nameBytes = encoder.encode(entry.name)
    header.set(nameBytes.subarray(0, 100), 0)

    const contentBytes = encoder.encode(entry.content)
    const sizeOctal = contentBytes.length.toString(8).padStart(11, '0') + '\0'
    header.set(encoder.encode(sizeOctal), 124)
    header[156] = '0'.charCodeAt(0)
    const magic = encoder.encode('ustar\0')
    header.set(magic, 257)

    for (let i = 148; i < 156; i += 1) {
      header[i] = 32
    }
    let checksum = 0
    for (const byte of header) {
      checksum += byte
    }
    const checksumOctal = checksum.toString(8).padStart(6, '0') + '\0 '
    header.set(encoder.encode(checksumOctal), 148)

    writeBytes(header)
    writeBytes(contentBytes)
    padToBlock()
  }

  // Two zero blocks to terminate archive
  for (let i = 0; i < 1024; i += 1) {
    blocks.push(0)
  }

  return new Uint8Array(blocks).buffer
}

describe('WebVMManager', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await WebVMManager.__resetForTests()
    await PersistenceManager.getInstance().clear()
    await RuntimeBundleStore.getInstance().clearAll()
    await WebVMFileStore.getInstance().clearAll()
    delete (globalThis as Record<string, unknown>).webvm
  })

  afterEach(async () => {
    await WebVMManager.__resetForTests()
    if (typeof vi.unstubAllGlobals === 'function') {
      vi.unstubAllGlobals()
    }
    delete (globalThis as Record<string, unknown>).webvm
  })

  it('initializes into ready state', async () => {
    const manager = WebVMManager.getInstance()
    await manager.initialize()
    const status = manager.getStatus()
    expect(status.state).toBe('ready')
    expect(status.loadProgress).toBe(100)
  })

  it('downloads runtime bundle and stores it', async () => {
    const buffer = createTar([
      { name: 'bin/start.sh', content: '#!/bin/sh\necho hello' },
      { name: 'README.md', content: 'Runtime info' },
    ])
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => buffer,
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const writeFileMock = vi.fn().mockResolvedValue(undefined)
    const execMock = vi.fn().mockResolvedValue(undefined)
    ;(globalThis as Record<string, unknown>).webvm = {
      writeFile: writeFileMock,
      exec: execMock,
    }

    const manager = WebVMManager.getInstance()
    const result = await manager.installRuntimePackage({
      id: 'nginx',
      name: 'nginx',
      description: 'Test runtime',
      category: 'web-server',
      version: '1.0.0',
      size: 1,
      dependencies: [],
      conflicts: [],
      status: 'available',
      sourceUrl: '/runtime-packages/nginx/nginx-runtime.tar',
      postInstallCommands: ['echo nginx ready'],
      serviceUnits: [
        {
          name: 'nginx.service',
          enable: true,
          start: true,
        },
      ],
    })

    expect(fetchMock).toHaveBeenCalledWith('/runtime-packages/nginx/nginx-runtime.tar')
    expect(await manager.hasRuntimeBundle('nginx')).toBe(true)
    const files = await manager.listRuntimeFiles('nginx')
    const paths = files.map((file) => file.path)
    expect(paths).toContain('/opt/supabase/runtimes/nginx/bundle.tar')
    expect(paths).toContain('/opt/supabase/runtimes/nginx/bin/start.sh')
    expect(paths).toContain('/opt/supabase/runtimes/nginx/README.md')
    expect(writeFileMock).toHaveBeenCalledWith('/opt/supabase/runtimes/nginx/bundle.tar', expect.any(Uint8Array))
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(execMock).toHaveBeenCalledWith('mkdir', ['-p', '/opt/supabase/runtimes/nginx'])
    expect(execMock).toHaveBeenCalledWith('tar', ['-xf', '/opt/supabase/runtimes/nginx/bundle.tar', '-C', '/opt/supabase/runtimes/nginx'])
    expect(execMock).toHaveBeenCalledWith('chmod', ['+x', '/opt/supabase/runtimes/nginx/bin/start.sh'])
    expect(execMock).toHaveBeenCalledWith('/bin/sh', ['-lc', 'echo nginx ready'])
    expect(execMock).toHaveBeenCalledWith('systemctl', ['enable', 'nginx.service'])
    expect(execMock).toHaveBeenCalledWith('systemctl', ['start', 'nginx.service'])
    expect(result.logs.some((line) => line.includes('Runtime staged inside WebVM via tar'))).toBe(true)
  })

  it('runs post-install hooks only when bridge is available', async () => {
    const buffer = createTar([
      { name: 'bin/start.sh', content: '#!/bin/sh\necho hello' },
    ])
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => buffer,
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const manager = WebVMManager.getInstance()
    const result = await manager.installRuntimePackage({
      id: 'nodejs',
      name: 'node',
      description: 'Test runtime',
      category: 'runtime',
      version: '1.0.0',
      size: 1,
      dependencies: [],
      conflicts: [],
      status: 'available',
      sourceUrl: '/runtime-packages/nodejs/nodejs-runtime.tar',
      postInstallCommands: ['echo node ready'],
      serviceUnits: [
        {
          name: 'node.service',
          enable: true,
          start: true,
        },
      ],
    })

    expect(fetchMock).toHaveBeenCalled()
    expect(result.logs.some((line) => line.includes('WebVM bridge unavailable'))).toBe(true)
    expect(result.logs.some((line) => line.includes('post-install commands not executed'))).toBe(true)
    expect(result.logs.some((line) => line.includes('Cached runtime contents locally'))).toBe(true)
  })

  it('throws when bundle download fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const manager = WebVMManager.getInstance()

    await expect(
      manager.installRuntimePackage({
        id: 'nginx',
        name: 'nginx',
        description: 'Test runtime',
        category: 'web-server',
        version: '1.0.0',
        size: 1,
        dependencies: [],
        conflicts: [],
        status: 'available',
        sourceUrl: '/runtime-packages/nginx/nginx-runtime.tar',
      }),
    ).rejects.toThrow('Failed to download runtime bundle')

    expect(await manager.hasRuntimeBundle('nginx')).toBe(false)
    expect(await manager.listRuntimeFiles('nginx')).toHaveLength(0)
  })
})
