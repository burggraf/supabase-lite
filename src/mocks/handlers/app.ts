import { http, HttpResponse } from 'msw'
import { VFSBridge } from '../../lib/vfs/VFSBridge'
import { webvmManager, WebVMStaticAssetError } from '@/lib/webvm'
import { withProjectResolution } from './shared/project-resolution'
import { initializeVFS } from './shared/common-handlers'

// Initialize the VFS bridge
const vfsBridge = new VFSBridge()

const DEFAULT_STATIC_PLACEHOLDER_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Supabase Lite Static Hosting</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 3rem; background: #0f172a; color: #e2e8f0; }
      main { max-width: 720px; margin: 0 auto; }
      code { background: rgba(148, 163, 184, 0.15); padding: 0.2rem 0.4rem; border-radius: 4px; }
      a { color: #38bdf8; }
    </style>
  </head>
  <body>
    <main>
      <h1>Static hosting inside WebVM</h1>
      <p>The WebVM static server is running. Drop files into <code>/home/user/www</code> from the terminal to see them here.</p>
      <p>Example commands:</p>
      <pre><code>echo "&lt;h1&gt;Hello from WebVM&lt;/h1&gt;" &gt; index.html
mkdir -p assets && echo "body { font-family: sans-serif; }" &gt; assets/site.css</code></pre>
      <p>Then refresh this page: <code>/app/default/</code>.</p>
    </main>
  </body>
</html>`;

/**
 * SPA (Single Page Application) hosting handler
 * Handles requests forwarded from Vite middleware via WebSocket
 */
const createSPAHandler = () => async ({ params: _params, request, projectInfo }: any) => {
  try {
    const path = new URL(request.url).pathname;
    const method = request.method;
    const userAgent = request.headers.get('user-agent');
    
    console.log('🌐 MSW: SPA request', { 
      path, 
      method, 
      projectId: projectInfo?.projectId,
      isAssetRequest: path.includes('.'),
      userAgent: userAgent ? userAgent.substring(0, 50) + '...' : 'none'
    });
    
    // Initialize VFS for the current project
    await initializeVFS(vfsBridge, projectInfo)
    
    const response = await vfsBridge.handleSPARequest({ path });
    
    console.log('✅ MSW: SPA served', { path, status: response.status });
    return response;
  } catch (error) {
    console.error('❌ MSW: SPA error:', error);
    return new HttpResponse(
      '<html><body><h1>Application Error</h1></body></html>',
      {
        status: 500,
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
};

const createWebVMStaticHandler = () =>
  async ({ params, request }: any) => {
    const method = request.method.toUpperCase();

    if (method !== 'GET' && method !== 'HEAD') {
      return new HttpResponse('Method Not Allowed', { status: 405 });
    }

    const appName = params?.appName || 'default';
    const url = new URL(request.url);
    const basePath = `/app/${appName}`;
    let relativePath = url.pathname.slice(basePath.length);
    if (!relativePath.startsWith('/')) {
      relativePath = `/${relativePath}`;
    }

    const normalizedPath = relativePath === '/' ? '/index.html' : relativePath;

    try {
      const asset = await webvmManager.fetchStaticAsset(appName, normalizedPath);
      const headers = new Headers({
        'Content-Type': asset.contentType,
        'Cache-Control': 'no-cache',
      });

      if (method === 'HEAD') {
        return new HttpResponse(null, { status: asset.status, headers });
      }

      const buffer = await asset.body.arrayBuffer();
      return new HttpResponse(buffer, { status: asset.status, headers });
    } catch (error) {
      console.error('MSW WebVM proxy error', { appName, normalizedPath, error });

      const status = typeof error === 'object' && error && 'status' in error ? (error as any).status : undefined;
      const message = typeof error === 'object' && error && 'message' in error ? (error as any).message : 'Unknown error';

      if (appName === 'default' && (normalizedPath === '/index.html' || normalizedPath === '/index.htm') && method === 'GET') {
        return new HttpResponse(DEFAULT_STATIC_PLACEHOLDER_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
        });
      }

      if (method === 'HEAD') {
        return new HttpResponse(null, {
          status: status ?? 500,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }

      if (typeof status === 'number') {
        return new HttpResponse(message, {
          status,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }

      console.error('MSW: WebVM static proxy error', error);
      return new HttpResponse('WebVM proxy failure', {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  };

// App hosting handlers
export const appHandlers = [
  http.all('/app/:appName', createWebVMStaticHandler()),
  http.all('/app/:appName/*', createWebVMStaticHandler()),
  // SPA (Single Page Application) hosting (legacy VFS path)
  http.get('/app/*', withProjectResolution(createSPAHandler())),
  http.get('/:projectId/app/*', withProjectResolution(createSPAHandler())),
]
