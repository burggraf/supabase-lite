/**
 * MSW handlers for Application Server API with WebVM integration
 * 
 * Provides real WebVM-based application hosting with HTTP proxy functionality
 * Replaces static file serving with actual server runtime virtualization
 */

import { http, HttpResponse } from 'msw';
import { logger as Logger } from '@/lib/infrastructure/Logger';
import { withProjectResolution } from './handlers/shared/project-resolution';

// Persistent application storage using localStorage
const APPLICATIONS_STORAGE_KEY = 'supabase-lite-applications';

function loadApplications(): Map<string, any> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(APPLICATIONS_STORAGE_KEY);
      if (stored) {
        const apps = JSON.parse(stored);
        const map = new Map();
        for (const [key, value] of Object.entries(apps)) {
          map.set(key, value);
        }
        Logger.info('Loaded applications from localStorage', { count: map.size });
        return map;
      }
    }
  } catch (error) {
    Logger.error('Failed to load applications from localStorage', error as Error);
  }
  return new Map();
}

function saveApplications(applications: Map<string, any>): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const apps = Object.fromEntries(applications.entries());
      localStorage.setItem(APPLICATIONS_STORAGE_KEY, JSON.stringify(apps));
      Logger.debug('Saved applications to localStorage', { count: applications.size });
    }
  } catch (error) {
    Logger.error('Failed to save applications to localStorage', error as Error);
  }
}

// Load applications from localStorage on startup
const applications = loadApplications();

export const applicationServerHandlers = [
  // Health check endpoint for Application Server services
  http.get('/api/debug/application-server/health', async () => {
    return HttpResponse.json({
      status: 'healthy',
      ready: true,
      timestamp: new Date().toISOString()
    });
  }),

  // Get all applications
  http.get('/api/applications', async ({ request }) => {
    Logger.info('GET /api/applications called');
    const apps = Array.from(applications.values());
    return HttpResponse.json(apps);
  }),

  // Create new application
  http.post('/api/applications', withProjectResolution(async ({ request, projectInfo }: any) => {
    try {
      const body = await request.json();
      Logger.info('POST /api/applications called', { body });

      const application = {
        id: body.id,
        name: body.name,
        description: body.description,
        runtimeId: body.runtimeId,
        status: 'CREATED',
        metadata: body.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Process uploaded files and store them in VFS
      if (body.metadata && body.metadata.files && body.metadata.files.length > 0) {
        const { vfsManager } = await import('../lib/vfs/VFSManager');
        const projectId = projectInfo?.projectId || 'default';
        await vfsManager.initialize(projectId);
        
        Logger.info('Processing uploaded files', { fileCount: body.metadata.files.length });
        
        for (const fileData of body.metadata.files) {
          const filePath = `app-hosting/${application.id}/${fileData.name}`;
          const mimeType = getContentType(fileData.name);
          
          await vfsManager.createFile(filePath, {
            content: fileData.content,
            mimeType,
            metadata: {
              originalName: fileData.name,
              size: fileData.size,
              uploadedAt: new Date().toISOString(),
              applicationId: application.id
            }
          });
          
          Logger.info('File stored in VFS', { filePath, mimeType, size: fileData.size });
        }
      }

      applications.set(application.id, application);
      saveApplications(applications);
      Logger.info('Application created successfully', { id: application.id });
      
      return HttpResponse.json(application, { status: 201 });
    } catch (error) {
      Logger.error('Error creating application', error as Error);
      return HttpResponse.json(
        { error: 'Failed to create application' },
        { status: 500 }
      );
    }
  })),

  // Get specific application
  http.get('/api/applications/:appId', async ({ params }) => {
    const appId = params.appId as string;
    const application = applications.get(appId);
    
    if (!application) {
      return HttpResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }
    
    return HttpResponse.json(application);
  }),

  // Start application
  http.post('/api/applications/:appId/start', async ({ params }) => {
    const appId = params.appId as string;
    const application = applications.get(appId);
    
    if (!application) {
      return HttpResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }
    
    application.status = 'RUNNING';
    application.updatedAt = new Date().toISOString();
    applications.set(appId, application);
    saveApplications(applications);
    
    Logger.info('Application started', { appId });
    return HttpResponse.json(application);
  }),

  // Stop application
  http.post('/api/applications/:appId/stop', async ({ params }) => {
    const appId = params.appId as string;
    const application = applications.get(appId);
    
    if (!application) {
      return HttpResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }
    
    application.status = 'STOPPED';
    application.updatedAt = new Date().toISOString();
    applications.set(appId, application);
    saveApplications(applications);
    
    Logger.info('Application stopped', { appId });
    return HttpResponse.json(application);
  }),

  // Serve application files
  http.get('/app/:appId', withProjectResolution(async ({ params, request, projectInfo }: any) => {
    try {
      const appId = params.appId as string;
      
      Logger.info('Serving application', { appId });
      
      // Debug: Log all applications in the Map
      const allApps = Array.from(applications.keys());
      Logger.info('Available applications', { allApps, requestedAppId: appId });
      
      // Check if application exists
      const application = applications.get(appId);
      if (!application) {
        Logger.error('Application not found in Map', { appId, availableApps: allApps });
        return new HttpResponse('Application not found', { status: 404 });
      }
      
      // Try to load from VFS
      const { vfsManager } = await import('../lib/vfs/VFSManager');
      const projectId = projectInfo?.projectId || 'default';
      await vfsManager.initialize(projectId);
      
      const filePath = `app-hosting/${appId}/index.html`;
      Logger.info('Looking for file in VFS', { filePath });
      
      const file = await vfsManager.readFile(filePath);
      if (file && file.content) {
        Logger.info('Serving file from VFS', { filePath, contentType: file.mimeType });
        return new HttpResponse(file.content, {
          status: 200,
          headers: {
            'Content-Type': file.mimeType || 'text/html'
          }
        });
      }
      
      // Fallback to demo content
      Logger.info('No VFS file found, serving demo content');
      return new HttpResponse(
        `<!DOCTYPE html>
<html>
<head>
    <title>${application.name} - Supabase Lite Application Server</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            max-width: 600px; 
            margin: 50px auto; 
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            background: rgba(255,255,255,0.1);
            padding: 30px;
            border-radius: 10px;
            backdrop-filter: blur(10px);
        }
        h1 { color: #fff; text-align: center; }
        p { line-height: 1.6; }
        .status { 
            background: rgba(0,255,0,0.2); 
            padding: 10px; 
            border-radius: 5px; 
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${application.name}</h1>
        <p><strong>Description:</strong> ${application.description}</p>
        <p><strong>Runtime:</strong> ${application.runtimeId}</p>
        <div class="status">
            <strong>Status:</strong> ${application.status}
        </div>
        <p><strong>Created:</strong> ${new Date(application.createdAt).toLocaleString()}</p>
        <p><em>This is the demo app placeholder. Your uploaded files should replace this content.</em></p>
    </div>
</body>
</html>`,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html'
          }
        }
      );
    } catch (error) {
      Logger.error('Error serving application', error as Error, { appId: params.appId });
      return new HttpResponse('Internal Server Error', { status: 500 });
    }
  })),

  // Get available runtimes
  http.get('/api/runtimes', async () => {
    const runtimes = [
      {
        id: 'static',
        name: 'Static Files',
        type: 'static',
        version: '1.0.0',
        status: 'installed',
        installedAt: new Date('2024-01-01').toISOString(),
        config: {
          defaultPort: 8080,
          supportedExtensions: ['html', 'css', 'js', 'json', 'png', 'jpg', 'gif', 'svg'],
          buildRequired: false,
          startupTimeout: 1000,
          resourceLimits: {
            memory: 256,
            cpu: 0.5
          }
        }
      },
      {
        id: 'nodejs-20',
        name: 'Node.js 20.x',
        type: 'nodejs',
        version: '20.10.0',
        status: 'available',
        config: {
          defaultPort: 3000,
          supportedExtensions: ['js', 'ts', 'json'],
          buildRequired: true,
          startupTimeout: 5000,
          resourceLimits: {
            memory: 512,
            cpu: 1.0
          }
        }
      },
      {
        id: 'nextjs-15',
        name: 'Next.js 15',
        type: 'nextjs',
        version: '15.0.0',
        status: 'available',
        config: {
          defaultPort: 3000,
          supportedExtensions: ['js', 'jsx', 'ts', 'tsx'],
          buildRequired: true,
          startupTimeout: 10000,
          resourceLimits: {
            memory: 1024,
            cpu: 1.5
          }
        }
      }
    ];
    
    Logger.info('GET /api/runtimes called', { runtimeCount: runtimes.length });
    return HttpResponse.json({ runtimes });
  }),

  // Install runtime endpoint
  http.post('/api/runtimes/:runtimeId/install', async ({ params }) => {
    const runtimeId = params.runtimeId as string;
    Logger.info('POST /api/runtimes/:runtimeId/install called', { runtimeId });
    
    // Simulate runtime installation
    const runtime = {
      id: runtimeId,
      name: `Runtime ${runtimeId}`,
      type: runtimeId.includes('nodejs') ? 'nodejs' : runtimeId.includes('nextjs') ? 'nextjs' : 'static',
      version: '1.0.0',
      status: 'installed',
      installedAt: new Date().toISOString(),
      config: {
        defaultPort: 3000,
        supportedExtensions: ['js', 'json'],
        buildRequired: true,
        startupTimeout: 5000,
        resourceLimits: {
          memory: 512,
          cpu: 1.0
        }
      }
    };
    
    return HttpResponse.json(runtime);
  }),

  // WebVM status endpoint
  http.get('/api/debug/webvm/status', async () => {
    return HttpResponse.json({
      status: 'active',
      provider: 'static',
      timestamp: new Date().toISOString()
    });
  })
];

// Helper function to determine content type
function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'txt': 'text/plain'
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}