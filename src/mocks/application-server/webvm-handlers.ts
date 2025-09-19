import { http, HttpResponse } from 'msw'
import { withProjectResolution } from '../handlers/shared/project-resolution'
import { WebVMManager } from '@/lib/application-server/WebVMManager'
import { RuntimeRepository } from '@/lib/application-server/RuntimeRepository'
import { ApplicationServerStore } from '@/lib/application-server/state/ApplicationServerStore'
import { WebVMFileStore } from '@/lib/application-server/persistence/WebVMFileStore'

const webvm = WebVMManager.getInstance()
const repository = RuntimeRepository.getInstance(webvm)
const store = ApplicationServerStore.getInstance()
const fileStore = WebVMFileStore.getInstance()

async function ensureEnvironment() {
  await repository.initialize()
  await webvm.initialize()
  await store.initialize()
}

function normalizeRequestPath(appName: string, requestPath: string, wildcard: string | undefined): string {
  if (wildcard && wildcard.length > 0) {
    return wildcard.replace(/^\//, '')
  }
  const pattern = new RegExp(`^/?app/${appName}/?`, 'i')
  const cleaned = requestPath.replace(pattern, '').replace(/^\//, '')
  return cleaned
}

function resolveCandidatePaths(appDeployPath: string, relative: string): string[] {
  const base = appDeployPath.replace(/\/+$/, '')
  const candidates: string[] = []
  if (!relative) {
    candidates.push(`${base}/index.html`)
  } else {
    candidates.push(`${base}/${relative}`)
    if (relative.endsWith('/')) {
      candidates.push(`${base}/${relative}index.html`)
    }
    if (!relative.includes('.')) {
      candidates.push(`${base}/${relative}/index.html`)
    }
  }
  return candidates.map((path) => path.replace(/\/+/, '/'))
}

function inferContentType(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html; charset=utf-8'
  if (lower.endsWith('.js')) return 'application/javascript; charset=utf-8'
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8'
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.ico')) return 'image/x-icon'
  if (lower.endsWith('.webmanifest')) return 'application/manifest+json'
  return 'application/octet-stream'
}

async function serveStaticApplication({ params, request }: any): Promise<HttpResponse> {
  console.debug('[MSW] serveStaticApplication', request.url)
  await ensureEnvironment()

  const appName = params.appName as string
  const wildcard = params['*'] as string | undefined
  const snapshot = store.getSnapshot()
  const app = snapshot.applications.find((candidate) => candidate.name === appName)

  if (!app) {
    return new HttpResponse('Application not found', { status: 404 })
  }

  if (app.status !== 'running' && app.status !== 'stopped') {
    return new HttpResponse('Application is not ready yet', { status: 503 })
  }

  const relativePath = normalizeRequestPath(appName, new URL(request.url).pathname, wildcard)
  const candidates = resolveCandidatePaths(app.deployPath, relativePath)

  if (app.status === 'running' && webvm.hasBridge() && app.port) {
    const proxied = await webvm.proxyStaticApplication(app, relativePath, request)
    if (proxied) {
      return proxied
    }
  }

  for (const candidate of candidates) {
    const data = await fileStore.readFile(app.id, candidate)
    if (data) {
      return new HttpResponse(data, {
        status: 200,
        headers: { 'Content-Type': inferContentType(candidate) },
      })
    }
  }

  return new HttpResponse('File not found', { status: 404 })
}

export const applicationServerHandlers = [
  http.get('/app/:appName/*', withProjectResolution(serveStaticApplication)),
  http.get('/:projectId/app/:appName/*', withProjectResolution(serveStaticApplication)),
]
