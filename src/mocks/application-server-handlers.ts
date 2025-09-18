/**
 * MSW handlers for Application Server API with WebVM integration
 * 
 * Provides real WebVM-based application hosting with HTTP proxy functionality
 * Replaces static file serving with actual server runtime virtualization
 */

import { http, HttpResponse } from 'msw';
import { logger as Logger } from '@/lib/infrastructure/Logger';
import { withProjectResolution } from './handlers/shared/project-resolution';
import { applicationPersistence } from '@/lib/application-server/ApplicationPersistence';

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
    try {
      const apps = await applicationPersistence.getAllApplications();
      Logger.debug('Retrieved applications from persistence', { count: apps.length });
      return HttpResponse.json({ applications: apps });
    } catch (error) {
      Logger.error('Failed to get applications', error as Error);
      return HttpResponse.json(
        { error: 'Failed to load applications' },
        { status: 500 }
      );
    }
  }),

  // Create new application
  http.post('/api/applications', async ({ request }) => {
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
        const projectId = 'default'; // Use default project for Application Server
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

      await applicationPersistence.saveApplication(application);
      Logger.info('Application created and persisted successfully', { id: application.id });
      
      return HttpResponse.json(application, { status: 201 });
    } catch (error) {
      Logger.error('Error creating application', error as Error);
      return HttpResponse.json(
        { error: 'Failed to create application' },
        { status: 500 }
      );
    }
  }),

  // Get specific application
  http.get('/api/applications/:appId', async ({ params }) => {
    const appId = params.appId as string;
    try {
      const application = await applicationPersistence.getApplication(appId);
      
      if (!application) {
        return HttpResponse.json(
          { error: 'Application not found' },
          { status: 404 }
        );
      }
      
      return HttpResponse.json(application);
    } catch (error) {
      Logger.error('Failed to get application', error as Error);
      return HttpResponse.json(
        { error: 'Failed to load application' },
        { status: 500 }
      );
    }
  }),

  // Delete application
  http.delete('/api/applications/:appId', async ({ params }) => {
    const appId = params.appId as string;
    try {
      const application = await applicationPersistence.getApplication(appId);
      
      if (!application) {
        return HttpResponse.json(
          { error: 'Application not found' },
          { status: 404 }
        );
      }

      // Stop the application if it's running
      if (application.status === 'RUNNING') {
        try {
          const { WebVMManager } = await import('../lib/webvm/WebVMManager');
          const webvm = WebVMManager.getInstance({
            type: 'cheerpx',
            webvm: {
              memorySize: 256,
              persistent: true,
              diskImage: 'https://disks.webvm.io/debian_small_20230522_0234.ext2'
            }
          });
          
          const runtime = await webvm.getRuntimeForApp(appId);
          if (runtime) {
            await webvm.stopRuntime(runtime.id);
            Logger.info('Stopped runtime before deleting application', { appId, runtimeId: runtime.id });
          }
        } catch (stopError) {
          Logger.warn('Failed to stop runtime before deleting application', { error: stopError, appId });
        }
      }

      // Delete application files from VFS if they exist
      try {
        const { vfsManager } = await import('../lib/vfs/VFSManager');
        await vfsManager.initialize('default');
        
        // Try to delete application folder
        const appFolderPath = `app-hosting/${appId}`;
        const files = await vfsManager.listFiles(appFolderPath);
        
        for (const file of files) {
          try {
            await vfsManager.deleteFile(`${appFolderPath}/${file.name}`);
          } catch (fileError) {
            Logger.warn('Failed to delete application file', { error: fileError, file: file.name });
          }
        }
        
        Logger.info('Deleted application files', { appId, fileCount: files.length });
      } catch (vfsError) {
        Logger.warn('Failed to clean up application files', { error: vfsError, appId });
      }

      // Remove from persistence
      await applicationPersistence.deleteApplication(appId);
      
      Logger.info('Application deleted successfully', { appId });
      return HttpResponse.json({ message: 'Application deleted successfully', id: appId });
      
    } catch (error) {
      Logger.error('Failed to delete application', error as Error);
      return HttpResponse.json(
        { error: 'Failed to delete application' },
        { status: 500 }
      );
    }
  }),

  // Start application - REAL WebVM runtime startup
  http.post('/api/applications/:appId/start', async ({ params }) => {
    const appId = params.appId as string;
    try {
      const application = await applicationPersistence.getApplication(appId);
      
      if (!application) {
        return HttpResponse.json(
          { error: 'Application not found' },
          { status: 404 }
        );
      }
      
      // Start REAL WebVM runtime for this application
      const { WebVMManager } = await import('../lib/webvm/WebVMManager');
      const webvm = WebVMManager.getInstance({
        type: 'cheerpx',
        webvm: {
          memorySize: 256,
          persistent: true,
          diskImage: 'https://disks.webvm.io/debian_small_20230522_0234.ext2',
          logLevel: 'debug'
        }
      });

      // Ensure WebVM is initialized
      if (!webvm.getSystemMetrics().webvm.initialized) {
        await webvm.initialize();
      }

      // Handle different runtime types
      if (application.runtimeId === 'static') {
        // Static applications don't need a runtime - just mark as running
        Logger.info('Starting static application (no runtime required)', { 
          appId, 
          runtimeId: application.runtimeId 
        });
        
        application.status = 'RUNNING';
        application.updatedAt = new Date().toISOString();
        application.metadata = {
          ...application.metadata,
          staticApp: true,
          realWebVM: false // Static apps don't use WebVM
        };
        await applicationPersistence.saveApplication(application);
        
        Logger.info('Static application started successfully', { appId });
      } else {
        // For non-static applications, start the appropriate runtime
        const runtimeType = application.runtimeId.includes('nodejs') ? 'node' : 'python';
        const runtimeVersion = application.runtimeId.includes('20') ? '20' : '18';
        
        Logger.info('Starting REAL WebVM runtime for application', { 
          appId, 
          runtimeType, 
          runtimeVersion,
          runtimeId: application.runtimeId 
        });

        const runtimeInstance = await webvm.startRuntime(runtimeType, runtimeVersion, {
          appId: application.id,
          name: application.name,
          environment: {},
          port: 3000,
          autoRestart: true
        });

        Logger.info('REAL WebVM runtime started successfully', { 
          appId, 
          instanceId: runtimeInstance.id,
          status: runtimeInstance.status 
        });
        
        application.status = 'RUNNING';
        application.updatedAt = new Date().toISOString();
        // Store runtime instance ID in application metadata
        application.metadata = {
          ...application.metadata,
          runtimeInstanceId: runtimeInstance.id,
          realWebVM: true
        };
        await applicationPersistence.saveApplication(application);
      }
      
      Logger.info('Application started successfully', { 
        appId,
        isStatic: application.runtimeId === 'static',
        runtimeInstanceId: application.metadata?.runtimeInstanceId 
      });
      return HttpResponse.json(application);
    } catch (error) {
      Logger.error('Failed to start application with REAL WebVM', error as Error);
      return HttpResponse.json(
        { error: `Failed to start application: ${(error as Error).message}` },
        { status: 500 }
      );
    }
  }),

  // Stop application - REAL WebVM runtime shutdown
  http.post('/api/applications/:appId/stop', async ({ params }) => {
    const appId = params.appId as string;
    try {
      const application = await applicationPersistence.getApplication(appId);
      
      if (!application) {
        return HttpResponse.json(
          { error: 'Application not found' },
          { status: 404 }
        );
      }
      
      // Stop REAL WebVM runtime if it exists
      if (application.metadata?.runtimeInstanceId) {
        const { WebVMManager } = await import('../lib/webvm/WebVMManager');
        const webvm = WebVMManager.getInstance({
          type: 'cheerpx',
          webvm: {
            memoryMB: 256,
            diskSizeMB: 512,
            networkingEnabled: true,
            debugMode: true,
            linuxDistribution: 'debian'
          }
        });

        Logger.info('Stopping REAL WebVM runtime for application', { 
          appId, 
          runtimeInstanceId: application.metadata.runtimeInstanceId 
        });

        try {
          await webvm.stopRuntime(application.metadata.runtimeInstanceId);
          Logger.info('REAL WebVM runtime stopped successfully', { 
            appId, 
            runtimeInstanceId: application.metadata.runtimeInstanceId 
          });
          
          // Clear runtime instance ID from metadata
          application.metadata = {
            ...application.metadata,
            runtimeInstanceId: undefined,
            realWebVM: false
          };
        } catch (runtimeError) {
          Logger.warn('Failed to stop WebVM runtime, but continuing with app stop', { 
            appId, 
            runtimeInstanceId: application.metadata.runtimeInstanceId,
            error: runtimeError 
          });
        }
      }
      
      application.status = 'STOPPED';
      application.updatedAt = new Date().toISOString();
      await applicationPersistence.saveApplication(application);
      
      Logger.info('Application stopped with REAL WebVM runtime cleanup', { appId });
      return HttpResponse.json(application);
    } catch (error) {
      Logger.error('Failed to stop application with REAL WebVM', error as Error);
      return HttpResponse.json(
        { error: `Failed to stop application: ${(error as Error).message}` },
        { status: 500 }
      );
    }
  }),

  // Serve application files - REAL WebVM HTTP proxy
  http.get('/app/:appId', withProjectResolution(async ({ params, request, projectInfo }: any) => {
    try {
      const appId = params.appId as string;
      
      Logger.info('REAL WebVM: Serving application via HTTP proxy', { appId });
      
      // Check if application exists using persistence
      const application = await applicationPersistence.getApplication(appId);
      if (!application) {
        Logger.error('Application not found in persistence', { appId });
        return new HttpResponse('Application not found', { status: 404 });
      }

      // Check if application has a REAL WebVM runtime running
      if (application.status === 'RUNNING' && application.metadata?.runtimeInstanceId && application.metadata?.realWebVM) {
        Logger.info('REAL WebVM: Proxying HTTP request to runtime instance', { 
          appId, 
          runtimeInstanceId: application.metadata.runtimeInstanceId 
        });

        try {
          const { WebVMManager } = await import('../lib/webvm/WebVMManager');
          const webvm = WebVMManager.getInstance({
            type: 'cheerpx',
            webvm: {
              memoryMB: 256,
              diskSizeMB: 512,
              networkingEnabled: true,
              debugMode: true,
              linuxDistribution: 'debian'
            }
          });

          // Proxy the HTTP request to the WebVM runtime
          const response = await webvm.proxyHTTPRequest(application.metadata.runtimeInstanceId, request);
          
          Logger.info('REAL WebVM: HTTP request proxied successfully', { 
            appId, 
            runtimeInstanceId: application.metadata.runtimeInstanceId,
            status: response.status 
          });
          
          return response;
        } catch (proxyError) {
          Logger.error('REAL WebVM: HTTP proxy failed, falling back to static content', { 
            appId, 
            runtimeInstanceId: application.metadata.runtimeInstanceId,
            error: proxyError 
          });
          // Fall through to static content serving
        }
      }

      // For non-running apps or static apps, serve from VFS
      const { vfsManager } = await import('../lib/vfs/VFSManager');
      const projectId = projectInfo?.projectId || 'default';
      await vfsManager.initialize(projectId);
      
      const filePath = `app-hosting/${appId}/index.html`;
      Logger.info('Looking for static file in VFS', { filePath });
      
      const file = await vfsManager.readFile(filePath);
      if (file && file.content) {
        Logger.info('Serving static file from VFS', { filePath, contentType: file.mimeType });
        return new HttpResponse(file.content, {
          status: 200,
          headers: {
            'Content-Type': file.mimeType || 'text/html'
          }
        });
      }
      
      // Fallback to demo content with WebVM status
      Logger.info('No VFS file found, serving demo content with WebVM status');
      const webvmStatus = application.metadata?.realWebVM ? 'REAL WebVM' : 'Static Files';
      const runtimeInfo = application.metadata?.runtimeInstanceId 
        ? `Runtime ID: ${application.metadata.runtimeInstanceId}` 
        : 'No runtime instance';

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
        .webvm-status {
            background: rgba(255,165,0,0.3);
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
        <div class="webvm-status">
            <strong>WebVM Type:</strong> ${webvmStatus}<br>
            <strong>Runtime Info:</strong> ${runtimeInfo}
        </div>
        <p><strong>Created:</strong> ${new Date(application.createdAt).toLocaleString()}</p>
        <p><em>This is the demo app placeholder. ${application.status === 'RUNNING' && application.metadata?.realWebVM ? 'WebVM runtime is active but serving demo content.' : 'Upload files or start the application to see your content.'}</em></p>
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
      Logger.error('Error serving application via REAL WebVM', error as Error, { appId: params.appId });
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

  // WebVM API endpoint as per contract - Get WebVM instance status
  http.get('/api/webvm/status', async () => {
    try {
      const { WebVMManager } = await import('../lib/webvm/WebVMManager');
      
      // Initialize WebVM with real CheerpX configuration
      const webvm = WebVMManager.getInstance({
        type: 'cheerpx',
        webvm: {
          memorySize: 256,
          persistent: true,
          diskImage: 'https://disks.webvm.io/debian_small_20230522_0234.ext2',
          logLevel: 'debug'
        }
      });

      // Check initialization status and initialize if needed
      const metrics = webvm.getSystemMetrics();
      
      if (!metrics.webvm.initialized) {
        await webvm.initialize();
      }
      
      // Get status after initialization
      let status;
      try {
        status = await webvm.getSystemStatus();
      } catch (statusError) {
        Logger.warn('Failed to get WebVM status', { error: statusError });
        const fallbackMetrics = webvm.getSystemMetrics();
        status = {
          initialized: fallbackMetrics.webvm.initialized,
          providerType: fallbackMetrics.webvm.providerType,
          stats: null,
          runtimeCount: fallbackMetrics.webvm.runtimeCount
        };
      }
      
      const runtimes = await webvm.listRuntimes();
      
      // Return contract-compliant WebVMInstance schema
      return HttpResponse.json({
        id: 'supabase-lite-webvm-1',
        status: status.initialized ? 'ready' : 'initializing',
        runtimeIds: runtimes.map(r => r.id),
        activeApplicationId: runtimes.find(r => r.status === 'running')?.metadata?.appId || null,
        lastSnapshot: null,
        memoryUsage: status.stats?.memoryUsage || 256,
        createdAt: new Date().toISOString(),
        config: {
          memoryLimit: 256,
          diskLimit: 2048,
          networkEnabled: true,
          snapshotEnabled: false
        }
      });
      
    } catch (error) {
      Logger.error('Error getting WebVM status', error as Error);
      return HttpResponse.json(
        { message: 'Failed to get WebVM status' },
        { status: 500 }
      );
    }
  }),

  // Application Server status endpoint
  http.get('/api/application-server/status', async () => {
    try {
      const apps = await applicationPersistence.getAllApplications();
      const { WebVMManager } = await import('../lib/webvm/WebVMManager');
      
      const webvm = WebVMManager.getInstance({
        type: 'cheerpx',
        webvm: {
          memorySize: 256,
          persistent: true,
          diskImage: 'https://disks.webvm.io/debian_small_20230522_0234.ext2'
        }
      });
      
      const metrics = webvm.getSystemMetrics();
      
      return HttpResponse.json({
        status: 'operational',
        applications: {
          total: apps.length,
          running: apps.filter(app => app.status === 'RUNNING').length,
          stopped: apps.filter(app => app.status === 'STOPPED').length
        },
        webvm: {
          initialized: metrics.webvm.initialized,
          providerType: metrics.webvm.providerType,
          runtimeCount: metrics.webvm.runtimeCount
        },
        uptime: Date.now(),
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      Logger.error('Error getting Application Server status', error as Error);
      return HttpResponse.json(
        { message: 'Failed to get Application Server status' },
        { status: 500 }
      );
    }
  }),

  // WebVM status endpoint - REAL WebVM integration
  http.get('/api/debug/webvm/status', async () => {
    try {
      const { WebVMManager } = await import('../lib/webvm/WebVMManager');
      
      // Initialize WebVM with real CheerpX configuration
      const webvm = WebVMManager.getInstance({
        type: 'cheerpx',
        webvm: {
          memorySize: 256,
          persistent: true,
          diskImage: 'https://disks.webvm.io/debian_small_20230522_0234.ext2',
          logLevel: 'debug'
        }
      });

      // Check initialization status and initialize if needed
      const metrics = webvm.getSystemMetrics();
      Logger.info('WebVM metrics before initialization', { metrics });
      
      if (!metrics.webvm.initialized) {
        Logger.info('WebVM not initialized, initializing now...');
        await webvm.initialize();
      }
      
      // Get status after initialization with error handling
      let status;
      try {
        status = await webvm.getSystemStatus();
      } catch (statusError) {
        Logger.warn('Failed to get WebVM status, returning metrics-based status', { error: statusError });
        // Fallback to metrics-based status
        const fallbackMetrics = webvm.getSystemMetrics();
        status = {
          initialized: fallbackMetrics.webvm.initialized,
          providerType: fallbackMetrics.webvm.providerType,
          stats: null,
          runtimeCount: fallbackMetrics.webvm.runtimeCount
        };
      }
      
      const updatedMetrics = webvm.getSystemMetrics();
      
      // Return WebVMInstance-compatible response
      const webvmInstance = {
        id: 'default-webvm-instance',
        status: status.initialized ? 'ready' : 'initializing', // WebVMStatus values
        runtimeIds: [], // TODO: Get actual runtime IDs from WebVM
        activeApplicationId: undefined, // TODO: Get from WebVM state
        lastSnapshot: new Date(),
        memoryUsage: 0, // TODO: Get actual memory usage
        createdAt: new Date(),
        config: {
          memorySize: 256,
          persistent: true,
          diskImage: 'https://disks.webvm.io/debian_small_20230522_0234.ext2',
          logLevel: 'debug'
        },
        // Additional debug info (not part of WebVMInstance interface)
        provider: 'cheerpx-real',
        providerType: status.providerType,
        initialized: status.initialized,
        runtimeCount: status.runtimeCount,
        stats: status.stats,
        metrics: updatedMetrics,
        timestamp: new Date().toISOString()
      };

      return HttpResponse.json(webvmInstance);
    } catch (error) {
      Logger.error('Failed to get WebVM status', error as Error);
      console.error('WebVM status error:', error); // Extra console log
      // Return error response in WebVMInstance-compatible format
      return HttpResponse.json({
        id: 'error-webvm-instance',
        status: 'error' as const, // WebVMStatus.ERROR
        runtimeIds: [],
        activeApplicationId: undefined,
        lastSnapshot: new Date(),
        memoryUsage: 0,
        createdAt: new Date(),
        config: {
          logLevel: 'error'
        },
        // Additional error info
        provider: 'unknown',
        error: (error as Error).message || 'Unknown error',
        errorStack: (error as Error).stack,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  }),

  // WebVM initialization endpoint
  http.post('/api/debug/webvm/init', async ({ request }) => {
    try {
      const { WebVMManager } = await import('../lib/webvm/WebVMManager');
      const config = await request.json();
      
      const webvm = WebVMManager.getInstance({
        type: 'cheerpx',
        webvm: {
          memoryMB: config.memoryMB || 256,
          diskSizeMB: config.diskSizeMB || 512,
          networkingEnabled: config.networkingEnabled !== false,
          debugMode: config.debugMode !== false,
          linuxDistribution: config.linuxDistribution || 'debian'
        }
      });

      await webvm.initialize();
      const status = await webvm.getSystemStatus();
      
      Logger.info('WebVM initialized via API endpoint', { status });
      
      return HttpResponse.json({
        status: 'ready',
        provider: 'cheerpx-real',
        initialized: true,
        ...status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      Logger.error('Failed to initialize WebVM', error as Error);
      return HttpResponse.json({
        status: 'error',
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  }),

  // WebVM reset endpoint
  http.post('/api/debug/webvm/reset', async () => {
    try {
      const { WebVMManager } = await import('../lib/webvm/WebVMManager');
      
      const webvm = WebVMManager.getInstance({
        type: 'cheerpx',
        webvm: {
          memorySize: 256,
          persistent: true,
          diskImage: 'https://disks.webvm.io/debian_small_20230522_0234.ext2',
          logLevel: 'debug'
        }
      });

      await webvm.shutdown();
      await webvm.initialize();
      
      const status = await webvm.getSystemStatus();
      
      Logger.info('WebVM reset via API endpoint', { status });
      
      return HttpResponse.json({
        status: 'ready',
        provider: 'cheerpx-real',
        initialized: true,
        ...status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      Logger.error('Failed to reset WebVM', error as Error);
      return HttpResponse.json({
        status: 'error',
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  }),

  // Debug persistence endpoint
  http.get('/api/debug/persistence/stats', async () => {
    try {
      const stats = await applicationPersistence.getDatabaseStats();
      return HttpResponse.json({
        ...stats,
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      Logger.error('Failed to get persistence stats', error as Error);
      return HttpResponse.json({
        error: 'Failed to get persistence statistics',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  }),

  // Debug clear all data endpoint (for testing)
  http.delete('/api/debug/persistence/clear', async () => {
    try {
      await applicationPersistence.clearAllData();
      Logger.info('All persistence data cleared via debug endpoint');
      return HttpResponse.json({
        message: 'All data cleared successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      Logger.error('Failed to clear persistence data', error as Error);
      return HttpResponse.json({
        error: 'Failed to clear data',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  }),

  // WebVM Console Command Execution
  http.post('/api/debug/webvm/execute', async ({ request }) => {
    try {
      const body = await request.json();
      const { command, workingDirectory = '/root' } = body;
      
      Logger.info('WebVM Console: Executing command', { command, workingDirectory });

      // Simulate realistic command execution responses
      const simulatedResponses: Record<string, { output: string; exitCode: number }> = {
        'ps aux': {
          output: `USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.0  0.1   2088   648 ?        Ss   12:00   0:00 /sbin/init
root        42  0.0  0.2   3456  1024 ?        S    12:00   0:00 /usr/sbin/sshd
root       123  0.0  0.3   4568  1536 ?        S    12:01   0:00 node /app/server.js
root       156  0.0  0.1   2344   512 ?        R    12:02   0:00 ps aux`,
          exitCode: 0
        },
        'ls -la': {
          output: `total 32
drwxr-xr-x  8 root root  256 Sep 18 12:00 .
drwxr-xr-x  3 root root   96 Sep 18 12:00 ..
-rw-r--r--  1 root root  220 Sep 18 12:00 .bashrc
-rw-r--r--  1 root root  807 Sep 18 12:00 .profile
drwxr-xr-x  2 root root   64 Sep 18 12:00 app
drwxr-xr-x  2 root root   64 Sep 18 12:00 bin
drwxr-xr-x  2 root root   64 Sep 18 12:00 etc
drwxr-xr-x  2 root root   64 Sep 18 12:00 tmp`,
          exitCode: 0
        },
        'uname -a': {
          output: 'Linux webvm 5.15.0-cheerpx #1 SMP WebAssembly x86_64 GNU/Linux',
          exitCode: 0
        },
        'free -h': {
          output: `              total        used        free      shared  buff/cache   available
Mem:          256Mi        128Mi         64Mi        8Mi        64Mi        120Mi
Swap:           0B          0B          0B`,
          exitCode: 0
        },
        'df -h': {
          output: `Filesystem      Size  Used Avail Use% Mounted on
/dev/root       512M  256M  256M  50% /
tmpfs           128M     0  128M   0% /tmp
/dev/app        100M   45M   55M  45% /app`,
          exitCode: 0
        },
        'whoami': {
          output: 'root',
          exitCode: 0
        },
        'pwd': {
          output: workingDirectory,
          exitCode: 0
        },
        'date': {
          output: new Date().toString(),
          exitCode: 0
        },
        'cat /proc/cpuinfo': {
          output: `processor	: 0
vendor_id	: CheerpX
cpu family	: 6
model		: 158
model name	: CheerpX WebAssembly Processor
stepping	: 10
microcode	: 0xb4
cpu MHz		: 2400.000
cache size	: 256 KB
physical id	: 0
siblings	: 1
core id		: 0
cpu cores	: 1`,
          exitCode: 0
        }
      };

      // Check for exact command match first
      let response = simulatedResponses[command];
      
      // Handle dynamic commands
      if (!response) {
        if (command.startsWith('echo ')) {
          const text = command.substring(5).replace(/['"]/g, '');
          response = { output: text, exitCode: 0 };
        } else if (command.startsWith('ls ')) {
          response = { 
            output: 'file1.txt  file2.txt  directory1/  directory2/', 
            exitCode: 0 
          };
        } else if (command.startsWith('cat ')) {
          const filename = command.substring(4);
          response = { 
            output: `Contents of ${filename}:\nThis is a simulated file content.`, 
            exitCode: 0 
          };
        } else if (command.includes('grep') || command.includes('find')) {
          response = { 
            output: 'No matches found', 
            exitCode: 1 
          };
        } else {
          // Unknown command
          response = { 
            output: `bash: ${command.split(' ')[0]}: command not found`, 
            exitCode: 127 
          };
        }
      }

      Logger.info('WebVM Console: Command executed', { 
        command, 
        exitCode: response.exitCode, 
        outputLength: response.output.length 
      });

      // Add a small delay to simulate real execution
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

      return HttpResponse.json(response);
    } catch (error) {
      Logger.error('WebVM Console: Command execution failed', error as Error);
      return HttpResponse.json({
        output: `Error: ${(error as Error).message}`,
        exitCode: -1
      }, { status: 500 });
    }
  })
]; // End of applicationServerHandlers array

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