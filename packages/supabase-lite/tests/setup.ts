import { vi, beforeEach, afterEach } from 'vitest'

// Mock Node.js built-in modules
vi.mock('readline', () => ({
  createInterface: vi.fn(() => ({
    question: vi.fn((prompt: string, callback: (answer: string) => void) => {
      // Mock user input responses based on prompts
      if (prompt.includes('Host')) callback('localhost')
      else if (prompt.includes('Port')) callback('5173')
      else if (prompt.includes('Database')) callback('test_db')
      else if (prompt.includes('User')) callback('postgres')
      else if (prompt.includes('Password')) callback('password')
      else callback('default')
    }),
    close: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    setPrompt: vi.fn(),
    prompt: vi.fn(),
    write: vi.fn(),
    resume: vi.fn(),
    pause: vi.fn(),
    line: '',
    cursor: 0,
    history: [],
    historyIndex: 0,
    _setRawMode: vi.fn(),
    input: {
      on: vi.fn(),
      removeListener: vi.fn(),
      removeAllListeners: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      setRawMode: vi.fn(),
      isRaw: false,
      isTTY: true
    },
    output: {
      write: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      removeAllListeners: vi.fn(),
      columns: 80,
      rows: 24,
      isTTY: true
    },
    terminal: true
  }))
}))

// Mock WebSocket module
vi.mock('ws', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn((event: string, callback: Function) => {
      // Simulate WebSocket events for different scenarios
      if (event === 'open') {
        setTimeout(() => callback(), 10)
      } else if (event === 'message') {
        setTimeout(() => callback('{"type": "connection_ack"}'), 20)
      } else if (event === 'error') {
        // Don't trigger error by default
      } else if (event === 'close') {
        setTimeout(() => callback(1000, 'Normal closure'), 100)
      }
    }),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // OPEN
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    url: 'ws://localhost:8080',
    protocol: '',
    extensions: '',
    bufferedAmount: 0,
    binaryType: 'blob'
  })),
  WebSocket: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1
  }))
}))

// Mock open package (for opening browser)
vi.mock('open', () => ({
  default: vi.fn().mockResolvedValue(undefined)
}))

// Mock Express
vi.mock('express', () => ({
  default: vi.fn(() => {
    const mockApp = {
      use: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      listen: vi.fn((port: number, callback?: Function) => {
        if (callback) setTimeout(callback, 10)
        return {
          close: vi.fn((callback?: Function) => {
            if (callback) setTimeout(callback, 10)
          }),
          address: () => ({ port, family: 'IPv4', address: '127.0.0.1' })
        }
      }),
      set: vi.fn(),
      locals: {},
      mountpath: '/',
      enabled: vi.fn().mockReturnValue(true),
      disabled: vi.fn().mockReturnValue(false),
      enable: vi.fn(),
      disable: vi.fn(),
      // Add proxy server methods that auto-proxy-manager expects
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      isRunning: vi.fn().mockReturnValue(true)
    }
    return mockApp
  }),
  Router: vi.fn(() => ({
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }))
}))

// Mock HTTP and HTTPS modules
vi.mock('http', () => ({
  createServer: vi.fn(() => ({
    listen: vi.fn(),
    close: vi.fn(),
    on: vi.fn()
  })),
  Server: vi.fn()
}))

vi.mock('https', () => ({
  createServer: vi.fn(() => ({
    listen: vi.fn(),
    close: vi.fn(),
    on: vi.fn()
  })),
  Server: vi.fn()
}))

// Mock filesystem operations
vi.mock('fs', () => ({
  readFileSync: vi.fn((path: string) => {
    if (path.includes('.json')) return '{"test": true}'
    if (path.includes('.sql')) return 'SELECT 1;'
    if (path.includes('.js') || path.includes('.ts')) return 'module.exports = {};'
    return 'mock file content'
  }),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn().mockReturnValue(['file1.js', 'file2.js']),
  statSync: vi.fn(() => ({
    isFile: () => true,
    isDirectory: () => false,
    size: 1024,
    mtime: new Date(),
    ctime: new Date(),
    atime: new Date()
  })),
  promises: {
    readFile: vi.fn().mockResolvedValue('mock file content'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue(['file1.js', 'file2.js']),
    stat: vi.fn().mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 1024
    })
  }
}))

// Mock path operations
vi.mock('path', async () => {
  const actual = await vi.importActual('path')
  return {
    ...actual,
    join: vi.fn((...paths: string[]) => paths.join('/')),
    resolve: vi.fn((...paths: string[]) => '/' + paths.join('/').replace(/\/+/g, '/')),
    dirname: vi.fn((path: string) => path.split('/').slice(0, -1).join('/') || '/'),
    basename: vi.fn((path: string) => path.split('/').pop() || ''),
    extname: vi.fn((path: string) => {
      const base = path.split('/').pop() || ''
      const dot = base.lastIndexOf('.')
      return dot > 0 ? base.substring(dot) : ''
    })
  }
})

// Mock OS operations
vi.mock('os', () => ({
  platform: vi.fn().mockReturnValue('linux'),
  arch: vi.fn().mockReturnValue('x64'),
  cpus: vi.fn().mockReturnValue([{ model: 'Mock CPU', speed: 2400 }]),
  totalmem: vi.fn().mockReturnValue(8589934592),
  freemem: vi.fn().mockReturnValue(4294967296),
  homedir: vi.fn().mockReturnValue('/home/user'),
  tmpdir: vi.fn().mockReturnValue('/tmp'),
  hostname: vi.fn().mockReturnValue('test-host'),
  type: vi.fn().mockReturnValue('Linux'),
  release: vi.fn().mockReturnValue('5.4.0'),
  uptime: vi.fn().mockReturnValue(86400),
  loadavg: vi.fn().mockReturnValue([0.1, 0.2, 0.3]),
  networkInterfaces: vi.fn().mockReturnValue({
    eth0: [{
      address: '192.168.1.100',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: false,
      cidr: '192.168.1.100/24'
    }]
  }),
  userInfo: vi.fn().mockReturnValue({
    username: 'testuser',
    uid: 1000,
    gid: 1000,
    shell: '/bin/bash',
    homedir: '/home/testuser'
  }),
  constants: {
    signals: {},
    errno: {}
  },
  EOL: '\n'
}))

// Mock process operations that aren't already mocked by Vitest
Object.defineProperty(process, 'exit', {
  value: vi.fn(),
  writable: true
})

Object.defineProperty(process, 'cwd', {
  value: vi.fn().mockReturnValue('/test/directory'),
  writable: true
})

Object.defineProperty(process, 'chdir', {
  value: vi.fn(),
  writable: true
})

// Mock console to capture output but still allow logging
const originalConsole = { ...console }
global.console = {
  ...console,
  log: vi.fn((...args) => originalConsole.log(...args)),
  error: vi.fn((...args) => originalConsole.error(...args)),
  warn: vi.fn((...args) => originalConsole.warn(...args)),
  info: vi.fn((...args) => originalConsole.info(...args)),
  debug: vi.fn((...args) => originalConsole.debug(...args))
}

// Mock crypto operations for Node.js environment
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).substring(2, 15)),
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('mock-hash')
  })),
  pbkdf2Sync: vi.fn().mockReturnValue(Buffer.from('mock-derived-key')),
  randomBytes: vi.fn((size: number) => Buffer.alloc(size, 0)),
  timingSafeEqual: vi.fn().mockReturnValue(true)
}))

// Global cleanup for each test
beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Export mock helpers for tests that need them
export const mockHelpers = {
  mockConsoleOutput: () => {
    const logs: string[] = []
    vi.mocked(console.log).mockImplementation((...args) => {
      logs.push(args.join(' '))
    })
    return logs
  },
  
  mockUserInput: (responses: string[]) => {
    let responseIndex = 0
    const mockInterface = vi.mocked(require('readline').createInterface())
    mockInterface.question.mockImplementation((prompt: string, callback: Function) => {
      const response = responses[responseIndex++] || 'default'
      setTimeout(() => callback(response), 10)
    })
    return mockInterface
  },
  
  mockWebSocketConnection: (messages: any[] = []) => {
    const mockWs = new (vi.mocked(require('ws').default))()
    const mockOn = vi.mocked(mockWs.on)
    
    mockOn.mockImplementation((event: string, callback: Function) => {
      if (event === 'message') {
        messages.forEach((msg, index) => {
          setTimeout(() => callback(JSON.stringify(msg)), (index + 1) * 50)
        })
      }
    })
    
    return mockWs
  }
}