import { http, HttpResponse } from 'msw'
import { withProjectResolution } from '../handlers/shared/project-resolution'
import { WebVMManager } from '@/lib/application-server/WebVMManager'
import { RuntimeRepository } from '@/lib/application-server/RuntimeRepository'

const webvm = WebVMManager.getInstance()
const repository = RuntimeRepository.getInstance(webvm)

async function ensureEnvironment() {
  await repository.initialize()
  await webvm.initialize()
}

const applicationServerHandler = () =>
  async ({ params, request, projectInfo }: any) => {
    try {
      await ensureEnvironment()
      const url = new URL(request.url)
      const appName = params.appName as string

      const runtimeSummary = (await repository.getInstalledPackages())
        .map((pkg) => `${pkg.name} (${pkg.version})`)
        .join(', ')

      const body = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Application Server Preview</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 640px; margin: 0 auto; }
      h1 { margin-bottom: 0.5rem; }
      code { background: #f4f4f5; padding: 0.25rem 0.5rem; border-radius: 0.375rem; }
      .meta { color: #71717a; font-size: 0.875rem; margin-bottom: 1rem; }
      .callout { border-left: 4px solid #3b82f6; padding-left: 1rem; margin: 1.5rem 0; }
    </style>
  </head>
  <body>
    <h1>Application Server</h1>
    <p class="meta">Project: ${projectInfo?.projectId ?? 'default'} — App: ${appName}</p>
    <p>The Application Server runtime is initialized, but request routing into WebVM-backed apps
    is not wired up yet. This placeholder response confirms the MSW handler is active.</p>
    <div class="callout">
      <strong>Request path:</strong> <code>${url.pathname}</code>
    </div>
    <p>Installed runtimes: ${runtimeSummary || 'None yet. Install nginx and Node.js in the UI.'}</p>
    <p>Once WebVM networking is connected, this handler will proxy the request into the running
    process inside the browser VM.</p>
  </body>
</html>`

      return new HttpResponse(body, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    } catch (error) {
      console.error('[ApplicationServer] handler error', error)
      return new HttpResponse('Application Server is not ready yet.', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      })
    }
  }

export const applicationServerHandlers = [
  http.get('/app/:appName/*', withProjectResolution(applicationServerHandler())),
  http.get('/:projectId/app/:appName/*', withProjectResolution(applicationServerHandler())),
]
