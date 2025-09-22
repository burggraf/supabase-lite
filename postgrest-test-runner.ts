import 'fake-indexeddb/auto'

import { webcrypto } from 'node:crypto'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { BroadcastChannel as NodeBroadcastChannel } from 'worker_threads'
import { createServer as createMswServer } from '@mswjs/http-middleware'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import type { Project } from './src/lib/projects/ProjectManager.ts'

const moduleDir = dirname(fileURLToPath(import.meta.url))

const originalFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const requestUrl = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.pathname + input.search
      : input.url

  if (typeof requestUrl === 'string' && requestUrl.startsWith('/sql_scripts/')) {
    const relativePath = requestUrl.replace(/^\//, '')
    const filePath = join(moduleDir, 'public', relativePath)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return new Response(content, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    } catch (error) {
      return new Response(`Failed to read ${relativePath}: ${error instanceof Error ? error.message : String(error)}`, { status: 500 })
    }
  }

  return originalFetch(input as any, init as any)
}

// ---------------------------------------------------------------------------
// Minimal browser-like polyfills for Node environments
// ---------------------------------------------------------------------------

const globalAny = globalThis as any

class MemoryStorage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

if (!globalAny.crypto) {
  globalAny.crypto = webcrypto
}

if (!globalAny.BroadcastChannel) {
  globalAny.BroadcastChannel = NodeBroadcastChannel
}

if (!globalAny.localStorage) {
  globalAny.localStorage = new MemoryStorage()
}

if (!globalAny.self) {
  globalAny.self = globalThis
}

if (!globalAny.window) {
  globalAny.window = globalThis
}

if (!globalAny.location) {
  const defaultLocation = new URL('http://localhost/')
  globalAny.location = defaultLocation
}

if (!globalAny.window.location) {
  globalAny.window.location = globalAny.location
}

if (!globalAny.navigator) {
  globalAny.navigator = { userAgent: 'node', language: 'en-US' }
}

const { handlers } = await import('./src/api/index.ts')
const { DatabaseManager } = await import('./src/lib/database/connection.ts')
const { projectManager } = await import('./src/lib/projects/ProjectManager.ts')
const { logger } = await import('./src/lib/infrastructure/Logger.ts')

// Reduce log noise for the test runner
logger.setLogLevel('error')

// ---------------------------------------------------------------------------
// Types shared with the JSON manifest
// ---------------------------------------------------------------------------

interface TestLog {
  type: 'info' | 'error' | 'debug'
  message: string
  timestamp: string
}

interface TestResults {
  passed: boolean
  log: TestLog[]
  skip: boolean
}

interface Example {
  id: string
  name: string
  code: string
  data?: {
    sql?: string
  }
  response: string
  results?: TestResults
  description?: string
  hideCodeBlock?: boolean
  unsupported?: boolean
}

interface TestItem {
  id: string
  title: string
  $ref?: string
  notes?: string
  description?: string
  examples?: Example[]
}

interface RunnerConfig {
  supabaseLiteUrl: string
  serverPort: number
  healthCheckRetries: number
  healthCheckDelay: number
  workingDir: string
  testJsonFile: string
  templateFile: string
  tempScriptFile: string
}

interface ComparisonResult {
  match: boolean
  differences?: string
}

interface TestStatistics {
  passed: number
  failed: number
  skipped: number
  unsupported: number
}

// ---------------------------------------------------------------------------
// PostgREST compatibility test runner (Node edition)
// ---------------------------------------------------------------------------

class PostgRESTNodeTestRunner {
  private readonly config: RunnerConfig
  private readonly dbManager = DatabaseManager.getInstance()
  private readonly supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  private readonly isRetestMode: boolean

  private httpServer: Server | null = null
  private currentProject: Project | null = null
  private testStats: TestStatistics = { passed: 0, failed: 0, skipped: 0, unsupported: 0 }

  constructor(isRetestMode = false) {
    this.isRetestMode = isRetestMode

    const currentDir = moduleDir
    const envPort = process.env.POSTGREST_TEST_PORT
    let port = 54321

    if (envPort) {
      const parsedPort = Number.parseInt(envPort, 10)
      if (!Number.isNaN(parsedPort) && parsedPort >= 0 && parsedPort <= 65535) {
        port = parsedPort
      } else {
        console.warn(`Ignoring invalid POSTGREST_TEST_PORT value: ${envPort}`)
      }
    }

    this.config = {
      supabaseLiteUrl: `http://127.0.0.1:${port}`,
      serverPort: port,
      healthCheckRetries: 20,
      healthCheckDelay: 1000,
      workingDir: currentDir,
      testJsonFile: join(currentDir, 'postgrest.test.json'),
      templateFile: join(currentDir, 'postgrest.test.template.ts.txt'),
      tempScriptFile: join(currentDir, 'tmp-postgrest-test.mjs')
    }
  }

  // -----------------------------------------------------------------------
  // Environment setup helpers
  // -----------------------------------------------------------------------

  private log(level: 'info' | 'error' | 'debug', message: string) {
    const timestamp = new Date().toISOString()
    const prefix = level.toUpperCase().padEnd(5)
    console.log(`[${timestamp}] ${prefix}: ${message}`)
  }

  private createTestLog(type: TestLog['type'], message: string): TestLog {
    return {
      type,
      message,
      timestamp: new Date().toISOString()
    }
  }

  private async startServer(): Promise<void> {
    if (this.httpServer) {
      return
    }

    this.log('info', 'Starting Supabase Lite API middleware server (MSW)...')

    const preferredPort = this.config.serverPort
    const portsToTry: number[] = [preferredPort]
    if (preferredPort !== 0) {
      portsToTry.push(0)
    }

    let lastError: unknown

    for (const portOption of portsToTry) {
      const app = createMswServer(...handlers)

      try {
        await new Promise<void>((resolve, reject) => {
          const server = app.listen(portOption, '127.0.0.1')

          const cleanup = () => {
            server.off('listening', onListening)
            server.off('error', onError)
          }

          const onListening = () => {
            cleanup()
            const address = server.address()
            if (!address || typeof address === 'string') {
              reject(new Error('Unable to determine server address'))
              return
            }

            const { port: activePort } = address as AddressInfo
            this.httpServer = server
            this.config.serverPort = activePort
            this.config.supabaseLiteUrl = `http://127.0.0.1:${activePort}`
            this.log('info', `Server listening on ${this.config.supabaseLiteUrl}`)
            resolve()
          }

          const onError = (error: NodeJS.ErrnoException) => {
            cleanup()
            reject(error)
          }

          server.once('listening', onListening)
          server.once('error', onError)
        })

        return
      } catch (error) {
        lastError = error
        this.httpServer = null

        if ((error as NodeJS.ErrnoException)?.code === 'EADDRINUSE' && portOption !== 0) {
          this.log('info', `Port ${portOption} is already in use. Retrying with a random available port...`)
          continue
        }

        throw error
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  private async stopServer(): Promise<void> {
    if (!this.httpServer) {
      return
    }

    await new Promise<void>((resolve, reject) => {
      this.httpServer?.close(error => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })

    this.httpServer = null
  }

  private async ensureProject(): Promise<void> {
    this.currentProject = projectManager.getActiveProject()

    if (!this.currentProject) {
      this.log('info', 'No active project detected. Creating isolated test project...')
      this.currentProject = await projectManager.createProject('postgrest-tests')
    }

    await this.dbManager.initialize(this.currentProject.databasePath)
  }

  private async ensureServerReady(): Promise<void> {
    for (let attempt = 1; attempt <= this.config.healthCheckRetries; attempt++) {
      try {
        const response = await fetch(`${this.config.supabaseLiteUrl}/health`)
        if (response.ok) {
          const health = await response.json()
          if (health.status === 'ok') {
            this.log('info', 'Health check passed. API server ready.')
            return
          }
        }
      } catch (error) {
        this.log('debug', `Health check attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}`)
      }

      if (attempt < this.config.healthCheckRetries) {
        await new Promise(resolve => setTimeout(resolve, this.config.healthCheckDelay))
      }
    }

    throw new Error('Server failed health check')
  }

  // -----------------------------------------------------------------------
  // SQL utilities
  // -----------------------------------------------------------------------

  private extractSQLFromData(sqlData: string): string {
    return sqlData
      .replace(/^```sql\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim()
  }

  private splitSQLStatements(sql: string): string[] {
    return sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0)
      .map(stmt => (stmt.endsWith(';') ? stmt : `${stmt};`))
  }

  private async executeSingleSQL(statement: string): Promise<void> {
    const trimmed = statement.trim()
    const normalized = trimmed.toUpperCase()
    const isSchemaMutation = /^(DROP|CREATE)\s+SCHEMA\b/.test(normalized)
      || normalized.startsWith('GRANT ALL ON SCHEMA')

    try {
      if (isSchemaMutation) {
        await this.dbManager.exec(statement)
        return
      }
      await this.dbManager.queryWithContext(statement, { role: 'service_role' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`SQL execution failed: ${message}`)
    }
  }

  private async resetPublicSchema(): Promise<void> {
    const schemasToDrop = ['public', 'myschema', 'test_schema', 'custom_schema', 'temp_schema']

    for (const schema of schemasToDrop) {
      await this.executeSingleSQL(`DROP SCHEMA IF EXISTS "${schema}" CASCADE;`)
    }

    await this.executeSingleSQL('CREATE SCHEMA public;')
    await this.executeSingleSQL('GRANT ALL ON SCHEMA public TO postgres;')
    await this.executeSingleSQL('GRANT ALL ON SCHEMA public TO public;')
  }

  private async seedDatabase(sqlData: string | undefined, log: TestLog[]): Promise<void> {
    if (!sqlData) {
      log.push(this.createTestLog('info', 'No SQL data to seed - skipping database seeding'))
      return
    }

    const statements = this.splitSQLStatements(this.extractSQLFromData(sqlData))
    this.log('info', `Seeding database with ${statements.length} SQL statements`)

    for (let index = 0; index < statements.length; index++) {
      const statement = statements[index]

      try {
        await this.executeSingleSQL(statement)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.log('error', `Failed to execute statement ${index + 1}: ${message}`)
        throw new Error(`Database seeding failed on statement ${index + 1}: ${message}`)
      }
    }

    log.push(this.createTestLog('info', 'Database seeded successfully'))
  }

  // -----------------------------------------------------------------------
  // Template generation & execution
  // -----------------------------------------------------------------------

  private extractCodeFromExample(codeData: string): string {
    let cleanedCode = codeData
      .replace(/^```(?:js|ts)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim()

    const lines = cleanedCode.split('\n')
    const queryLines: number[] = []

    lines.forEach((line, index) => {
      if (line.trim().startsWith('const { data, error }')) {
        queryLines.push(index)
      }
    })

    if (queryLines.length > 1) {
      const lastQueryStart = queryLines[queryLines.length - 1]
      cleanedCode = lines.slice(lastQueryStart).join('\n')
    }

    cleanedCode = cleanedCode.replace(/const\s*{\s*error\s*}/g, 'const { data, error }')
    cleanedCode = cleanedCode.replace(/const\s*{\s*count,\s*error\s*}/g, 'const { data, count, error }')
    cleanedCode = cleanedCode.replace(/\.(\w+)\s*<([\s\S]*?)>\s*\(/g, (_, methodName: string) => `.${methodName}(`)

    return cleanedCode
  }

  private extractExpectedResponse(responseData: string): any {
    const trimmed = responseData.trim()

    if ((trimmed.startsWith('```\n') || trimmed.startsWith('```ts\n')) && !trimmed.includes('```json')) {
      const cleaned = trimmed
        .replace(/^```(?:ts)?\s*/m, '')
        .replace(/\s*```\s*$/m, '')
        .trim()

      if (cleaned.includes('cost=') && (cleaned.includes('rows=') || cleaned.includes('width='))) {
        return { __text_response_test: true, text: cleaned }
      }

      return { __typescript_test: true, code: cleaned }
    }

    const cleanedJson = trimmed
      .replace(/^```json\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim()

    return JSON.parse(cleanedJson)
  }

  private async generateTestScript(example: Example): Promise<string> {
    const templateContent = await fs.readFile(this.config.templateFile, 'utf-8')

    const nodeTemplate = templateContent
      .replace("import { createClient } from 'npm:@supabase/supabase-js';", "import { createClient } from '@supabase/supabase-js';")
      .replace(/Deno\.exit/g, 'process.exit')
      .replace('function getStatusCodeFromError(errorCode: string): number {', 'function getStatusCodeFromError(errorCode) {')
      .replace('function getStatusTextFromError(errorCode: string): string {', 'function getStatusTextFromError(errorCode) {')

    const code = this.extractCodeFromExample(example.code)
    const expectedResponse = this.extractExpectedResponse(example.response)
    const escapedCodeContent = JSON.stringify(code)

    const testScript = nodeTemplate
      .replace('<id>', example.id)
      .replace('<name>', example.name)
      .replace('<project_url>', this.config.supabaseLiteUrl)
      .replaceAll('<code>', code)
      .replaceAll('<code_content>', escapedCodeContent)
      .replace('<response>', JSON.stringify(expectedResponse, null, 2))
      .replace("debugSqlEndpoint: 'http://localhost:5173/debug/sql'", `debugSqlEndpoint: '${this.config.supabaseLiteUrl}/debug/sql'`)
      .replace('const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);',
        `const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, { fetch: globalThis.fetch });`)

    await fs.writeFile(this.config.tempScriptFile, testScript, 'utf-8')
    return this.config.tempScriptFile
  }

  private async runTest(scriptPath: string): Promise<{ success: boolean, output: string, error?: string }> {
    return await new Promise(resolve => {
      const child = spawn(process.execPath, [scriptPath], {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''
      let settled = false

      const finalize = (result: { success: boolean, output: string, error?: string }) => {
        if (!settled) {
          settled = true
          resolve(result)
        }
      }

      child.stdout.on('data', chunk => {
        stdout += chunk.toString()
      })

      child.stderr.on('data', chunk => {
        stderr += chunk.toString()
      })

      child.on('error', error => {
        const message = error instanceof Error ? error.message : String(error)
        finalize({
          success: false,
          output: stdout,
          error: `${message}${stderr ? `\n${stderr}` : ''}`
        })
      })

      child.on('close', code => {
        finalize({
          success: code === 0,
          output: stdout,
          error: stderr || undefined
        })
      })
    })
  }

  // -----------------------------------------------------------------------
  // Result comparison helpers
  // -----------------------------------------------------------------------

  private compareResults(actual: any, expected: any): ComparisonResult {
    const normalizedActual = this.normalizeComparisonValue(structuredClone(actual))
    const normalizedExpected = this.normalizeComparisonValue(structuredClone(expected))

    if (this.deepCompareWithWildcards(normalizedActual, normalizedExpected)) {
      return { match: true }
    }

    const actualStr = JSON.stringify(normalizedActual, null, 2)
    const expectedStr = JSON.stringify(normalizedExpected, null, 2)

    return {
      match: false,
      differences: `Expected:\n${expectedStr}\n\nActual:\n${actualStr}`
    }
  }

  private normalizeComparisonValue(value: any): any {
    if (value === null || value === undefined) {
      return value
    }

    if (Array.isArray(value)) {
      return value.map(item => this.normalizeComparisonValue(item))
    }

    if (typeof value === 'object') {
      const normalized: Record<string, any> = {}

      for (const [key, entry] of Object.entries(value)) {
        normalized[key] = this.normalizeComparisonValue(entry)
      }

      const errorObject = normalized.error
      if (
        errorObject &&
        typeof errorObject === 'object' &&
        typeof errorObject.message === 'string' &&
        errorObject.message.startsWith('AbortError:')
      ) {
        errorObject.message = 'AbortError: The signal has been aborted'
      }

      return normalized
    }

    return value
  }

  private deepCompareWithWildcards(actual: any, expected: any): boolean {
    if (expected === '*') {
      return true
    }

    if (actual === null || actual === undefined || expected === null || expected === undefined) {
      return actual === expected
    }

    if (typeof actual !== 'object' || typeof expected !== 'object') {
      return actual === expected
    }

    if (Array.isArray(actual) && Array.isArray(expected)) {
      if (actual.length !== expected.length) {
        return false
      }

      for (let i = 0; i < actual.length; i++) {
        if (!this.deepCompareWithWildcards(actual[i], expected[i])) {
          return false
        }
      }

      return true
    }

    if (Array.isArray(actual) || Array.isArray(expected)) {
      return false
    }

    const actualKeys = Object.keys(actual)
    const expectedKeys = Object.keys(expected)

    if (actualKeys.length !== expectedKeys.length) {
      return false
    }

    for (const key of expectedKeys) {
      if (!actualKeys.includes(key)) {
        return false
      }
      if (!this.deepCompareWithWildcards(actual[key], expected[key])) {
        return false
      }
    }

    return true
  }

  // -----------------------------------------------------------------------
  // Logging helpers for console output
  // -----------------------------------------------------------------------

  private displayTestHeader(item: TestItem, example: Example): void {
    const headerText = `Running Test: ${item.id} - ${example.name}`
    const border = '*'.repeat(headerText.length + 4)

    console.log(`\n${border}`)
    console.log(`* ${headerText} *`)
    console.log(`${border}\n`)
  }

  private displayTestResult(passed: boolean, testName: string, continuing = false): void {
    const emoji = passed ? '✅' : '❌'
    const status = passed ? 'PASSED' : 'FAILED'
    const suffix = continuing ? ' (continuing in retest mode)' : ''
    const resultText = `${emoji} ${status}: ${testName}${suffix}`
    const border = '*'.repeat(resultText.length + 4)

    console.log(`\n${border}`)
    console.log(`* ${resultText} *`)
    console.log(`${border}\n`)
  }

  private displayFailureDetails(item: TestItem, example: Example, results: TestResults): void {
    console.error(`\n=== FAILURE DETAILS ===`)
    console.error(`Test: ${item.id} - ${example.name}`)

    for (const entry of results.log) {
      if (entry.type === 'error') {
        console.error(`- ${entry.message}`)
      }
    }
  }

  // -----------------------------------------------------------------------
  // Core test execution logic
  // -----------------------------------------------------------------------

  private async processExample(item: TestItem, example: Example): Promise<TestResults> {
    const log: TestLog[] = []

    try {
      this.log('info', `Processing example: ${example.id} - ${example.name}`)
      log.push(this.createTestLog('info', `Starting test: ${example.name}`))

      await this.resetPublicSchema()
      log.push(this.createTestLog('info', 'Public schema reset for test isolation'))

      await this.seedDatabase(example.data?.sql, log)

      const scriptPath = await this.generateTestScript(example)
      log.push(this.createTestLog('info', 'Test script generated'))

      const testResult = await this.runTest(scriptPath)
      await fs.unlink(scriptPath).catch(() => {})

      if (!testResult.success) {
        this.log('error', `Test execution failed: ${testResult.error ?? 'Unknown error'}`)
        log.push(this.createTestLog('error', `Test execution failed: ${testResult.error ?? 'Unknown error'}`))
        return { passed: false, log, skip: false }
      }

      const outputLines = testResult.output.split('\n')
      const dataLine = outputLines.find(line => line.startsWith('Data: '))
      if (!dataLine) {
        log.push(this.createTestLog('error', 'No data output found in test result'))
        return { passed: false, log, skip: false }
      }

      const actualData = JSON.parse(dataLine.substring(6))
      const expectedData = this.extractExpectedResponse(example.response)

      if (expectedData.__typescript_test) {
        log.push(this.createTestLog('info', 'TypeScript type checking test - automatically passing'))
        return { passed: true, log, skip: true }
      }

      if (expectedData.__text_response_test) {
        log.push(this.createTestLog('info', 'Text response test - automatically passing'))
        return { passed: true, log, skip: true }
      }

      const comparison = this.compareResults(actualData, expectedData)

      if (comparison.match) {
        log.push(this.createTestLog('info', 'Test passed - results match expected output'))
        return { passed: true, log, skip: true }
      }

      const errorMsg = `Test failed - results don't match:\n${comparison.differences ?? ''}`
      log.push(this.createTestLog('error', errorMsg))
      return { passed: false, log, skip: false }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.push(this.createTestLog('error', `Test execution error: ${message}`))
      return { passed: false, log, skip: false }
    }
  }

  private shouldSkipExample(example: Example): string | null {
    if (example.unsupported) {
      return 'unsupported by pglite'
    }

    if (!example.results) {
      return null
    }

    const { results } = example

    if (this.isRetestMode) {
      if (!results.passed && results.skip) {
        return 'previously failed but marked to skip in regression mode'
      }

      if (results.passed && results.skip) {
        return null
      }

      return null
    }

    if (results.skip) {
      return 'already passed'
    }

    return null
  }

  private async processTests(testData: TestItem[], targetTestId?: string): Promise<void> {
    let regressionFailures: Array<{ item: TestItem, example: Example, error: string }> = []

    if (this.isRetestMode) {
      this.testStats = { passed: 0, failed: 0, skipped: 0, unsupported: 0 }
    }

    if (targetTestId) {
      for (const item of testData) {
        const examples = Array.isArray(item.examples) ? item.examples : []

        for (const example of examples) {
          if (example.id === targetTestId) {
            this.displayTestHeader(item, example)
            const results = await this.processExample(item, example)
            example.results = results
            await this.saveResults(testData)
            this.displayTestResult(results.passed, `${item.id} - ${example.name}`)
            return
          }
        }
      }

      throw new Error(`Test with id '${targetTestId}' not found`)
    }

    for (const item of testData) {
      const examples = Array.isArray(item.examples) ? item.examples : []

      if (examples.length === 0) {
        this.log('info', `Skipping test group ${item.id} (no runnable examples defined)${item.description ? ' - description only' : ''}`)
        this.testStats.unsupported++
        continue
      }

      for (const example of examples) {
        const skipReason = this.shouldSkipExample(example)

        if (skipReason) {
          this.log('info', `Skipping test ${example.id} (${skipReason})`)
          if (this.isRetestMode) {
            if (skipReason === 'unsupported by pglite') {
              this.testStats.unsupported++
            } else {
              this.testStats.skipped++
            }
          }
          continue
        }

        this.displayTestHeader(item, example)

        const previousResults = example.results
        const results = await this.processExample(item, example)
        example.results = results
        await this.saveResults(testData)

        if (this.isRetestMode) {
          if (results.passed) {
            this.testStats.passed++
          } else {
            this.testStats.failed++
            if (previousResults?.passed) {
              regressionFailures.push({
                item,
                example,
                error: results.log.find(entry => entry.type === 'error')?.message ?? 'Unknown error'
              })
            }
          }
        }

        if (!results.passed && !this.isRetestMode) {
          this.displayTestResult(false, `${item.id} - ${example.name}`)
          this.displayFailureDetails(item, example, results)
          throw new Error('Stopping execution on first failure for debugging')
        }

        this.displayTestResult(results.passed, `${item.id} - ${example.name}`, this.isRetestMode && !results.passed)
      }
    }

    if (this.isRetestMode) {
      const executed = this.testStats.passed + this.testStats.failed
      const total = executed + this.testStats.skipped + this.testStats.unsupported
      this.log('info', '\n=== RETEST STATISTICS ===')
      this.log('info', `Total tests: ${total}`)
      this.log('info', `✅ Passed: ${this.testStats.passed}`)
      this.log('info', `❌ Failed: ${this.testStats.failed}`)
      this.log('info', `⏭️  Skipped: ${this.testStats.skipped}`)
      this.log('info', `🚫 Unsupported: ${this.testStats.unsupported}`)
      this.log('info', `Tests executed: ${executed}`)
      if (executed > 0) {
        this.log('info', `Success rate: ${((this.testStats.passed / executed) * 100).toFixed(1)}%`)
      } else {
        this.log('info', 'Success rate: N/A (no tests executed)')
      }
      this.log('info', '========================')

      if (regressionFailures.length > 0) {
        this.log('error', `\n=== REGRESSION TEST FAILURES (${regressionFailures.length}) ===`)
        for (const failure of regressionFailures) {
          this.log('error', `${failure.item.id} - ${failure.example.name}:`)
          this.log('error', failure.error)
          this.log('error', '---')
        }
        throw new Error(`${regressionFailures.length} regression test(s) failed`)
      }
    }
  }

  // -----------------------------------------------------------------------
  // Persistence helpers
  // -----------------------------------------------------------------------

  private async loadTestData(): Promise<TestItem[]> {
    const jsonContent = await fs.readFile(this.config.testJsonFile, 'utf-8')
    return JSON.parse(jsonContent) as TestItem[]
  }

  private async saveResults(testData: TestItem[]): Promise<void> {
    const jsonContent = JSON.stringify(testData, null, 2)
    await fs.writeFile(this.config.testJsonFile, jsonContent)
  }

  // -----------------------------------------------------------------------
  // Public entrypoint
  // -----------------------------------------------------------------------

  async run(targetTestId?: string): Promise<void> {
    try {
      this.log('info', '🚀 Starting PostgREST Test Runner (Node)')
      await this.ensureProject()
      await this.startServer()
      await this.ensureServerReady()

      const testData = await this.loadTestData()
      this.log('info', `Loaded ${testData.length} test categories`)

      await this.processTests(testData, targetTestId)

      this.log('info', '\n=== All tests completed successfully! ===')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.log('error', `Test runner failed: ${message}`)
      throw error
    } finally {
      await this.stopServer()
    }
  }
}

// ---------------------------------------------------------------------------
// CLI Entry point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const isRetestMode = args.includes('--retest')

let targetTestId: string | undefined
const testIdIndex = args.indexOf('--test-id')
if (testIdIndex >= 0 && testIdIndex < args.length - 1) {
  targetTestId = args[testIdIndex + 1]
}

if (targetTestId) {
  console.log(`🎯 Running single test with ID: ${targetTestId}`)
  console.log('   - Will run only this specific test, ignoring skip flags')
  console.log('   - Will stop immediately if the test fails\n')
} else if (isRetestMode) {
  console.log('🔄 Running in regression test mode (--retest)')
  console.log('   - Will run all tests except those that previously failed with skip=true')
  console.log('   - Will detect regressions (tests that previously passed but now fail)')
  console.log('   - Will continue running all tests even if failures occur\n')
} else {
  console.log('🚀 Running in normal test mode')
  console.log('   - Will skip tests that previously passed (skip=true)')
  console.log('   - Will stop on first failure for debugging\n')
}

const runner = new PostgRESTNodeTestRunner(isRetestMode)

try {
  await runner.run(targetTestId)
  process.exit(0)
} catch (error) {
  process.exit(1)
}
