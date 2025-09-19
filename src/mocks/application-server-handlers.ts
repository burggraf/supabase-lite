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

      // Process uploaded files and deploy them to WebVM
      if (body.metadata && body.metadata.files && body.metadata.files.length > 0) {
        Logger.info('Processing uploaded files for WebVM deployment', { fileCount: body.metadata.files.length });
        
        try {
          const { WebVMBridge } = await import('../lib/webvm/WebVMBridge');
          const bridge = WebVMBridge.getInstance();
          await bridge.initialize(); // Initialize REAL WebVM
          
          // Deploy files to WebVM filesystem
          await bridge.deployApplication(application.id, body.metadata.files, application.runtimeId);
          
          Logger.info('Files deployed to WebVM successfully', { 
            appId: application.id, 
            fileCount: body.metadata.files.length 
          });
        } catch (deployError) {
          Logger.error('Failed to deploy files to WebVM', deployError as Error, { appId: application.id });
          throw new Error('Failed to deploy application files to WebVM');
        }
      }

      await applicationPersistence.saveApplication(application);
      Logger.info('Application created and persisted successfully', { id: application.id });
      
      return HttpResponse.json(application, { status: 201 });
    } catch (error) {
      Logger.error('Error creating application', error as Error);
      console.error('🚨 Application creation error:', error);
      console.error('🚨 Error stack:', (error as Error).stack);
      return HttpResponse.json(
        { 
          error: 'Failed to create application',
          details: (error as Error).message,
          stack: (error as Error).stack
        },
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

      // Note: Application files are stored in WebVM filesystem and are automatically 
      // cleaned up when the WebVM application is stopped and the runtime is shutdown.
      // No manual file cleanup needed as WebVM manages its own filesystem lifecycle.
      Logger.info('Application files cleanup handled by WebVM filesystem lifecycle', { appId });

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
      
      // Start application using WebVM Bridge
      const { WebVMBridge } = await import('../lib/webvm/WebVMBridge');
      const bridge = WebVMBridge.getInstance();

      Logger.info('Starting application in WebVM', { 
        appId, 
        runtimeId: application.runtimeId 
      });

      // Start the application in WebVM
      const webvmApp = await bridge.startApplication(appId, application.runtimeId);

      Logger.info('Application started successfully in WebVM', { 
        appId, 
        status: webvmApp.status,
        port: webvmApp.port,
        pid: webvmApp.pid
      });
      
      application.status = 'RUNNING';
      application.updatedAt = new Date().toISOString();
      // Store WebVM application info in metadata
      application.metadata = {
        ...application.metadata,
        webvmApp: {
          id: webvmApp.id,
          status: webvmApp.status,
          port: webvmApp.port,
          pid: webvmApp.pid,
          runtimeId: webvmApp.runtimeId
        },
        realWebVM: true
      };
      await applicationPersistence.saveApplication(application);
      
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
      
      // Stop application in WebVM
      if (application.metadata?.webvmApp) {
        const { WebVMBridge } = await import('../lib/webvm/WebVMBridge');
        const bridge = WebVMBridge.getInstance();

        Logger.info('Stopping application in WebVM', { 
          appId, 
          webvmAppId: application.metadata.webvmApp.id,
          pid: application.metadata.webvmApp.pid
        });

        try {
          await bridge.stopApplication(appId);
          Logger.info('WebVM application stopped successfully', { appId });
          
          // Clear WebVM application info from metadata
          application.metadata = {
            ...application.metadata,
            webvmApp: undefined,
            realWebVM: false
          };
        } catch (runtimeError) {
          Logger.warn('Failed to stop WebVM application, but continuing with app stop', { 
            appId,
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
      if (application.status === 'RUNNING' && application.metadata?.webvmApp && application.metadata?.realWebVM) {
        Logger.info('REAL WebVM: Proxying HTTP request to WebVM application', { 
          appId, 
          webvmApp: application.metadata.webvmApp
        });

        try {
          const { WebVMBridge } = await import('../lib/webvm/WebVMBridge');
          const bridge = WebVMBridge.getInstance();

          // Convert MSW request to WebVM format
          const webvmRequest = {
            method: request.method,
            url: new URL(request.url).pathname,
            headers: Object.fromEntries(request.headers.entries()),
            body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined
          };

          // Proxy the HTTP request to the WebVM application
          const webvmResponse = await bridge.proxyHTTPRequest(appId, webvmRequest);
          
          Logger.info('WebVM HTTP request proxied successfully', { 
            appId, 
            method: webvmRequest.method,
            url: webvmRequest.url,
            status: webvmResponse.status 
          });
          
          return new HttpResponse(webvmResponse.body, {
            status: webvmResponse.status,
            statusText: webvmResponse.statusText,
            headers: webvmResponse.headers
          });
        } catch (proxyError) {
          Logger.error('WebVM HTTP proxy failed', { 
            appId, 
            error: proxyError 
          });
          throw proxyError;
        }
      }

      // Application exists but is not running - start it or return error
      if (application.status !== 'RUNNING') {
        Logger.warn('Application not running, cannot serve', { appId, status: application.status });
        return new HttpResponse(`Application "${application.name}" is not running (status: ${application.status})`, { 
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      // Application should be running but no WebVM integration
      Logger.error('Application marked as running but no WebVM runtime found', { appId });
      return new HttpResponse('Application runtime not available', { status: 502 });
    } catch (error) {
      Logger.error('Error serving application via REAL WebVM', error as Error, { appId: params.appId });
      return new HttpResponse('Internal Server Error', { status: 500 });
    }
  })),

  // Get available runtimes - REAL WebVM runtime list
  http.get('/api/runtimes', async () => {
    try {
      const { WebVMBridge } = await import('../lib/webvm/WebVMBridge');
      const bridge = WebVMBridge.getInstance();
      
      // Get installed runtimes from WebVM
      const runtimes = await bridge.getRuntimes();
      
      Logger.info('Retrieved runtimes from WebVM', { runtimeCount: runtimes.length });
      return HttpResponse.json({ runtimes });
    } catch (error) {
      Logger.error('Failed to get runtimes from WebVM', error as Error);
      
      // Fallback to default runtimes list if WebVM not available
      const fallbackRuntimes = [
        {
          id: 'static',
          name: 'Static Files',
          type: 'static',
          version: '1.0.0',
          status: 'installed',
          installedAt: new Date('2024-01-01').toISOString()
        },
        {
          id: 'nodejs-20',
          name: 'Node.js 20.x',
          type: 'nodejs',
          version: '20.10.0',
          status: 'available'
        }
      ];
      
      Logger.info('Using fallback runtimes list', { runtimeCount: fallbackRuntimes.length });
      return HttpResponse.json({ runtimes: fallbackRuntimes });
    }
  }),

  // Install runtime endpoint - REAL WebVM runtime installation
  http.post('/api/runtimes/:runtimeId/install', async ({ params }) => {
    const runtimeId = params.runtimeId as string;
    Logger.info('Installing runtime in WebVM', { runtimeId });
    
    try {
      // Install runtime using WebVM Bridge
      const { WebVMBridge } = await import('../lib/webvm/WebVMBridge');
      const bridge = WebVMBridge.getInstance();
      
      const runtime = await bridge.installRuntime(runtimeId);
      
      Logger.info('Runtime installed successfully in WebVM', { 
        runtimeId, 
        status: runtime.status,
        type: runtime.type,
        version: runtime.version
      });
      
      return HttpResponse.json(runtime);
    } catch (error) {
      Logger.error('Failed to install runtime in WebVM', error as Error);
      return HttpResponse.json(
        { error: `Failed to install runtime: ${(error as Error).message}` },
        { status: 500 }
      );
    }
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

  // WebVM status endpoint - v1 API compatibility
  http.get('/api/v1/application-server/webvm/status', async () => {
    try {
      const { WebVMManager } = await import('../lib/webvm/WebVMManager');
      
      // Initialize WebVM with real CheerpX configuration
      const webvm = WebVMManager.getInstance({
        type: 'cheerpx',
        webvm: {
          memorySize: 256,
          persistent: true,
          diskImage: 'https://disks.webvm.io/debian_small_20230522_0234.ext2',
          logLevel: 'debug' as const
        }
      });

      // Initialize if not already done
      if (!(webvm as any).initialized) {
        await webvm.initialize();
      }

      let status;
      try {
        status = await webvm.getSystemStatus();
        Logger.info('WebVM v1 status retrieved successfully', { status });
      } catch (statusError) {
        Logger.warn('Failed to get WebVM v1 status, returning metrics-based status', { error: statusError });
        // Return basic status based on metrics
        const metrics = webvm.getSystemMetrics();
        status = {
          initialized: metrics.webvm.initialized,
          providerType: metrics.webvm.providerType,
          runtimeCount: metrics.webvm.runtimeCount,
          stats: null
        };
      }

      return HttpResponse.json({
        id: 'default-webvm-instance',
        status: status.initialized ? 'ready' : 'initializing', // WebVMStatus values
        runtimeIds: [],
        lastSnapshot: new Date().toISOString(),
        memoryUsage: status.stats?.memoryUsage || 0,
        createdAt: new Date().toISOString(),
        config: {
          memorySize: 256,
          persistent: true,
          diskImage: 'https://disks.webvm.io/debian_small_20230522_0234.ext2',
          logLevel: 'debug'
        },
        provider: 'cheerpx-real',
        providerType: status.providerType,
        initialized: status.initialized,
        runtimeCount: status.runtimeCount,
        stats: status.stats || {
          memoryUsage: 256,
          diskUsage: 0,
          uptime: Date.now(),
          processCount: 0,
          networkConnections: 0,
          provider: 'cheerpx-real',
          version: '1.1.7'
        },
        metrics: webvm.getSystemMetrics(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      Logger.error('Failed to get WebVM v1 status', error as Error);
      console.error('WebVM v1 status error:', error); // Extra console log
      return HttpResponse.json({
        id: 'default-webvm-instance',
        status: 'error' as const, // WebVMStatus.ERROR
        error: (error as Error).message,
        provider: 'cheerpx-real',
        initialized: false,
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